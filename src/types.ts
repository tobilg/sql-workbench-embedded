/**
 * CSS theme variables interface
 */
export interface ThemeColors {
  /** Background color */
  bgColor: string;
  /** Text color */
  textColor: string;
  /** Border color */
  borderColor: string;
  /** Editor background */
  editorBg: string;
  /** Editor text color */
  editorText: string;
  /** Editor focus background */
  editorFocusBg: string;
  /** Controls background */
  controlsBg: string;
  /** Primary button background */
  primaryBg: string;
  /** Primary button text color */
  primaryText: string;
  /** Primary button hover background */
  primaryHover: string;
  /** Secondary button background */
  secondaryBg: string;
  /** Secondary button text color */
  secondaryText: string;
  /** Secondary button hover background */
  secondaryHover: string;
  /** Muted text color */
  mutedText: string;
  /** Error text color */
  errorText: string;
  /** Error background */
  errorBg: string;
  /** Error border color */
  errorBorder: string;
  /** Table header background */
  tableHeaderBg: string;
  /** Table header text color */
  tableHeaderText: string;
  /** Table hover background */
  tableHover: string;
  /** Syntax highlighting - SQL keywords */
  syntaxKeyword?: string;
  /** Syntax highlighting - string literals */
  syntaxString?: string;
  /** Syntax highlighting - numbers */
  syntaxNumber?: string;
  /** Syntax highlighting - comments */
  syntaxComment?: string;
  /** Syntax highlighting - function names */
  syntaxFunction?: string;
  /** Syntax highlighting - operators */
  syntaxOperator?: string;
}

/**
 * Custom theme definition
 */
export interface CustomTheme {
  /** Base theme to extend ('light' or 'dark') */
  extends?: 'light' | 'dark';
  /** CSS color overrides */
  colors: Partial<ThemeColors>;
}

/**
 * Global configuration options for SQL Workbench Embed
 */
export interface SQLWorkbenchConfig {
  /** CSS selector for automatic embed discovery */
  selector?: string;
  /** Base URL for resolving relative file paths */
  baseUrl?: string;
  /** Visual theme */
  theme?: 'light' | 'dark' | 'auto' | string;
  /** Custom theme definitions */
  customThemes?: Record<string, CustomTheme>;
  /** Enable automatic initialization on DOMContentLoaded */
  autoInit?: boolean;
  /** DuckDB WASM version to use */
  duckdbVersion?: string;
  /** CDN URL for DuckDB assets */
  duckdbCDN?: string;
  /** Allow SQL code editing */
  editable?: boolean;
}

/**
 * Per-instance embed options
 */
export interface EmbedOptions extends SQLWorkbenchConfig {
  /** Initial SQL code (if not extracted from element) */
  initialCode?: string;
}

/**
 * Query execution result
 */
export interface QueryResult {
  /** Column names */
  columns: string[];
  /** Row data */
  rows: unknown[][];
  /** Number of rows returned */
  rowCount: number;
  /** Execution time in milliseconds */
  executionTime: number;
}

/**
 * DuckDB connection interface
 */
export interface DuckDBConnection {
  query: (sql: string) => Promise<QueryResult>;
  close: () => Promise<void>;
  registerFileURL: (name: string, url: string) => Promise<void>;
}

/**
 * UI state for embed
 */
export type EmbedState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<SQLWorkbenchConfig> = {
  selector: 'pre.sql-workbench-embedded, .sql-workbench-embedded pre',
  baseUrl: 'https://data.sql-workbench.com',
  theme: 'auto',
  customThemes: {},
  autoInit: true,
  duckdbVersion: '1.31.1-dev1.0',
  duckdbCDN: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm',
  editable: true,
};
