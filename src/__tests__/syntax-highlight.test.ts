import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { highlightSQL, debounce } from '../syntax-highlight';

describe('syntax-highlight', () => {
  describe('highlightSQL', () => {
    it('should highlight SQL keywords', () => {
      const sql = 'SELECT * FROM users';
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain('<span class="sql-keyword">SELECT</span>');
      expect(highlighted).toContain('<span class="sql-keyword">FROM</span>');
    });

    it('should highlight lowercase keywords', () => {
      const sql = 'select * from users';
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain('<span class="sql-keyword">select</span>');
      expect(highlighted).toContain('<span class="sql-keyword">from</span>');
    });

    it('should highlight mixed case keywords', () => {
      const sql = 'SeLeCt * FrOm users';
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain('<span class="sql-keyword">SeLeCt</span>');
      expect(highlighted).toContain('<span class="sql-keyword">FrOm</span>');
    });

    it('should highlight string literals with single quotes', () => {
      const sql = "SELECT 'hello world' AS greeting";
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain('<span class="sql-string">\'hello world\'</span>');
    });

    it('should highlight numbers', () => {
      const sql = 'SELECT 42, 3.14, 100';
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain('<span class="sql-number">42</span>');
      expect(highlighted).toContain('<span class="sql-number">3.14</span>');
      expect(highlighted).toContain('<span class="sql-number">100</span>');
    });

    it('should highlight single-line comments with --', () => {
      const sql = 'SELECT * -- This is a comment\nFROM users';
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain('<span class="sql-comment">-- This is a comment</span>');
    });

    it('should highlight single-line comments with #', () => {
      const sql = 'SELECT * # This is a comment\nFROM users';
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain('<span class="sql-comment"># This is a comment</span>');
    });

    it('should highlight multi-line comments', () => {
      const sql = 'SELECT * /* This is a\nmulti-line comment */ FROM users';
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain('<span class="sql-comment">/* This is a\nmulti-line comment */</span>');
    });

    it('should highlight operators', () => {
      const sql = 'SELECT a + b, c - d, e * f, g / h, i = j, k != l, m > n, o < p';
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain('<span class="sql-operator">+</span>');
      expect(highlighted).toContain('<span class="sql-operator">-</span>');
      expect(highlighted).toContain('<span class="sql-operator">*</span>');
      expect(highlighted).toContain('<span class="sql-operator">/</span>');
      expect(highlighted).toContain('<span class="sql-operator">=</span>');
      expect(highlighted).toContain('<span class="sql-operator">!=</span>');
      expect(highlighted).toContain('<span class="sql-operator">&gt;</span>');
      expect(highlighted).toContain('<span class="sql-operator">&lt;</span>');
    });

    it('should preserve whitespace', () => {
      const sql = 'SELECT  *  FROM  users';
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain('&nbsp;&nbsp;'); // Double spaces
    });

    it('should escape HTML special characters', () => {
      const sql = "SELECT '<script>alert(\"XSS\")</script>' AS evil";
      const highlighted = highlightSQL(sql);
      expect(highlighted).not.toContain('<script>');
      expect(highlighted).toContain('&lt;script&gt;');
      // Note: Double quotes inside single-quoted strings are preserved as-is
      // since they don't need HTML escaping in that context
    });

    it('should handle identifiers without highlighting as keywords', () => {
      const sql = 'SELECT user_id, user_name FROM users';
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain('user_id');
      expect(highlighted).toContain('user_name');
      expect(highlighted).not.toContain('<span class="sql-keyword">user_id</span>');
    });

    it('should handle double-quoted identifiers', () => {
      const sql = 'SELECT "user id" FROM users';
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain('"user id"');
    });

    it('should handle backtick identifiers (MySQL style)', () => {
      const sql = 'SELECT `user id` FROM `users`';
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain('`user id`');
      expect(highlighted).toContain('`users`');
    });

    it('should handle escaped characters in strings', () => {
      const sql = "SELECT 'it\\'s working' AS test";
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain("<span class=\"sql-string\">'it\\'s working'</span>");
    });

    it('should handle complex queries', () => {
      const sql = `
        WITH cte AS (
          SELECT id, name, COUNT(*) as count
          FROM users
          WHERE age > 18
          GROUP BY id, name
        )
        SELECT * FROM cte
        WHERE count > 10
        ORDER BY count DESC
        LIMIT 100
      `;
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain('<span class="sql-keyword">WITH</span>');
      expect(highlighted).toContain('<span class="sql-keyword">SELECT</span>');
      expect(highlighted).toContain('<span class="sql-keyword">FROM</span>');
      expect(highlighted).toContain('<span class="sql-keyword">WHERE</span>');
      expect(highlighted).toContain('<span class="sql-keyword">GROUP</span>');
      expect(highlighted).toContain('<span class="sql-keyword">ORDER</span>');
      expect(highlighted).toContain('<span class="sql-keyword">LIMIT</span>');
      expect(highlighted).toContain('<span class="sql-number">18</span>');
      expect(highlighted).toContain('<span class="sql-number">10</span>');
      expect(highlighted).toContain('<span class="sql-number">100</span>');
    });

    it('should handle JOIN keywords', () => {
      const sql = 'SELECT * FROM a INNER JOIN b ON a.id = b.id LEFT JOIN c ON a.id = c.id';
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain('<span class="sql-keyword">INNER</span>');
      expect(highlighted).toContain('<span class="sql-keyword">JOIN</span>');
      expect(highlighted).toContain('<span class="sql-keyword">LEFT</span>');
      expect(highlighted).toContain('<span class="sql-keyword">ON</span>');
    });

    it('should handle aggregate functions', () => {
      const sql = 'SELECT COUNT(*), SUM(amount), AVG(price), MIN(date), MAX(value)';
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain('<span class="sql-keyword">COUNT</span>');
      expect(highlighted).toContain('<span class="sql-keyword">SUM</span>');
      expect(highlighted).toContain('<span class="sql-keyword">AVG</span>');
      expect(highlighted).toContain('<span class="sql-keyword">MIN</span>');
      expect(highlighted).toContain('<span class="sql-keyword">MAX</span>');
    });

    it('should handle window functions', () => {
      const sql = 'SELECT ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary)';
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain('<span class="sql-keyword">ROW_NUMBER</span>');
      expect(highlighted).toContain('<span class="sql-keyword">OVER</span>');
      expect(highlighted).toContain('<span class="sql-keyword">PARTITION</span>');
    });

    it('should handle data types', () => {
      const sql = 'CREATE TABLE users (id INTEGER, name VARCHAR, age BIGINT, balance DECIMAL)';
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain('<span class="sql-keyword">INTEGER</span>');
      expect(highlighted).toContain('<span class="sql-keyword">VARCHAR</span>');
      expect(highlighted).toContain('<span class="sql-keyword">BIGINT</span>');
      expect(highlighted).toContain('<span class="sql-keyword">DECIMAL</span>');
    });

    it('should handle boolean literals', () => {
      const sql = 'SELECT TRUE, FALSE';
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain('<span class="sql-keyword">TRUE</span>');
      expect(highlighted).toContain('<span class="sql-keyword">FALSE</span>');
    });

    it('should handle NULL keyword', () => {
      const sql = 'SELECT * FROM users WHERE email IS NULL';
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain('<span class="sql-keyword">IS</span>');
      expect(highlighted).toContain('<span class="sql-keyword">NULL</span>');
    });

    it('should handle CASE expressions', () => {
      const sql = 'SELECT CASE WHEN age > 18 THEN \'adult\' ELSE \'minor\' END';
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain('<span class="sql-keyword">CASE</span>');
      expect(highlighted).toContain('<span class="sql-keyword">WHEN</span>');
      expect(highlighted).toContain('<span class="sql-keyword">THEN</span>');
      expect(highlighted).toContain('<span class="sql-keyword">ELSE</span>');
      expect(highlighted).toContain('<span class="sql-keyword">END</span>');
    });

    it('should handle empty string', () => {
      const sql = '';
      const highlighted = highlightSQL(sql);
      expect(highlighted).toBe('');
    });

    it('should handle newlines', () => {
      const sql = 'SELECT *\nFROM users\nWHERE id = 1';
      const highlighted = highlightSQL(sql);
      expect(highlighted).toContain('\n');
    });

    it('should preserve leading spaces', () => {
      const sql = '  SELECT * FROM users';
      const highlighted = highlightSQL(sql);
      expect(highlighted.startsWith('&nbsp;&nbsp;')).toBe(true);
    });

    it('should preserve trailing spaces', () => {
      const sql = 'SELECT * FROM users  ';
      const highlighted = highlightSQL(sql);
      expect(highlighted.endsWith('&nbsp;&nbsp;')).toBe(true);
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should delay function execution', () => {
      const func = vi.fn();
      const debounced = debounce(func, 150);

      debounced();
      expect(func).not.toHaveBeenCalled();

      vi.advanceTimersByTime(150);
      expect(func).toHaveBeenCalledTimes(1);
    });

    it('should cancel previous calls', () => {
      const func = vi.fn();
      const debounced = debounce(func, 150);

      debounced();
      vi.advanceTimersByTime(100);
      debounced();
      vi.advanceTimersByTime(100);
      debounced();

      expect(func).not.toHaveBeenCalled();

      vi.advanceTimersByTime(150);
      expect(func).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to the debounced function', () => {
      const func = vi.fn();
      const debounced = debounce(func, 150);

      debounced('arg1', 'arg2', 'arg3');
      vi.advanceTimersByTime(150);

      expect(func).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
    });

    it('should use the latest arguments when called multiple times', () => {
      const func = vi.fn();
      const debounced = debounce(func, 150);

      debounced('first');
      vi.advanceTimersByTime(100);
      debounced('second');
      vi.advanceTimersByTime(100);
      debounced('third');
      vi.advanceTimersByTime(150);

      expect(func).toHaveBeenCalledTimes(1);
      expect(func).toHaveBeenCalledWith('third');
    });

    it('should allow multiple executions after wait time', () => {
      const func = vi.fn();
      const debounced = debounce(func, 150);

      debounced('first');
      vi.advanceTimersByTime(150);

      debounced('second');
      vi.advanceTimersByTime(150);

      debounced('third');
      vi.advanceTimersByTime(150);

      expect(func).toHaveBeenCalledTimes(3);
      expect(func).toHaveBeenNthCalledWith(1, 'first');
      expect(func).toHaveBeenNthCalledWith(2, 'second');
      expect(func).toHaveBeenNthCalledWith(3, 'third');
    });

    it('should work with different wait times', () => {
      const func1 = vi.fn();
      const func2 = vi.fn();
      const debounced1 = debounce(func1, 100);
      const debounced2 = debounce(func2, 200);

      debounced1();
      debounced2();

      vi.advanceTimersByTime(100);
      expect(func1).toHaveBeenCalledTimes(1);
      expect(func2).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(func2).toHaveBeenCalledTimes(1);
    });
  });
});
