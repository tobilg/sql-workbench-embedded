import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { duckDBManager } from '../duckdb-manager';

describe('initQueries feature', () => {
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

    // Reset manager state
    (duckDBManager as any).db = null;
    (duckDBManager as any).connection = null;
    (duckDBManager as any).initPromise = null;
    (duckDBManager as any).registeredFiles = new Set();
    (duckDBManager as any).duckdbModule = null;

    // Reset init queries state
    (duckDBManager as any).initQueriesExecuted = false;
    (duckDBManager as any).initQueriesPromise = null;
    (duckDBManager as any).initQueries = [];

    // Reset config to defaults
    (duckDBManager as any).config = {
      version: '1.31.1-dev1.0',
      cdn: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm',
    };

    // Mock DuckDB module loading
    vi.doMock('@duckdb/duckdb-wasm', () => mockDuckDBModule);

    // Mock successful query responses by default
    mockConnection.query.mockResolvedValue({
      schema: { fields: [] },
      numRows: 0,
      numCols: 0,
      getChildAt: () => ({ get: () => null }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('configureInitQueries', () => {
    it('should configure init queries before execution', () => {
      const queries = ['INSTALL spatial', 'LOAD spatial'];

      duckDBManager.configureInitQueries(queries);

      expect((duckDBManager as any).initQueries).toEqual(queries);
    });

    it('should warn if init queries already executed', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mark as executed
      (duckDBManager as any).initQueriesExecuted = true;

      duckDBManager.configureInitQueries(['INSTALL spatial']);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Init queries already executed, configuration will not take effect'
      );
      consoleWarnSpy.mockRestore();
    });

    it('should allow reconfiguration before execution', () => {
      duckDBManager.configureInitQueries(['INSTALL spatial']);
      duckDBManager.configureInitQueries(['INSTALL json']);

      expect((duckDBManager as any).initQueries).toEqual(['INSTALL json']);
    });

    it('should handle empty array', () => {
      duckDBManager.configureInitQueries([]);

      expect((duckDBManager as any).initQueries).toEqual([]);
    });
  });

  describe('executeInitQueries', () => {
    beforeEach(() => {
      // Set up initialized state
      (duckDBManager as any).db = mockDb;
      (duckDBManager as any).connection = mockConnection;
    });

    it('should skip execution if no init queries configured', async () => {
      await (duckDBManager as any).executeInitQueries();

      expect(mockConnection.query).not.toHaveBeenCalled();
      expect((duckDBManager as any).initQueriesExecuted).toBe(true);
    });

    it('should execute init queries in order', async () => {
      const queries = [
        'INSTALL spatial',
        'LOAD spatial',
        'SET memory_limit=\'2GB\'',
      ];

      duckDBManager.configureInitQueries(queries);

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await (duckDBManager as any).executeInitQueries();

      expect(mockConnection.query).toHaveBeenCalledTimes(3);
      expect(mockConnection.query).toHaveBeenNthCalledWith(1, 'INSTALL spatial');
      expect(mockConnection.query).toHaveBeenNthCalledWith(2, 'LOAD spatial');
      expect(mockConnection.query).toHaveBeenNthCalledWith(3, 'SET memory_limit=\'2GB\'');

      consoleLogSpy.mockRestore();
    });

    it('should mark init queries as executed after success', async () => {
      duckDBManager.configureInitQueries(['INSTALL spatial']);

      await (duckDBManager as any).executeInitQueries();

      expect((duckDBManager as any).initQueriesExecuted).toBe(true);
    });

    it('should skip if already executed', async () => {
      duckDBManager.configureInitQueries(['INSTALL spatial']);

      await (duckDBManager as any).executeInitQueries();
      await (duckDBManager as any).executeInitQueries();

      // Should only execute once
      expect(mockConnection.query).toHaveBeenCalledTimes(1);
    });

    it('should log execution progress', async () => {
      duckDBManager.configureInitQueries(['INSTALL spatial', 'LOAD spatial']);

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await (duckDBManager as any).executeInitQueries();

      expect(consoleLogSpy).toHaveBeenCalledWith('Executing 2 initialization queries...');
      expect(consoleLogSpy).toHaveBeenCalledWith('Init query [1/2]: INSTALL spatial');
      expect(consoleLogSpy).toHaveBeenCalledWith('Init query [2/2]: LOAD spatial');
      expect(consoleLogSpy).toHaveBeenCalledWith('Initialization queries completed successfully');

      consoleLogSpy.mockRestore();
    });

    it('should handle errors and allow retry', async () => {
      duckDBManager.configureInitQueries(['INVALID SQL']);

      mockConnection.query.mockRejectedValueOnce(new Error('Syntax error'));

      await expect((duckDBManager as any).executeInitQueries()).rejects.toThrow(
        'Initialization query failed: Syntax error'
      );

      // Should reset state to allow retry
      expect((duckDBManager as any).initQueriesPromise).toBeNull();
      expect((duckDBManager as any).initQueriesExecuted).toBe(false);
    });

    it('should handle race conditions with promise tracking', async () => {
      duckDBManager.configureInitQueries(['INSTALL spatial', 'LOAD spatial']);

      // Simulate concurrent calls
      const promise1 = (duckDBManager as any).executeInitQueries();
      const promise2 = (duckDBManager as any).executeInitQueries();

      await Promise.all([promise1, promise2]);

      // Should only execute once despite concurrent calls
      expect(mockConnection.query).toHaveBeenCalledTimes(2); // 2 queries, not 4
    });
  });

  describe('integration with query() method', () => {
    beforeEach(() => {
      (duckDBManager as any).db = mockDb;
      (duckDBManager as any).connection = mockConnection;

      // Mock query result
      mockConnection.query.mockResolvedValue({
        schema: {
          fields: [{ name: 'result', type: { toString: () => 'Int32' } }],
        },
        numRows: 1,
        numCols: 1,
        getChildAt: () => ({ get: () => 42 }),
      });
    });

    it('should execute init queries before user query', async () => {
      duckDBManager.configureInitQueries(['INSTALL spatial', 'LOAD spatial']);

      await duckDBManager.query('SELECT 42 AS result');

      // Init queries + user query
      expect(mockConnection.query).toHaveBeenCalledTimes(3);
      expect(mockConnection.query).toHaveBeenNthCalledWith(1, 'INSTALL spatial');
      expect(mockConnection.query).toHaveBeenNthCalledWith(2, 'LOAD spatial');
      expect(mockConnection.query).toHaveBeenNthCalledWith(3, 'SELECT 42 AS result');
    });

    it('should not re-execute init queries on subsequent user queries', async () => {
      duckDBManager.configureInitQueries(['INSTALL spatial']);

      await duckDBManager.query('SELECT 1');
      await duckDBManager.query('SELECT 2');

      // Init query once + 2 user queries
      expect(mockConnection.query).toHaveBeenCalledTimes(3);
      expect(mockConnection.query).toHaveBeenNthCalledWith(1, 'INSTALL spatial');
      expect(mockConnection.query).toHaveBeenNthCalledWith(2, 'SELECT 1');
      expect(mockConnection.query).toHaveBeenNthCalledWith(3, 'SELECT 2');
    });

    it('should block user query if init query fails', async () => {
      duckDBManager.configureInitQueries(['INVALID SQL']);

      mockConnection.query
        .mockRejectedValueOnce(new Error('Syntax error'))
        .mockResolvedValueOnce({
          schema: { fields: [{ name: 'result', type: { toString: () => 'Int32' } }] },
          numRows: 1,
          numCols: 1,
          getChildAt: () => ({ get: () => 42 }),
        });

      await expect(duckDBManager.query('SELECT 42')).rejects.toThrow(
        'Initialization query failed: Syntax error'
      );

      // User query should not be executed
      expect(mockConnection.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('extension installation scenarios', () => {
    beforeEach(() => {
      (duckDBManager as any).db = mockDb;
      (duckDBManager as any).connection = mockConnection;
    });

    it('should install and load spatial extension', async () => {
      duckDBManager.configureInitQueries([
        'INSTALL spatial',
        'LOAD spatial',
      ]);

      await (duckDBManager as any).executeInitQueries();

      expect(mockConnection.query).toHaveBeenNthCalledWith(1, 'INSTALL spatial');
      expect(mockConnection.query).toHaveBeenNthCalledWith(2, 'LOAD spatial');
    });

    it('should install and load community extension (a5)', async () => {
      duckDBManager.configureInitQueries([
        'INSTALL a5 FROM community',
        'LOAD a5',
      ]);

      await (duckDBManager as any).executeInitQueries();

      expect(mockConnection.query).toHaveBeenNthCalledWith(1, 'INSTALL a5 FROM community');
      expect(mockConnection.query).toHaveBeenNthCalledWith(2, 'LOAD a5');
    });

    it('should install multiple extensions', async () => {
      duckDBManager.configureInitQueries([
        'INSTALL spatial',
        'LOAD spatial',
        'INSTALL a5 FROM community',
        'LOAD a5',
        'INSTALL json',
        'LOAD json',
      ]);

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await (duckDBManager as any).executeInitQueries();

      expect(mockConnection.query).toHaveBeenCalledTimes(6);
      expect(consoleLogSpy).toHaveBeenCalledWith('Executing 6 initialization queries...');

      consoleLogSpy.mockRestore();
    });

    it('should handle extension already installed scenario', async () => {
      // Simulate extension already installed (no error)
      duckDBManager.configureInitQueries([
        'INSTALL spatial',
        'LOAD spatial',
      ]);

      await expect((duckDBManager as any).executeInitQueries()).resolves.not.toThrow();
    });
  });

  describe('configuration options scenarios', () => {
    beforeEach(() => {
      (duckDBManager as any).db = mockDb;
      (duckDBManager as any).connection = mockConnection;
    });

    it('should set memory limit via init queries', async () => {
      duckDBManager.configureInitQueries([
        "SET memory_limit='2GB'",
      ]);

      await (duckDBManager as any).executeInitQueries();

      expect(mockConnection.query).toHaveBeenCalledWith("SET memory_limit='2GB'");
    });

    it('should set multiple configuration options', async () => {
      duckDBManager.configureInitQueries([
        "SET memory_limit='2GB'",
        'SET threads=4',
        'SET temp_directory=\'/tmp/duckdb\'',
      ]);

      await (duckDBManager as any).executeInitQueries();

      expect(mockConnection.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('user-defined functions scenarios', () => {
    beforeEach(() => {
      (duckDBManager as any).db = mockDb;
      (duckDBManager as any).connection = mockConnection;
    });

    it('should create macros via init queries', async () => {
      duckDBManager.configureInitQueries([
        'CREATE MACRO add_tax(price, rate) AS price * (1 + rate)',
        'CREATE MACRO full_name(first, last) AS first || \' \' || last',
      ]);

      await (duckDBManager as any).executeInitQueries();

      expect(mockConnection.query).toHaveBeenCalledWith(
        'CREATE MACRO add_tax(price, rate) AS price * (1 + rate)'
      );
      expect(mockConnection.query).toHaveBeenCalledWith(
        'CREATE MACRO full_name(first, last) AS first || \' \' || last'
      );
    });

    it('should create spatial helper macro', async () => {
      duckDBManager.configureInitQueries([
        'INSTALL spatial',
        'LOAD spatial',
        'CREATE MACRO distance_km(lat1, lon1, lat2, lon2) AS ST_Distance(ST_Point(lon1, lat1), ST_Point(lon2, lat2)) / 1000',
      ]);

      await (duckDBManager as any).executeInitQueries();

      expect(mockConnection.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('close() method resets init queries state', () => {
    it('should reset init queries state on close', async () => {
      (duckDBManager as any).db = mockDb;
      (duckDBManager as any).connection = mockConnection;

      duckDBManager.configureInitQueries(['INSTALL spatial']);
      await (duckDBManager as any).executeInitQueries();

      expect((duckDBManager as any).initQueriesExecuted).toBe(true);

      await duckDBManager.close();

      expect((duckDBManager as any).initQueriesExecuted).toBe(false);
      expect((duckDBManager as any).initQueriesPromise).toBeNull();
      expect((duckDBManager as any).initQueries).toEqual([]);
    });

    it('should allow re-execution after close', async () => {
      (duckDBManager as any).db = mockDb;
      (duckDBManager as any).connection = mockConnection;

      duckDBManager.configureInitQueries(['INSTALL spatial']);
      await (duckDBManager as any).executeInitQueries();

      await duckDBManager.close();

      // Reinitialize
      (duckDBManager as any).db = mockDb;
      (duckDBManager as any).connection = mockConnection;

      // Should be able to execute again
      duckDBManager.configureInitQueries(['INSTALL json']);
      await (duckDBManager as any).executeInitQueries();

      expect(mockConnection.query).toHaveBeenLastCalledWith('INSTALL json');
    });
  });

  describe('error handling edge cases', () => {
    beforeEach(() => {
      (duckDBManager as any).db = mockDb;
      (duckDBManager as any).connection = mockConnection;
    });

    it('should handle error in middle of multi-query execution', async () => {
      duckDBManager.configureInitQueries([
        'INSTALL spatial',
        'INVALID SQL',
        'LOAD spatial',
      ]);

      mockConnection.query
        .mockResolvedValueOnce({ schema: { fields: [] }, numRows: 0, numCols: 0, getChildAt: () => ({ get: () => null }) })
        .mockRejectedValueOnce(new Error('Syntax error'));

      await expect((duckDBManager as any).executeInitQueries()).rejects.toThrow(
        'Initialization query failed: Syntax error'
      );

      // Should stop at error, not execute third query
      expect(mockConnection.query).toHaveBeenCalledTimes(2);
    });

    it('should handle non-Error objects in catch block', async () => {
      duckDBManager.configureInitQueries(['INSTALL spatial']);

      mockConnection.query.mockRejectedValueOnce('String error');

      await expect((duckDBManager as any).executeInitQueries()).rejects.toThrow(
        'Initialization query failed: String error'
      );
    });
  });

  describe('real-world scenarios', () => {
    beforeEach(() => {
      (duckDBManager as any).db = mockDb;
      (duckDBManager as any).connection = mockConnection;
    });

    it('should support full spatial + a5 setup for geospatial analysis', async () => {
      const queries = [
        'INSTALL spatial',
        'LOAD spatial',
        'INSTALL a5 FROM community',
        'LOAD a5',
        'CREATE MACRO cell_to_geojson(lat, lon, resolution) AS ST_AsGeoJSON(ST_MakePolygon(ST_MakeLine(list_transform(a5_cell_to_boundary(a5_lonlat_to_cell(lon, lat, resolution)), x -> ST_Point(x[1], x[2])))))',
      ];

      duckDBManager.configureInitQueries(queries);

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await (duckDBManager as any).executeInitQueries();

      expect(mockConnection.query).toHaveBeenCalledTimes(5);
      expect(consoleLogSpy).toHaveBeenCalledWith('Executing 5 initialization queries...');

      consoleLogSpy.mockRestore();
    });

    it('should support data science workflow with multiple extensions', async () => {
      const queries = [
        'INSTALL httpfs',
        'LOAD httpfs',
        'INSTALL json',
        'LOAD json',
        'INSTALL parquet',
        'LOAD parquet',
        "SET memory_limit='4GB'",
        'SET threads=8',
      ];

      duckDBManager.configureInitQueries(queries);

      await (duckDBManager as any).executeInitQueries();

      expect(mockConnection.query).toHaveBeenCalledTimes(8);
    });
  });
});
