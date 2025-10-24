/**
 * Simplified SQL syntax highlighter
 * Based on sql-highlight concepts, inlined for bundle size optimization
 */

const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'FULL',
  'ON', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'LIKE', 'BETWEEN', 'AS',
  'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT', 'ALL',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'DROP',
  'ALTER', 'TABLE', 'DATABASE', 'INDEX', 'VIEW', 'UNION', 'CASE', 'WHEN',
  'THEN', 'ELSE', 'END', 'EXISTS', 'WITH', 'RECURSIVE', 'CAST', 'DESC', 'ASC',
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'FLOOR', 'CEIL', 'ABS',
  'UPPER', 'LOWER', 'TRIM', 'SUBSTRING', 'CONCAT', 'LENGTH', 'COALESCE',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'CHECK', 'DEFAULT',
  'AUTO_INCREMENT', 'CONSTRAINT', 'CASCADE', 'NULLS', 'FIRST', 'LAST',
  'PARTITION', 'OVER', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LEAD', 'LAG',
  'FIRST_VALUE', 'LAST_VALUE', 'WINDOW', 'ROWS', 'RANGE', 'PRECEDING',
  'FOLLOWING', 'CURRENT', 'UNBOUNDED', 'EXTRACT', 'DATE', 'TIME', 'TIMESTAMP',
  'INTERVAL', 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND',
  'TRUE', 'FALSE', 'BOOLEAN', 'INTEGER', 'BIGINT', 'SMALLINT', 'DECIMAL',
  'NUMERIC', 'REAL', 'DOUBLE', 'PRECISION', 'FLOAT', 'VARCHAR', 'CHAR',
  'TEXT', 'BLOB', 'DATE', 'DATETIME', 'ARRAY', 'STRUCT', 'MAP',
]);

/**
 * Escape HTML special characters and preserve spaces
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  let html = div.innerHTML;

  // Replace multiple spaces with non-breaking spaces to preserve formatting
  html = html.replace(/ {2,}/g, (match) => {
    return '&nbsp;'.repeat(match.length);
  });

  // Preserve trailing spaces
  if (text.endsWith(' ')) {
    html = html.replace(/ +$/, (match) => '&nbsp;'.repeat(match.length));
  }

  // Preserve leading spaces
  if (text.startsWith(' ')) {
    html = html.replace(/^ +/, (match) => '&nbsp;'.repeat(match.length));
  }

  return html;
}

/**
 * Highlight SQL syntax
 */
export function highlightSQL(sql: string): string {
  let result = '';
  let i = 0;

  while (i < sql.length) {
    const char = sql[i];
    if (!char) {
      i++;
      continue;
    }

    // Handle single-line comments (-- and #)
    if ((sql[i] === '-' && sql[i + 1] === '-') || sql[i] === '#') {
      const start = i;
      while (i < sql.length && sql[i] !== '\n') {
        i++;
      }
      const comment = sql.substring(start, i);
      result += `<span class="sql-comment">${escapeHtml(comment)}</span>`;
      continue;
    }

    // Handle multi-line comments (/* ... */)
    if (sql[i] === '/' && sql[i + 1] === '*') {
      const start = i;
      i += 2;
      while (i < sql.length - 1 && !(sql[i] === '*' && sql[i + 1] === '/')) {
        i++;
      }
      i += 2; // Skip closing */
      const comment = sql.substring(start, i);
      result += `<span class="sql-comment">${escapeHtml(comment)}</span>`;
      continue;
    }

    // Handle string literals (single quotes)
    if (sql[i] === "'") {
      const start = i;
      i++;
      while (i < sql.length && sql[i] !== "'") {
        if (sql[i] === '\\') i++; // Skip escaped characters
        i++;
      }
      i++; // Include closing quote
      const str = sql.substring(start, i);
      result += `<span class="sql-string">${escapeHtml(str)}</span>`;
      continue;
    }

    // Handle double-quoted identifiers
    if (sql[i] === '"') {
      const start = i;
      i++;
      while (i < sql.length && sql[i] !== '"') {
        if (sql[i] === '\\') i++; // Skip escaped characters
        i++;
      }
      i++; // Include closing quote
      const str = sql.substring(start, i);
      result += escapeHtml(str);
      continue;
    }

    // Handle backtick identifiers (MySQL style)
    if (sql[i] === '`') {
      const start = i;
      i++;
      while (i < sql.length && sql[i] !== '`') {
        i++;
      }
      i++; // Include closing backtick
      const str = sql.substring(start, i);
      result += escapeHtml(str);
      continue;
    }

    // Handle numbers
    if (/\d/.test(char)) {
      const start = i;
      while (i < sql.length) {
        const nextChar = sql[i];
        if (!nextChar || !/[\d.]/.test(nextChar)) break;
        i++;
      }
      const num = sql.substring(start, i);
      result += `<span class="sql-number">${escapeHtml(num)}</span>`;
      continue;
    }

    // Handle operators
    if (/[+\-*/<>=!]/.test(char)) {
      let op = char;
      i++;
      // Check for multi-character operators
      const nextChar = sql[i];
      if (i < sql.length && nextChar && /[=<>]/.test(nextChar)) {
        op += nextChar;
        i++;
      }
      result += `<span class="sql-operator">${escapeHtml(op)}</span>`;
      continue;
    }

    // Handle identifiers and keywords
    if (/[a-zA-Z_]/.test(char)) {
      const start = i;
      while (i < sql.length) {
        const nextChar = sql[i];
        if (!nextChar || !/[a-zA-Z0-9_]/.test(nextChar)) break;
        i++;
      }
      const word = sql.substring(start, i);
      const upperWord = word.toUpperCase();

      if (SQL_KEYWORDS.has(upperWord)) {
        result += `<span class="sql-keyword">${escapeHtml(word)}</span>`;
      } else {
        result += escapeHtml(word);
      }
      continue;
    }

    // Default: output character as-is
    result += escapeHtml(char);
    i++;
  }

  return result;
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function debounced(...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
