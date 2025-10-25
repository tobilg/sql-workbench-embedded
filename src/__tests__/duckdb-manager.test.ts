import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { duckDBManager } from '../duckdb-manager';

describe('duckdb-manager', () => {
  // Mock DuckDB objects
  const mockConnection = {
    query: vi.fn(),
    close: vi.fn(),
  };

  const mockDb = {
    connect: vi.fn(() => Promise.resolve(mockConnection)),
    registerFileURL: vi.fn(() => Promise.resolve()),
    terminate: vi.fn(() => Promise.resolve()),
    instantiate: vi.fn(() => Promise.resolve()),
  };

  const mockDuckDBModule = {
    ConsoleLogger: vi.fn(function(this: any) {
      this.log = vi.fn();
    }),
    selectBundle: vi.fn(() =>
      Promise.resolve({
        mainModule: 'mock-module.wasm',
        mainWorker: 'https://cdn.example.com/mock-worker.js',
      })
    ),
    getJsDelivrBundles: vi.fn(() => ({
      mvp: {
        mainModule: 'mock-module.wasm',
        mainWorker: 'https://cdn.example.com/mock-worker.js',
      },
    })),
    AsyncDuckDB: vi.fn(function(this: any) {
      return mockDb;
    }),
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Reset manager state using the private close method
    (duckDBManager as any).db = null;
    (duckDBManager as any).connection = null;
    (duckDBManager as any).initPromise = null;
    (duckDBManager as any).registeredFiles = new Set();
    (duckDBManager as any).duckdbModule = null;
    // Reset config to defaults
    (duckDBManager as any).config = {
      version: '1.31.1-dev1.0',
      cdn: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm',
    };

    // Mock DuckDB module loading
    vi.doMock('@duckdb/duckdb-wasm', () => mockDuckDBModule);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('configure', () => {
    it('should update configuration before initialization', () => {
      duckDBManager.configure({
        version: '1.30.0',
        cdn: 'https://custom-cdn.com',
      });

      const config = (duckDBManager as any).config;
      expect(config.version).toBe('1.30.0');
      expect(config.cdn).toBe('https://custom-cdn.com');
    });

    it('should warn if configuration changes after initialization', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Initialize first
      (duckDBManager as any).db = mockDb;

      duckDBManager.configure({ version: '1.30.0' });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'DuckDB already initialized, configuration will not take effect'
      );
      consoleWarnSpy.mockRestore();
    });

    it('should merge configuration with defaults', () => {
      duckDBManager.configure({ version: '1.30.0' });

      const config = (duckDBManager as any).config;
      expect(config.version).toBe('1.30.0');
      // Default CDN should remain unchanged
      expect(config.cdn).toContain('jsdelivr');
    });
  });

  describe('isInitialized', () => {
    it('should return false before initialization', () => {
      expect(duckDBManager.isInitialized()).toBe(false);
    });

    it('should return true after initialization', () => {
      (duckDBManager as any).db = mockDb;
      expect(duckDBManager.isInitialized()).toBe(true);
    });
  });

  describe('loadDuckDBModule', () => {
    it('should return cached module if already loaded', async () => {
      (duckDBManager as any).duckdbModule = mockDuckDBModule;

      const result = await (duckDBManager as any).loadDuckDBModule();

      expect(result).toBe(mockDuckDBModule);
    });

    it('should use pre-loaded window.duckdb if available', async () => {
      (window as any).duckdb = mockDuckDBModule;

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await (duckDBManager as any).loadDuckDBModule();

      expect(consoleLogSpy).toHaveBeenCalledWith('Using pre-loaded DuckDB from window.duckdb');
      expect(result).toBe(mockDuckDBModule);

      consoleLogSpy.mockRestore();
      delete (window as any).duckdb;
    });

    it('should cache loaded module', async () => {
      (window as any).duckdb = mockDuckDBModule;

      await (duckDBManager as any).loadDuckDBModule();

      expect((duckDBManager as any).duckdbModule).toBe(mockDuckDBModule);

      delete (window as any).duckdb;
    });
  });

  describe('registerFile', () => {
    beforeEach(() => {
      (duckDBManager as any).db = mockDb;
      (duckDBManager as any).connection = mockConnection;
    });

    it('should register a file URL', async () => {
      await duckDBManager.registerFile('data.parquet', 'https://example.com/data.parquet');

      expect(mockDb.registerFileURL).toHaveBeenCalledWith(
        'data.parquet',
        'https://example.com/data.parquet',
        0,
        false
      );
    });

    it('should skip already registered files', async () => {
      await duckDBManager.registerFile('data.parquet', 'https://example.com/data.parquet');
      await duckDBManager.registerFile('data.parquet', 'https://example.com/data.parquet');

      expect(mockDb.registerFileURL).toHaveBeenCalledTimes(1);
    });

    it('should register multiple different files', async () => {
      await duckDBManager.registerFile('data1.parquet', 'https://example.com/data1.parquet');
      await duckDBManager.registerFile('data2.parquet', 'https://example.com/data2.parquet');

      expect(mockDb.registerFileURL).toHaveBeenCalledTimes(2);
    });


    it('should handle registration errors', async () => {
      mockDb.registerFileURL.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        duckDBManager.registerFile('data.parquet', 'https://example.com/data.parquet')
      ).rejects.toThrow('Failed to register file data.parquet: Network error');
    });
  });

  describe('query', () => {
    beforeEach(() => {
      (duckDBManager as any).db = mockDb;
      (duckDBManager as any).connection = mockConnection;

      // Mock query result in Arrow format
      mockConnection.query.mockResolvedValue({
        schema: {
          fields: [
            { name: 'id', type: { toString: () => 'Int32' } },
            { name: 'name', type: { toString: () => 'Utf8' } },
          ],
        },
        numRows: 2,
        numCols: 2,
        getChildAt: (index: number) => {
          if (index === 0) {
            return { get: (i: number) => [1, 2][i] };
          }
          if (index === 1) {
            return { get: (i: number) => ['Alice', 'Bob'][i] };
          }
          return null;
        },
      });
    });

    it('should execute query and return results', async () => {
      const result = await duckDBManager.query('SELECT * FROM users');

      expect(mockConnection.query).toHaveBeenCalledWith('SELECT * FROM users');
      expect(result.columns).toEqual(['id', 'name']);
      expect(result.rows).toEqual([
        [1, 'Alice'],
        [2, 'Bob'],
      ]);
      expect(result.rowCount).toBe(2);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should measure execution time', async () => {
      const result = await duckDBManager.query('SELECT 1');

      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.executionTime).toBe('number');
    });

    it('should throw error if connection not available', async () => {
      (duckDBManager as any).connection = null;

      await expect(duckDBManager.query('SELECT 1')).rejects.toThrow(
        'DuckDB connection not available'
      );
    });

    it('should handle query execution errors', async () => {
      mockConnection.query.mockRejectedValueOnce(new Error('Syntax error'));

      await expect(duckDBManager.query('SELECT * FROM invalid')).rejects.toThrow(
        'Query execution failed: Syntax error'
      );
    });

    it('should handle null values in results', async () => {
      mockConnection.query.mockResolvedValueOnce({
        schema: {
          fields: [{ name: 'value', type: { toString: () => 'Int32' } }],
        },
        numRows: 1,
        numCols: 1,
        getChildAt: () => ({
          get: () => null,
        }),
      });

      const result = await duckDBManager.query('SELECT NULL AS value');

      expect(result.rows).toEqual([[null]]);
    });

    it('should handle empty result sets', async () => {
      mockConnection.query.mockResolvedValueOnce({
        schema: {
          fields: [{ name: 'id', type: { toString: () => 'Int32' } }],
        },
        numRows: 0,
        numCols: 1,
        getChildAt: () => ({ get: () => null }),
      });

      const result = await duckDBManager.query('SELECT * FROM users WHERE false');

      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });
  });

  describe('close', () => {
    beforeEach(() => {
      (duckDBManager as any).db = mockDb;
      (duckDBManager as any).connection = mockConnection;
      (duckDBManager as any).registeredFiles.add('https://example.com/data.parquet');
    });

    it('should close connection and terminate database', async () => {
      await duckDBManager.close();

      expect(mockConnection.close).toHaveBeenCalled();
      expect(mockDb.terminate).toHaveBeenCalled();
    });

    it('should clear registered files', async () => {
      await duckDBManager.close();

      const registeredFiles = (duckDBManager as any).registeredFiles;
      expect(registeredFiles.size).toBe(0);
    });

    it('should reset initialization state', async () => {
      await duckDBManager.close();

      expect((duckDBManager as any).db).toBeNull();
      expect((duckDBManager as any).connection).toBeNull();
      expect((duckDBManager as any).initPromise).toBeNull();
    });

    it('should handle close when not initialized', async () => {
      (duckDBManager as any).db = null;
      (duckDBManager as any).connection = null;

      await expect(duckDBManager.close()).resolves.not.toThrow();
    });

    it('should allow reinitialization after close', async () => {
      await duckDBManager.close();

      expect(duckDBManager.isInitialized()).toBe(false);
      expect((duckDBManager as any).initPromise).toBeNull();
    });
  });

  describe('initialization', () => {
    it('should return immediately if already initialized', async () => {
      (duckDBManager as any).db = mockDb;

      await (duckDBManager as any).initialize();

      expect(mockDuckDBModule.AsyncDuckDB).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle CORS errors during initialization', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (duckDBManager as any).duckdbModule = mockDuckDBModule;

      global.fetch = vi.fn(() =>
        Promise.reject(new Error('Failed to fetch: CORS policy'))
      ) as any;

      await expect((duckDBManager as any).doInitialize()).rejects.toThrow(
        'Failed to initialize DuckDB: CORS policy blocked worker loading'
      );

      consoleErrorSpy.mockRestore();
    });

    it('should reset initPromise on initialization failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (duckDBManager as any).duckdbModule = mockDuckDBModule;

      global.fetch = vi.fn(() => Promise.reject(new Error('Network error'))) as any;

      await expect((duckDBManager as any).doInitialize()).rejects.toThrow();

      expect((duckDBManager as any).initPromise).toBeNull();

      consoleErrorSpy.mockRestore();
    });
  });
});
