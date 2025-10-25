import { describe, it, expect, beforeEach } from 'vitest';
import { resolvePath, extractFilePaths, resolvePathsInSQL } from '../path-resolver';
import type { PathResolutionOptions } from '../path-resolver';

describe('path-resolver', () => {
  let options: PathResolutionOptions;

  beforeEach(() => {
    options = {
      baseUrl: 'https://data.sql-workbench.com',
    };
    // Mock window.location.origin
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost:3000',
      },
      writable: true,
    });
  });

  describe('resolvePath', () => {
    it('should return absolute HTTP URLs unchanged', () => {
      const path = 'http://example.com/data.parquet';
      expect(resolvePath(path, options)).toBe(path);
    });

    it('should return absolute HTTPS URLs unchanged', () => {
      const path = 'https://example.com/data.parquet';
      expect(resolvePath(path, options)).toBe(path);
    });

    it('should resolve absolute paths from origin', () => {
      const path = '/data.parquet';
      expect(resolvePath(path, options)).toBe('http://localhost:3000/data.parquet');
    });

    it('should resolve relative paths against baseUrl', () => {
      const path = 'data.parquet';
      expect(resolvePath(path, options)).toBe('https://data.sql-workbench.com/data.parquet');
    });

    it('should resolve explicit relative paths (./) against baseUrl', () => {
      const path = './data.parquet';
      expect(resolvePath(path, options)).toBe('https://data.sql-workbench.com/data.parquet');
    });

    it('should handle baseUrl with trailing slash', () => {
      const pathOptions = { baseUrl: 'https://data.sql-workbench.com/' };
      const path = 'data.parquet';
      expect(resolvePath(path, pathOptions)).toBe('https://data.sql-workbench.com/data.parquet');
    });

    it('should handle nested relative paths', () => {
      const path = 'datasets/sales/data.parquet';
      expect(resolvePath(path, options)).toBe(
        'https://data.sql-workbench.com/datasets/sales/data.parquet'
      );
    });

    it('should handle nested explicit relative paths', () => {
      const path = './datasets/sales/data.parquet';
      expect(resolvePath(path, options)).toBe(
        'https://data.sql-workbench.com/datasets/sales/data.parquet'
      );
    });

    it('should handle nested absolute paths', () => {
      const path = '/datasets/sales/data.parquet';
      expect(resolvePath(path, options)).toBe(
        'http://localhost:3000/datasets/sales/data.parquet'
      );
    });
  });

  describe('extractFilePaths', () => {
    it('should extract parquet file from single-quoted FROM clause', () => {
      const sql = "SELECT * FROM 'data.parquet'";
      expect(extractFilePaths(sql)).toEqual(['data.parquet']);
    });

    it('should extract parquet file from double-quoted FROM clause', () => {
      const sql = 'SELECT * FROM "data.parquet"';
      expect(extractFilePaths(sql)).toEqual(['data.parquet']);
    });

    it('should extract CSV file from read_csv function', () => {
      const sql = "SELECT * FROM read_csv('data.csv')";
      expect(extractFilePaths(sql)).toEqual(['data.csv']);
    });

    it('should extract JSON file from read_json function', () => {
      const sql = "SELECT * FROM read_json('data.json')";
      expect(extractFilePaths(sql)).toEqual(['data.json']);
    });

    it('should extract Arrow file', () => {
      const sql = "SELECT * FROM 'data.arrow'";
      expect(extractFilePaths(sql)).toEqual(['data.arrow']);
    });

    it('should extract multiple files', () => {
      const sql = `
        SELECT * FROM 'sales.parquet'
        UNION ALL
        SELECT * FROM 'customers.parquet'
      `;
      const paths = extractFilePaths(sql);
      expect(paths).toContain('sales.parquet');
      expect(paths).toContain('customers.parquet');
      expect(paths).toHaveLength(2);
    });

    it('should extract files with relative paths', () => {
      const sql = "SELECT * FROM './datasets/data.parquet'";
      expect(extractFilePaths(sql)).toEqual(['./datasets/data.parquet']);
    });

    it('should extract files with absolute paths', () => {
      const sql = "SELECT * FROM '/data/sales.parquet'";
      expect(extractFilePaths(sql)).toEqual(['/data/sales.parquet']);
    });

    it('should extract files from read_parquet function', () => {
      const sql = "SELECT * FROM read_parquet('data.parquet')";
      expect(extractFilePaths(sql)).toEqual(['data.parquet']);
    });

    it('should deduplicate file paths', () => {
      const sql = `
        SELECT * FROM 'data.parquet'
        UNION ALL
        SELECT * FROM 'data.parquet'
      `;
      expect(extractFilePaths(sql)).toEqual(['data.parquet']);
    });

    it('should handle mixed quote styles', () => {
      const sql = `
        SELECT * FROM 'sales.parquet'
        JOIN "customers.csv" ON true
      `;
      const paths = extractFilePaths(sql);
      expect(paths).toContain('sales.parquet');
      expect(paths).toContain('customers.csv');
      expect(paths).toHaveLength(2);
    });

    it('should return empty array for SQL without file references', () => {
      const sql = 'SELECT 1 + 1 AS result';
      expect(extractFilePaths(sql)).toEqual([]);
    });

    it('should ignore strings without supported file extensions', () => {
      const sql = "SELECT * FROM 'some_table' WHERE name = 'test.txt'";
      expect(extractFilePaths(sql)).toEqual([]);
    });

    it('should handle multiple files in complex query', () => {
      const sql = `
        WITH sales AS (
          SELECT * FROM 'sales.parquet'
        ),
        products AS (
          SELECT * FROM read_csv('products.csv')
        )
        SELECT * FROM sales
        JOIN products ON sales.product_id = products.id
        WHERE region IN (SELECT region FROM "regions.json")
      `;
      const paths = extractFilePaths(sql);
      expect(paths).toContain('sales.parquet');
      expect(paths).toContain('products.csv');
      expect(paths).toContain('regions.json');
      expect(paths).toHaveLength(3);
    });

    it('should handle case-insensitive file extensions', () => {
      const sql = `
        SELECT * FROM 'data.PARQUET'
        UNION ALL
        SELECT * FROM 'data.CSV'
      `;
      const paths = extractFilePaths(sql);
      expect(paths).toContain('data.PARQUET');
      expect(paths).toContain('data.CSV');
      expect(paths).toHaveLength(2);
    });
  });

  describe('resolvePathsInSQL', () => {
    it('should resolve all paths in SQL query', () => {
      const sql = `
        SELECT * FROM 'sales.parquet'
        JOIN './customers.csv' ON true
      `;
      const pathMap = resolvePathsInSQL(sql, options);
      expect(pathMap.get('sales.parquet')).toBe(
        'https://data.sql-workbench.com/sales.parquet'
      );
      expect(pathMap.get('./customers.csv')).toBe(
        'https://data.sql-workbench.com/customers.csv'
      );
    });

    it('should handle mixed path types', () => {
      const sql = `
        SELECT * FROM 'data.parquet'
        JOIN '/absolute/path.csv' ON true
        JOIN 'https://example.com/remote.json' ON true
      `;
      const pathMap = resolvePathsInSQL(sql, options);
      expect(pathMap.get('data.parquet')).toBe(
        'https://data.sql-workbench.com/data.parquet'
      );
      expect(pathMap.get('/absolute/path.csv')).toBe(
        'http://localhost:3000/absolute/path.csv'
      );
      expect(pathMap.get('https://example.com/remote.json')).toBe(
        'https://example.com/remote.json'
      );
    });

    it('should return empty map for SQL without file references', () => {
      const sql = 'SELECT 1 + 1 AS result';
      const pathMap = resolvePathsInSQL(sql, options);
      expect(pathMap.size).toBe(0);
    });

    it('should handle duplicate paths', () => {
      const sql = `
        SELECT * FROM 'data.parquet'
        UNION ALL
        SELECT * FROM 'data.parquet'
      `;
      const pathMap = resolvePathsInSQL(sql, options);
      expect(pathMap.size).toBe(1);
      expect(pathMap.get('data.parquet')).toBe(
        'https://data.sql-workbench.com/data.parquet'
      );
    });

    it('should handle complex nested queries', () => {
      const sql = `
        WITH cte AS (
          SELECT * FROM read_parquet('source.parquet')
          WHERE id IN (SELECT id FROM './filter.csv')
        )
        SELECT * FROM cte
        JOIN "reference.json" ON cte.ref = reference.id
      `;
      const pathMap = resolvePathsInSQL(sql, options);
      expect(pathMap.size).toBe(3);
      expect(pathMap.get('source.parquet')).toBe(
        'https://data.sql-workbench.com/source.parquet'
      );
      expect(pathMap.get('./filter.csv')).toBe(
        'https://data.sql-workbench.com/filter.csv'
      );
      expect(pathMap.get('reference.json')).toBe(
        'https://data.sql-workbench.com/reference.json'
      );
    });
  });
});
