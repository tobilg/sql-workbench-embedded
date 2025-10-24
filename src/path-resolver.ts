/**
 * Path resolution utilities for SQL file references
 */

export interface PathResolutionOptions {
  baseUrl: string;
}

/**
 * Resolve relative file paths to absolute URLs
 *
 * Rules:
 * - 'data.parquet' -> {baseUrl}/data.parquet
 * - './data.parquet' -> {baseUrl}/data.parquet
 * - '/data.parquet' -> {origin}/data.parquet
 * - 'http://...' or 'https://...' -> unchanged
 */
export function resolvePath(path: string, options: PathResolutionOptions): string {
  // Already absolute URL
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // Absolute path from origin
  if (path.startsWith('/')) {
    return `${window.location.origin}${path}`;
  }

  // Relative path - resolve against baseUrl
  const baseUrl = options.baseUrl.endsWith('/')
    ? options.baseUrl.slice(0, -1)
    : options.baseUrl;

  const cleanPath = path.startsWith('./') ? path.slice(2) : path;

  return `${baseUrl}/${cleanPath}`;
}

/**
 * Extract file paths from SQL query
 * Looks for patterns like:
 * - FROM 'file.parquet'
 * - FROM "file.parquet"
 * - read_parquet('file.parquet')
 * - read_csv('file.csv')
 */
export function extractFilePaths(sql: string): string[] {
  const paths: string[] = [];

  // Match single-quoted strings
  const singleQuoteRegex = /'([^']+\.(parquet|csv|json|arrow))'/gi;
  let match;

  while ((match = singleQuoteRegex.exec(sql)) !== null) {
    paths.push(match[1] as string);
  }

  // Match double-quoted strings
  const doubleQuoteRegex = /"([^"]+\.(parquet|csv|json|arrow))"/gi;

  while ((match = doubleQuoteRegex.exec(sql)) !== null) {
    paths.push(match[1] as string);
  }

  return [...new Set(paths)]; // Remove duplicates
}

/**
 * Resolve all file paths in a SQL query
 */
export function resolvePathsInSQL(
  sql: string,
  options: PathResolutionOptions
): Map<string, string> {
  const filePaths = extractFilePaths(sql);
  const pathMap = new Map<string, string>();

  for (const path of filePaths) {
    const resolvedPath = resolvePath(path, options);
    pathMap.set(path, resolvedPath);
  }

  return pathMap;
}
