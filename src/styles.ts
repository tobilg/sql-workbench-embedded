import { ThemeConfig, CustomTheme } from './types';

/**
 * Light theme variables (VS Code Light+ theme)
 */
export const LIGHT_THEME_CONFIG: ThemeConfig = {
  bgColor: '#ffffff',
  textColor: '#333333',
  borderColor: '#e5e5e5',
  editorBg: '#ffffff',
  editorText: '#333333',
  editorFocusBg: '#f3f3f3',
  controlsBg: '#f3f3f3',
  primaryBg: '#007acc',
  primaryText: '#ffffff',
  primaryHover: '#005a9e',
  secondaryBg: '#e5e5e5',
  secondaryText: '#333333',
  secondaryHover: '#d4d4d4',
  mutedText: '#6a737d',
  errorText: '#e51400',
  errorBg: '#ffebe9',
  errorBorder: '#e51400',
  tableHeaderBg: '#f3f3f3',
  tableHeaderText: '#333333',
  tableHover: '#f0f0f0',
  syntaxKeyword: '#0000ff',
  syntaxString: '#a31515',
  syntaxNumber: '#098658',
  syntaxComment: '#008000',
  syntaxFunction: '#795e26',
  syntaxOperator: '#000000',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
  editorFontFamily: '"Monaco", "Menlo", "Ubuntu Mono", "Consolas", monospace',
  fontSize: '14px',
  editorFontSize: '14px',
  buttonFontSize: '14px',
  metadataFontSize: '12px',
};

/**
 * Dark theme variables (VS Code Dark+ theme)
 */
export const DARK_THEME_CONFIG: ThemeConfig = {
  bgColor: '#252526',
  textColor: '#d4d4d4',
  borderColor: '#3e3e42',
  editorBg: '#1e1e1e',
  editorText: '#d4d4d4',
  editorFocusBg: '#252526',
  controlsBg: '#2d2d30',
  primaryBg: '#007acc',
  primaryText: '#ffffff',
  primaryHover: '#0062a3',
  secondaryBg: '#3e3e42',
  secondaryText: '#d4d4d4',
  secondaryHover: '#4e4e52',
  mutedText: '#858585',
  errorText: '#f48771',
  errorBg: '#5a1d1d',
  errorBorder: '#f48771',
  tableHeaderBg: '#2d2d30',
  tableHeaderText: '#d4d4d4',
  tableHover: '#2a2d2e',
  syntaxKeyword: '#569cd6',
  syntaxString: '#ce9178',
  syntaxNumber: '#b5cea8',
  syntaxComment: '#6a9955',
  syntaxFunction: '#dcdcaa',
  syntaxOperator: '#d4d4d4',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
  editorFontFamily: '"Monaco", "Menlo", "Ubuntu Mono", "Consolas", monospace',
  fontSize: '14px',
  editorFontSize: '14px',
  buttonFontSize: '14px',
  metadataFontSize: '12px',
};

/**
 * Required theme variable keys
 */
const REQUIRED_THEME_KEYS: (keyof ThemeConfig)[] = [
  'bgColor', 'textColor', 'borderColor', 'editorBg', 'editorText', 'editorFocusBg',
  'controlsBg', 'primaryBg', 'primaryText', 'primaryHover', 'secondaryBg',
  'secondaryText', 'secondaryHover', 'mutedText', 'errorText', 'errorBg',
  'errorBorder', 'tableHeaderBg', 'tableHeaderText', 'tableHover'
];

/**
 * Validate that all required theme variables are present
 */
export function validateThemeColors(variables: Partial<ThemeConfig>): void {
  const missing = REQUIRED_THEME_KEYS.filter(key => !(key in variables));
  if (missing.length > 0) {
    throw new Error(`Missing required theme variables: ${missing.join(', ')}`);
  }
}

/**
 * Get theme variables for a given theme name
 */
export function getThemeConfig(
  themeName: string,
  customThemes: Record<string, CustomTheme> = {}
): ThemeConfig {
  // Handle built-in themes
  if (themeName === 'light') {
    return LIGHT_THEME_CONFIG;
  }
  if (themeName === 'dark') {
    return DARK_THEME_CONFIG;
  }

  // Handle custom themes
  const customTheme = customThemes[themeName];
  if (!customTheme) {
    throw new Error(`Unknown theme: ${themeName}`);
  }

  // If theme extends a base theme, merge with it
  if (customTheme.extends) {
    const baseTheme = customTheme.extends === 'light' ? LIGHT_THEME_CONFIG : DARK_THEME_CONFIG;
    return { ...baseTheme, ...customTheme.config };
  }

  // If no extends, validate all variables are present
  validateThemeColors(customTheme.config);
  return customTheme.config as ThemeConfig;
}

/**
 * Apply theme variables to a container element
 */
export function applyThemeConfig(container: HTMLElement, variables: ThemeConfig): void {
  container.style.setProperty('--sw-bg-color', variables.bgColor);
  container.style.setProperty('--sw-text-color', variables.textColor);
  container.style.setProperty('--sw-border-color', variables.borderColor);
  container.style.setProperty('--sw-editor-bg', variables.editorBg);
  container.style.setProperty('--sw-editor-text', variables.editorText);
  container.style.setProperty('--sw-editor-focus-bg', variables.editorFocusBg);
  container.style.setProperty('--sw-controls-bg', variables.controlsBg);
  container.style.setProperty('--sw-primary-bg', variables.primaryBg);
  container.style.setProperty('--sw-primary-text', variables.primaryText);
  container.style.setProperty('--sw-primary-hover', variables.primaryHover);
  container.style.setProperty('--sw-secondary-bg', variables.secondaryBg);
  container.style.setProperty('--sw-secondary-text', variables.secondaryText);
  container.style.setProperty('--sw-secondary-hover', variables.secondaryHover);
  container.style.setProperty('--sw-muted-text', variables.mutedText);
  container.style.setProperty('--sw-error-text', variables.errorText);
  container.style.setProperty('--sw-error-bg', variables.errorBg);
  container.style.setProperty('--sw-error-border', variables.errorBorder);
  container.style.setProperty('--sw-table-header-bg', variables.tableHeaderBg);
  container.style.setProperty('--sw-table-header-text', variables.tableHeaderText);
  container.style.setProperty('--sw-table-hover', variables.tableHover);

  // Apply syntax highlighting colors if defined
  if (variables.syntaxKeyword) {
    container.style.setProperty('--sw-syntax-keyword', variables.syntaxKeyword);
  }
  if (variables.syntaxString) {
    container.style.setProperty('--sw-syntax-string', variables.syntaxString);
  }
  if (variables.syntaxNumber) {
    container.style.setProperty('--sw-syntax-number', variables.syntaxNumber);
  }
  if (variables.syntaxComment) {
    container.style.setProperty('--sw-syntax-comment', variables.syntaxComment);
  }
  if (variables.syntaxFunction) {
    container.style.setProperty('--sw-syntax-function', variables.syntaxFunction);
  }
  if (variables.syntaxOperator) {
    container.style.setProperty('--sw-syntax-operator', variables.syntaxOperator);
  }

  // Apply typography properties if defined
  if (variables.fontFamily) {
    container.style.setProperty('--sw-font-family', variables.fontFamily);
  }
  if (variables.editorFontFamily) {
    container.style.setProperty('--sw-editor-font-family', variables.editorFontFamily);
  }
  if (variables.fontSize) {
    container.style.setProperty('--sw-font-size', variables.fontSize);
  }
  if (variables.editorFontSize) {
    container.style.setProperty('--sw-editor-font-size', variables.editorFontSize);
  }
  if (variables.buttonFontSize) {
    container.style.setProperty('--sw-button-font-size', variables.buttonFontSize);
  }
  if (variables.metadataFontSize) {
    container.style.setProperty('--sw-metadata-font-size', variables.metadataFontSize);
  }
}

/**
 * Inline CSS styles for SQL Workbench Embed
 * These styles will be injected into the document head
 */
export const CSS_STYLES = `
.sql-workbench-container {
  font-family: var(--sw-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif);
  font-size: var(--sw-font-size, 14px);
  border: 1px solid var(--sw-border-color);
  border-radius: 8px;
  overflow: hidden;
  margin: 1rem 0;
  background: var(--sw-bg-color);
  color: var(--sw-text-color);
}

.sql-workbench-editor {
  font-family: var(--sw-editor-font-family, 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace);
  font-size: var(--sw-editor-font-size, 14px);
  line-height: 1.5;
  padding: 1rem;
  background: var(--sw-editor-bg);
  color: var(--sw-editor-text);
  min-height: 100px;
  overflow: auto;
  white-space: pre-wrap;
  tab-size: 2;
  outline: none;
  direction: ltr;
  text-align: left;
}

.sql-workbench-editor[contenteditable='true']:focus {
  background: var(--sw-editor-focus-bg);
}

.sql-workbench-controls {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--sw-controls-bg);
  border-top: 1px solid var(--sw-border-color);
}

.sql-workbench-button {
  padding: 0.5rem 1rem;
  font-size: var(--sw-button-font-size, 14px);
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.sql-workbench-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sql-workbench-button-primary {
  background: var(--sw-primary-bg);
  color: var(--sw-primary-text);
}

.sql-workbench-button-primary:hover:not(:disabled) {
  background: var(--sw-primary-hover);
}

.sql-workbench-button-secondary {
  background: var(--sw-secondary-bg);
  color: var(--sw-secondary-text);
}

.sql-workbench-button-secondary:hover:not(:disabled) {
  background: var(--sw-secondary-hover);
}

.sql-workbench-output {
  padding: 1rem;
  min-height: 20px;
  border-top: 1px solid var(--sw-border-color);
}

.sql-workbench-output-empty {
  color: var(--sw-muted-text);
  font-style: italic;
}

.sql-workbench-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--sw-muted-text);
}

.sql-workbench-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--sw-border-color);
  border-top-color: var(--sw-primary-bg);
  border-radius: 50%;
  animation: sw-spin 0.8s linear infinite;
}

@keyframes sw-spin {
  to { transform: rotate(360deg); }
}

.sql-workbench-error {
  color: var(--sw-error-text);
  background: var(--sw-error-bg);
  padding: 0.75rem;
  border-radius: 4px;
  border-left: 3px solid var(--sw-error-border);
}

.sql-workbench-error-title {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.sql-workbench-result-table {
  width: 100%;
  border-collapse: collapse;
  overflow-x: auto;
  display: block;
  max-height: 400px;
  overflow-y: auto;
}

.sql-workbench-result-table table {
  width: 100%;
  border-collapse: collapse;
}

.sql-workbench-result-table th {
  background: var(--sw-table-header-bg);
  color: var(--sw-table-header-text);
  font-weight: 600;
  text-align: left;
  padding: 0.5rem;
  border-bottom: 2px solid var(--sw-border-color);
  position: sticky;
  top: 0;
}

.sql-workbench-result-table td {
  padding: 0.5rem;
  border-bottom: 1px solid var(--sw-border-color);
}

.sql-workbench-result-table tr:hover {
  background: var(--sw-table-hover);
}

.sql-workbench-metadata {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--sw-border-color);
  font-size: var(--sw-metadata-font-size, 12px);
  color: var(--sw-muted-text);
  display: flex;
  gap: 1rem;
}

/* Responsive adjustments for mobile */
@media (max-width: 480px) {
  .sql-workbench-controls {
    flex-direction: column;
  }

  .sql-workbench-button {
    width: 100%;
  }

  .sql-workbench-metadata {
    flex-direction: column;
    gap: 0.25rem;
  }
}

/* Syntax highlighting classes */
.sql-keyword { color: var(--sw-syntax-keyword, #0000ff); font-weight: 600; }
.sql-string { color: var(--sw-syntax-string, #a31515); }
.sql-number { color: var(--sw-syntax-number, #098658); }
.sql-comment { color: var(--sw-syntax-comment, #008000); font-style: italic; }
.sql-function { color: var(--sw-syntax-function, #795e26); }
.sql-operator { color: var(--sw-syntax-operator, #000000); }
`;

/**
 * Inject styles into document head
 */
export function injectStyles(): void {
  if (typeof document === 'undefined') return;

  const styleId = 'sql-workbench-embedded-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = CSS_STYLES;
  document.head.appendChild(style);
}
