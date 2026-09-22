/** Resolve file references without changing ordinary SQL strings or comments. */
export interface PathResolutionOptions {
  baseUrl: string;
}

export function resolvePath(path: string, options: PathResolutionOptions): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/')) return new URL(path, window.location.origin).href;
  return new URL(path, `${options.baseUrl.replace(/\/$/, '')}/`).href;
}

interface Token {
  start: number;
  end: number;
  value: string;
  quote?: string;
}

function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < sql.length) {
    const start = i;
    const char = sql[i]!;
    if (/\s/.test(char)) { i++; continue; }
    if (sql.startsWith('--', i)) {
      while (i < sql.length && sql[i] !== '\n') i++;
      continue;
    }
    if (sql.startsWith('/*', i)) {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth) {
        if (sql.startsWith('/*', i)) { depth++; i += 2; }
        else if (sql.startsWith('*/', i)) { depth--; i += 2; }
        else i++;
      }
      continue;
    }
    const dollar = char === '$' ? sql.slice(i).match(/^\$(?:[A-Za-z_][\w]*)?\$/)?.[0] : undefined;
    if (dollar) {
      const end = sql.indexOf(dollar, i + dollar.length);
      i = end < 0 ? sql.length : end + dollar.length;
      tokens.push({ start, end: i, value: '' });
      continue;
    }
    if (char === "'" || char === '"') {
      let value = '';
      i++;
      while (i < sql.length) {
        if (sql[i] === char) {
          i++;
          if (sql[i] !== char) break;
        }
        value += sql[i++];
      }
      tokens.push({ start, end: i, value, quote: char });
    } else if (/[a-z_]/i.test(char)) {
      while (i < sql.length && /[\w$]/.test(sql[i]!)) i++;
      tokens.push({ start, end: i, value: sql.slice(start, i).toUpperCase() });
    } else {
      tokens.push({ start, end: ++i, value: char });
    }
  }
  return tokens;
}

function fileReferences(sql: string): Token[] {
  const tokens = tokenize(sql);
  const files: Token[] = [];
  const frames = [{ from: false, table: false, reader: false, argument: 0, brackets: 0, query: true }];
  const readers = /^(READ_(CSV(_AUTO)?|JSON(_AUTO)?|NDJSON(_AUTO)?|PARQUET|ARROW)|PARQUET_SCAN|CSV_SCAN|JSON_SCAN)$/;
  let previous = '';
  for (const [index, token] of tokens.entries()) {
    const frame = frames[frames.length - 1]!;
    const word = token.value;
    if (token.quote) {
      const readerLiteral = frame.reader && frame.argument === 0 &&
        (previous === '(' || (frame.brackets > 0 && (previous === '[' || previous === ','))) &&
        /^[,\)\]]$/.test(tokens[index + 1]?.value ?? '');
      if ((frame.table || readerLiteral) &&
          /\.(parquet|csv|json|arrow)(?:[?#].*)?$/i.test(word)) files.push(token);
      frame.table = false;
    } else if (word === '(') {
      frame.table = false;
      // FROM inside scalar functions such as trim() is not a table reference.
      const functionCall = /^[A-Z_][\w$]*$/.test(previous) && !/^(AS|IN|EXISTS|FROM|JOIN|LATERAL|NOT)$/.test(previous);
      frames.push({ from: false, table: false, reader: readers.test(previous), argument: 0, brackets: 0, query: !functionCall });
    } else if (word === ')') {
      if (frames.length > 1) frames.pop();
    } else if (word === '[') frame.brackets++;
    else if (word === ']') frame.brackets--;
    else if (word === ',' && frame.brackets === 0) {
      frame.argument++;
      frame.table = frame.from;
    } else if (frame.query && (word === 'FROM' || word === 'JOIN')) {
      frame.from = true;
      frame.table = true;
    } else if (word === 'SELECT') {
      frame.query = true;
      frame.from = false;
      frame.table = false;
    } else if (/^(WHERE|GROUP|ORDER|HAVING|LIMIT|OFFSET|QUALIFY|UNION|EXCEPT|INTERSECT|;)$/i.test(word)) {
      frame.from = false;
      frame.table = false;
    } else frame.table = false;
    previous = token.quote ? '' : word;
  }
  return files;
}

export function extractFilePaths(sql: string): string[] {
  return [...new Set(fileReferences(sql).map(token => token.value))];
}

export function resolvePathsInSQL(sql: string, options: PathResolutionOptions): Map<string, string> {
  return new Map(extractFilePaths(sql).map(path => [path, resolvePath(path, options)]));
}

/** Registered full URLs are also the names used by DuckDB, avoiding basename collisions. */
export function rewriteFilePaths(sql: string, paths: Map<string, string>): string {
  let result = '';
  let offset = 0;
  for (const token of fileReferences(sql)) {
    const path = paths.get(token.value);
    if (!path) continue;
    const quote = token.quote!;
    result += sql.slice(offset, token.start) + quote + path.split(quote).join(quote + quote) + quote;
    offset = token.end;
  }
  return result + sql.slice(offset);
}
