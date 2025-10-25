/**
 * DuckDB WASM manager with lazy loading and connection pooling
 */

import { QueryResult } from './types';

export interface DuckDBManagerConfig {
  version: string;
  cdn: string;
}

/**
 * Singleton DuckDB manager
 * Manages a shared DuckDB instance across all embeds
 */
class DuckDBManager {
  private db: any = null;
  private connection: any = null;
  private initPromise: Promise<void> | null = null;
  private config: DuckDBManagerConfig;
  private registeredFiles = new Set<string>();
  private duckdbModule: any = null;
  private initQueriesExecuted = false;
  private initQueriesPromise: Promise<void> | null = null;
  private initQueries: string[] = [];

  constructor() {
    this.config = {
      version: '1.31.1-dev1.0',
      cdn: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm',
    };
  }

  /**
   * Configure DuckDB settings
   */
  configure(config: Partial<DuckDBManagerConfig>): void {
    if (this.db) {
      console.warn('DuckDB already initialized, configuration will not take effect');
      return;
    }
    this.config = { ...this.config, ...config };
  }

  /**
   * Configure initialization queries
   * Must be called before first query execution
   */
  configureInitQueries(queries: string[]): void {
    if (this.initQueriesExecuted) {
      console.warn('Init queries already executed, configuration will not take effect');
      return;
    }
    this.initQueries = queries;
  }

  /**
   * Initialize DuckDB WASM (lazy loaded)
   */
  private async initialize(): Promise<void> {
    if (this.db) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  /**
   * Load DuckDB module from CDN or check if already loaded globally
   */
  private async loadDuckDBModule(): Promise<any> {
    if (this.duckdbModule) {
      return this.duckdbModule;
    }

    // Check if already loaded globally
    if (typeof window !== 'undefined' && (window as any).duckdb) {
      console.log('Using pre-loaded DuckDB from window.duckdb');
      this.duckdbModule = (window as any).duckdb;
      return this.duckdbModule!;
    }

    // Try dynamic import - works in development (bundled) or if available as module
    try {
      console.log('Attempting to load DuckDB via dynamic import...');
      const duckdbModule = await import('@duckdb/duckdb-wasm');
      this.duckdbModule = duckdbModule;
      console.log('DuckDB module loaded via dynamic import');
      return this.duckdbModule;
    } catch (importError) {
      // Dynamic import failed, try loading from CDN
      console.log('Dynamic import failed, loading from jsDelivr CDN...');

      try {
        const cdnUrl = `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${this.config.version}/+esm`;
        console.log('Loading DuckDB from:', cdnUrl);

        const duckdbModule = await import(/* @vite-ignore */ cdnUrl);
        this.duckdbModule = duckdbModule;

        // Also make it globally available for future use
        if (typeof window !== 'undefined') {
          (window as any).duckdb = duckdbModule;
        }

        console.log('DuckDB module loaded from jsDelivr CDN');
        return this.duckdbModule;
      } catch (cdnError) {
        throw new Error(
          `Failed to load DuckDB. Tried:\n` +
          `1. Pre-loaded global: Not found\n` +
          `2. Dynamic import: ${importError instanceof Error ? importError.message : String(importError)}\n` +
          `3. CDN import: ${cdnError instanceof Error ? cdnError.message : String(cdnError)}`
        );
      }
    }
  }

  private async doInitialize(): Promise<void> {
    try {
      // Load DuckDB module from CDN
      const duckdb = await this.loadDuckDBModule();

      const logger = new duckdb.ConsoleLogger();

      // Get bundles - this provides the correct paths
      const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

      // Select appropriate bundle for the platform
      const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

      // Fetch the worker code and create a blob URL to avoid CORS issues
      console.log('Loading DuckDB WASM worker from:', bundle.mainWorker);

      const workerResponse = await fetch(bundle.mainWorker!);
      if (!workerResponse.ok) {
        throw new Error(`Failed to fetch worker: ${workerResponse.status} ${workerResponse.statusText}`);
      }

      const workerBlob = await workerResponse.blob();
      const workerUrl = URL.createObjectURL(workerBlob);

      // Create worker from blob URL
      const worker = new Worker(workerUrl);

      // Initialize DuckDB
      console.log('Initializing DuckDB WASM...');
      this.db = new duckdb.AsyncDuckDB(logger, worker);
      await this.db.instantiate(bundle.mainModule, bundle.mainWorker);

      // Create connection
      this.connection = await this.db.connect();
      console.log('DuckDB WASM initialized successfully');

      // Clean up blob URL
      URL.revokeObjectURL(workerUrl);
    } catch (error) {
      this.initPromise = null;
      console.error('DuckDB initialization error:', error);

      if (error instanceof Error && error.message.includes('CORS')) {
        throw new Error('Failed to initialize DuckDB: CORS policy blocked worker loading. This may be a browser security restriction in development mode.');
      }

      throw new Error(`Failed to initialize DuckDB: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute initialization queries once
   */
  private async executeInitQueries(): Promise<void> {
    // Already executed
    if (this.initQueriesExecuted) {
      return;
    }

    // Already executing (race condition protection)
    if (this.initQueriesPromise) {
      return this.initQueriesPromise;
    }

    // No init queries configured
    if (!this.initQueries.length) {
      this.initQueriesExecuted = true;
      return;
    }

    this.initQueriesPromise = (async () => {
      try {
        console.log(`Executing ${this.initQueries.length} initialization queries...`);

        for (let i = 0; i < this.initQueries.length; i++) {
          const query = this.initQueries[i];
          console.log(`Init query [${i + 1}/${this.initQueries.length}]: ${query}`);

          // Execute via connection (DuckDB must be initialized first)
          await this.connection.query(query);
        }

        console.log('Initialization queries completed successfully');
        this.initQueriesExecuted = true;
      } catch (error) {
        // Reset state to allow retry on next run
        this.initQueriesPromise = null;
        throw new Error(
          `Initialization query failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })();

    return this.initQueriesPromise;
  }

  /**
   * Register a file URL with DuckDB
   */
  async registerFile(name: string, url: string): Promise<void> {
    await this.initialize();

    if (!this.db) {
      throw new Error('DuckDB not initialized');
    }

    // Skip if already registered
    if (this.registeredFiles.has(url)) {
      return;
    }

    try {
      // DuckDBDataProtocol.HTTP = 0
      await this.db.registerFileURL(name, url, 0, false);
      this.registeredFiles.add(url);
    } catch (error) {
      throw new Error(`Failed to register file ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute SQL query
   */
  async query(sql: string): Promise<QueryResult> {
    await this.initialize();

    // Execute init queries if configured and not yet executed
    await this.executeInitQueries();

    if (!this.connection) {
      throw new Error('DuckDB connection not available');
    }

    const startTime = performance.now();

    try {
      const result = await this.connection.query(sql);
      const executionTime = performance.now() - startTime;

      // Convert result to our format
      const columns = result.schema.fields.map((f: any) => f.name);
      const rows: unknown[][] = [];

      for (let i = 0; i < result.numRows; i++) {
        const row: unknown[] = [];
        for (let j = 0; j < result.numCols; j++) {
          const col = result.getChildAt(j);
          row.push(col?.get(i) ?? null);
        }
        rows.push(row);
      }

      return {
        columns,
        rows,
        rowCount: result.numRows,
        executionTime,
      };
    } catch (error) {
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Close connection and cleanup
   */
  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }

    if (this.db) {
      await this.db.terminate();
      this.db = null;
    }

    this.initPromise = null;
    this.registeredFiles.clear();

    // Reset init queries state
    this.initQueriesExecuted = false;
    this.initQueriesPromise = null;
    this.initQueries = [];
  }

  /**
   * Check if DuckDB is initialized
   */
  isInitialized(): boolean {
    return this.db !== null;
  }
}

// Export singleton instance
export const duckDBManager = new DuckDBManager();
