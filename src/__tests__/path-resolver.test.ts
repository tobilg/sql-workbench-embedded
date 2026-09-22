import { describe, it, expect, beforeEach } from 'vitest';
import { resolvePath, extractFilePaths, resolvePathsInSQL, rewriteFilePaths } from '../path-resolver';
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

  describe('rewriteFilePaths', () => {
    it('rewrites table references while preserving matching values, comments, and reader options', () => {
      const sql = `SELECT 'data.csv', $$FROM 'ignore.csv'$$
        -- FROM 'comment.csv'
        FROM /* JOIN 'comment2.csv' */ read_csv('data.csv', nullstr = 'data.csv')
        WHERE name = 'data.csv'`;
      const paths = resolvePathsInSQL(sql, options);
      expect([...paths.keys()]).toEqual(['data.csv']);
      expect(rewriteFilePaths(sql, paths)).toBe(sql.replace("read_csv('data.csv'", "read_csv('https://data.sql-workbench.com/data.csv'"));
    });

    it('resolves nested queries, comma joins, reader lists, and signed URLs', () => {
      const sql = `WITH c AS (SELECT * FROM './one.csv')
        SELECT * FROM c, read_parquet(['nested/two.parquet', 'three.parquet?token=abc'])
        JOIN 'four.json' USING (id)`;
      const paths = resolvePathsInSQL(sql, options);
      expect([...paths.keys()]).toEqual(['./one.csv', 'nested/two.parquet', 'three.parquet?token=abc', 'four.json']);
      const rewritten = rewriteFilePaths(sql, paths);
      expect(rewritten).toContain("FROM 'https://data.sql-workbench.com/one.csv'");
      expect(rewritten).toContain("['https://data.sql-workbench.com/nested/two.parquet', 'https://data.sql-workbench.com/three.parquet?token=abc']");
      expect(rewritten).toContain("JOIN 'https://data.sql-workbench.com/four.json'");
    });

    it('preserves quoted filenames and escapes apostrophes in resolved URLs', () => {
      const sql = `SELECT * FROM 'O''Brien.csv' JOIN "two.csv" USING (id)`;
      const paths = resolvePathsInSQL(sql, options);
      expect(rewriteFilePaths(sql, paths)).toBe(`SELECT * FROM 'https://data.sql-workbench.com/O''Brien.csv' JOIN "https://data.sql-workbench.com/two.csv" USING (id)`);
    });

    it('does not treat FROM inside scalar functions as a table reference', () => {
      const sql = `SELECT trim('x' FROM 'data.csv'), (SELECT count(*) FROM 'other.csv')`;
      expect(extractFilePaths(sql)).toEqual(['other.csv']);
      expect(rewriteFilePaths(sql, resolvePathsInSQL(sql, options))).toBe(`SELECT trim('x' FROM 'data.csv'), (SELECT count(*) FROM 'https://data.sql-workbench.com/other.csv')`);
    });

    it('leaves computed reader arguments untouched', () => {
      const sql = `SELECT * FROM read_csv('prefix/' || 'data.csv'), read_csv('other.csv' || suffix)`;
      expect(extractFilePaths(sql)).toEqual([]);
      expect(rewriteFilePaths(sql, new Map([['data.csv', 'https://example.com/data.csv']]))).toBe(sql);
    });

    it('normalizes dot segments and encodes spaces using URL semantics', () => {
      expect(resolvePath('../nested/my data.csv', { baseUrl: 'https://example.com/a/b' })).toBe('https://example.com/a/nested/my%20data.csv');
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
