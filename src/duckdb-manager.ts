/** Shared DuckDB engine with lazy initialization and orderly shutdown. */
import type { AsyncDuckDB, AsyncDuckDBConnection, DuckDBBundles } from '@duckdb/duckdb-wasm';
import { DEFAULT_CONFIG, QueryResult } from './types';

type DuckDBModule = typeof import('@duckdb/duckdb-wasm');

export interface DuckDBManagerConfig {
  version: string;
  cdn: string;
}

export class DuckDBManager {
  private db: AsyncDuckDB | null = null;
  private connection: AsyncDuckDBConnection | null = null;
  private initPromise: Promise<void> | null = null;
  private closePromise: Promise<void> | null = null;
  private operations = new Set<Promise<unknown>>();
  private config: DuckDBManagerConfig = {
    version: DEFAULT_CONFIG.duckdbVersion,
    cdn: DEFAULT_CONFIG.duckdbCDN,
  };
  private registeredFiles = new Map<string, { url: string; promise: Promise<void> }>();
  private duckdbModule: DuckDBModule | null = null;
  private initQueriesExecuted = false;
  private initQueriesPromise: Promise<void> | null = null;
  private initQueries: string[] = [];

  configure(config: Partial<DuckDBManagerConfig>): void {
    if (this.db || this.initPromise || this.closePromise) {
      console.warn('DuckDB already initialized, configuration will not take effect');
      return;
    }
    const next = { ...this.config, ...config };
    if (next.version !== this.config.version || next.cdn !== this.config.cdn) this.duckdbModule = null;
    this.config = next;
  }

  configureInitQueries(queries: string[]): void {
    if (this.initQueriesExecuted || this.initQueriesPromise || this.initPromise || this.closePromise) {
      console.warn('Init queries already executed or initializing, configuration will not take effect');
      return;
    }
    this.initQueries = [...queries];
  }

  private async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    if (this.db && this.connection) return;
    const pending = this.doInitialize();
    this.initPromise = pending;
    try {
      await pending;
    } finally {
      if (this.initPromise === pending) this.initPromise = null;
    }
  }

  private async importCDNModule(url: string): Promise<DuckDBModule> {
    return import(/* @vite-ignore */ url);
  }

  private async loadDuckDBModule(): Promise<DuckDBModule> {
    if (this.duckdbModule) return this.duckdbModule;
    const preloaded = typeof window === 'undefined' ? undefined :
      (window as Window & { duckdb?: DuckDBModule }).duckdb;
    if (preloaded?.PACKAGE_VERSION === this.config.version) {
      console.log('Using pre-loaded DuckDB from window.duckdb');
      return this.duckdbModule = preloaded;
    }
    try {
      const installed = await import('@duckdb/duckdb-wasm');
      if (installed.PACKAGE_VERSION === this.config.version) return this.duckdbModule = installed;
    } catch {
      // The peer dependency is optional for CDN consumers.
    }
    const url = `${this.assetRoot()}/+esm`;
    try {
      return this.duckdbModule = await this.importCDNModule(url);
    } catch (error) {
      throw new Error(`Failed to load DuckDB from ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private assetRoot(): string {
    return `${this.config.cdn.replace(/\/+$/, '')}@${this.config.version}`;
  }

  private async doInitialize(): Promise<void> {
    let db: AsyncDuckDB | null = null;
    let worker: Worker | null = null;
    let workerUrl: string | null = null;
    try {
      const duckdb = await this.loadDuckDBModule();
      const dist = `${this.assetRoot()}/dist`;
      const bundles: DuckDBBundles = {
        mvp: { mainModule: `${dist}/duckdb-mvp.wasm`, mainWorker: `${dist}/duckdb-browser-mvp.worker.js` },
        eh: { mainModule: `${dist}/duckdb-eh.wasm`, mainWorker: `${dist}/duckdb-browser-eh.worker.js` },
      };
      const bundle = await duckdb.selectBundle(bundles);
      if (!bundle.mainWorker) throw new Error('DuckDB bundle has no worker');
      const response = await fetch(bundle.mainWorker);
      if (!response.ok) throw new Error(`Failed to fetch worker: ${response.status} ${response.statusText}`);
      workerUrl = URL.createObjectURL(await response.blob());
      worker = new Worker(workerUrl);
      db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      const connection = await db.connect();
      // Publish only a fully usable engine. Other callers await initPromise.
      this.db = db;
      this.connection = connection;
    } catch (error) {
      try { await db?.terminate(); } catch { /* Preserve the initialization error. */ }
      worker?.terminate();
      if (error instanceof Error && error.message.includes('CORS')) {
        throw new Error('Failed to initialize DuckDB: CORS policy blocked worker loading.');
      }
      throw new Error(`Failed to initialize DuckDB: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (workerUrl) URL.revokeObjectURL(workerUrl);
    }
  }

  private async executeInitQueries(): Promise<void> {
    if (this.initQueriesExecuted) return;
    if (this.initQueriesPromise) return this.initQueriesPromise;
    if (!this.initQueries.length) { this.initQueriesExecuted = true; return; }
    if (!this.connection) throw new Error('DuckDB connection not available');
    const connection = this.connection;
    const queries = [...this.initQueries];
    const pending = (async () => {
      console.log(`Executing ${queries.length} initialization queries...`);
      for (let i = 0; i < queries.length; i++) {
        console.log(`Init query [${i + 1}/${queries.length}]: ${queries[i]}`);
        await connection.query(queries[i]!);
      }
      this.initQueriesExecuted = true;
      console.log('Initialization queries completed successfully');
    })().catch(error => {
      throw new Error(`Initialization query failed: ${error instanceof Error ? error.message : String(error)}`);
    });
    this.initQueriesPromise = pending;
    try {
      await pending;
    } finally {
      if (this.initQueriesPromise === pending) this.initQueriesPromise = null;
    }
  }

  private async withEngine<T>(action: () => Promise<T>): Promise<T> {
    if (this.closePromise) await this.closePromise;
    const operation = (async () => {
      await this.initialize();
      return action();
    })();
    this.operations.add(operation);
    try { return await operation; }
    finally { this.operations.delete(operation); }
  }

  async registerFile(name: string, url: string): Promise<void> {
    return this.withEngine(async () => {
      const existing = this.registeredFiles.get(name);
      if (existing) {
        if (existing.url !== url) throw new Error(`File name already registered for another URL: ${name}`);
        return existing.promise;
      }
      const promise = this.db!.registerFileURL(name, url, this.duckdbModule!.DuckDBDataProtocol.HTTP, false);
      this.registeredFiles.set(name, { url, promise });
      try { await promise; }
      catch (error) {
        this.registeredFiles.delete(name);
        throw new Error(`Failed to register file ${name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  async query(sql: string): Promise<QueryResult> {
    return this.withEngine(async () => {
      if (!this.connection) throw new Error('DuckDB connection not available');
      await this.executeInitQueries();
      const startTime = performance.now();
      try {
        const result = await this.connection.query(sql);
        const executionTime = performance.now() - startTime;
        const columns = result.schema.fields.map(field => field.name);
        const vectors = columns.map((_, i) => result.getChildAt(i));
        const rows: unknown[][] = [];
        for (let i = 0; i < result.numRows; i++) rows.push(vectors.map(column => column?.get(i) ?? null));
        return { columns, rows, rowCount: result.numRows, executionTime };
      } catch (error) {
        throw new Error(`Query execution failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.closePromise = this.doClose().finally(() => { this.closePromise = null; });
    return this.closePromise;
  }

  private async doClose(): Promise<void> {
    const pending = [...this.operations];
    if (this.initPromise) pending.push(this.initPromise);
    if (this.initQueriesPromise) pending.push(this.initQueriesPromise);
    await Promise.all(pending.map(operation => operation.catch(() => undefined)));
    const connection = this.connection;
    const db = this.db;
    this.connection = null;
    this.db = null;
    try {
      try { await connection?.close(); }
      finally { await db?.terminate(); }
    } finally {
      this.initPromise = null;
      this.duckdbModule = null;
      this.registeredFiles.clear();
      this.initQueriesExecuted = false;
      this.initQueriesPromise = null;
      this.initQueries = [];
    }
  }

  isInitialized(): boolean {
    return this.db !== null && this.connection !== null && this.closePromise === null;
  }
}

export const duckDBManager = new DuckDBManager();
