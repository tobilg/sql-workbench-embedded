import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Embedded } from '../embedded';
import { duckDBManager } from '../duckdb-manager';
import {
  createSQLElement,
  createSimpleSQLElement,
  simulateKeyPress,
  mockSystemTheme,
  wait,
} from './test-utils';
import { DEFAULT_CONFIG } from '../types';

vi.mock('../duckdb-manager');

describe('Embedded', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    // Mock duckDBManager methods
    vi.mocked(duckDBManager.isInitialized).mockReturnValue(false);
    vi.mocked(duckDBManager.configure).mockReturnValue(undefined);
    vi.mocked(duckDBManager.registerFile).mockResolvedValue(undefined);
    vi.mocked(duckDBManager.query).mockResolvedValue({
      columns: ['id', 'name'],
      rows: [[1, 'Alice'], [2, 'Bob']],
      rowCount: 2,
      executionTime: 42,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
  });

  describe('constructor and initialization', () => {
    it('should create embed from <pre><code> structure', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);

      const container = embed.getContainer();
      expect(container).toBeTruthy();
      expect(container?.className).toBe('sql-workbench-container');
    });

    it('should create embed from simple <pre> element', () => {
      const element = createSimpleSQLElement('SELECT 1');
      const embed = new Embedded(element);

      const container = embed.getContainer();
      expect(container).toBeTruthy();
    });

    it('should extract initial code from <code> element', () => {
      const sql = 'SELECT * FROM users';
      const element = createSQLElement(sql);
      const embed = new Embedded(element);

      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor');
      expect(editor?.textContent).toContain('SELECT');
    });

    it('should use initialCode option when provided', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element, { initialCode: 'SELECT 42' });

      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor');
      expect(editor?.textContent).toContain('42');
    });

    it('should merge options with defaults', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element, { baseUrl: 'https://custom.com' });

      expect((embed as any).options.baseUrl).toBe('https://custom.com');
      expect((embed as any).options.theme).toBe(DEFAULT_CONFIG.theme);
      expect((embed as any).options.editable).toBe(DEFAULT_CONFIG.editable);
    });

    it('should respect data-theme attribute', () => {
      const element = createSQLElement('SELECT 1');
      element.setAttribute('data-theme', 'dark');
      const embed = new Embedded(element);

      const container = embed.getContainer();
      expect(container?.getAttribute('data-theme')).toBe('dark');
    });

    it('should prioritize data-theme attribute over options.theme', () => {
      const element = createSQLElement('SELECT 1');
      element.setAttribute('data-theme', 'dark');
      const embed = new Embedded(element, { theme: 'light' });

      const container = embed.getContainer();
      // data-theme attribute has highest priority
      expect(container?.getAttribute('data-theme')).toBe('dark');
    });
  });

  describe('UI creation', () => {
    it('should create all required UI elements', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);
      const container = embed.getContainer();

      expect(container?.querySelector('.sql-workbench-editor')).toBeTruthy();
      expect(container?.querySelector('.sql-workbench-button-primary')).toBeTruthy();
      expect(container?.querySelector('.sql-workbench-button-reset')).toBeTruthy();
      expect(container?.querySelector('.sql-workbench-output')).toBeTruthy();
    });

    it('should create Run button with correct attributes', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);
      const runButton = embed.getContainer()?.querySelector('.sql-workbench-button-primary');

      expect(runButton?.textContent).toBe('Run');
      expect(runButton?.getAttribute('aria-label')).toBe('Execute SQL query');
    });

    it('should create Reset button initially hidden', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);
      const resetButton = embed.getContainer()?.querySelector('.sql-workbench-button-reset');

      expect(resetButton?.classList.contains('sql-workbench-button-hidden')).toBe(true);
    });

    it('should create Open button by default', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);
      const openButton = embed.getContainer()?.querySelector('.sql-workbench-button-open');

      expect(openButton).toBeTruthy();
      expect(openButton?.getAttribute('aria-label')).toBe('Open in SQL Workbench');
    });

    it('should not create Open button when showOpenButton is false', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element, { showOpenButton: false });
      const openButton = embed.getContainer()?.querySelector('.sql-workbench-button-open');

      expect(openButton).toBeFalsy();
    });

    it('should create editor with correct attributes', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);
      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor') as HTMLElement;

      expect(editor?.getAttribute('role')).toBe('textbox');
      expect(editor?.getAttribute('aria-label')).toBe('SQL Editor');
      expect(editor?.getAttribute('aria-multiline')).toBe('true');
      expect(editor?.spellcheck).toBe(false);
    });

    it('should create output area with accessibility attributes', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);
      const output = embed.getContainer()?.querySelector('.sql-workbench-output');

      expect(output?.getAttribute('role')).toBe('region');
      expect(output?.getAttribute('aria-label')).toBe('Query results');
      expect(output?.getAttribute('aria-live')).toBe('polite');
    });

    it('should make editor editable when editable option is true', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element, { editable: true });
      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor') as HTMLElement;

      expect(editor?.contentEditable).toBe('true');
    });

    it('should make editor non-editable when editable option is false', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element, { editable: false });
      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor') as HTMLElement;

      expect(editor?.contentEditable).toBe('false');
    });

    it('should replace original element with container', () => {
      const element = createSQLElement('SELECT 1');
      const parent = element.parentNode;
      const embed = new Embedded(element);

      expect(parent?.contains(element)).toBe(false);
      expect(parent?.contains(embed.getContainer()!)).toBe(true);
    });
  });

  describe('theme resolution', () => {
    it('should use light theme when specified', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element, { theme: 'light' });

      expect(embed.getContainer()?.getAttribute('data-theme')).toBe('light');
    });

    it('should use dark theme when specified', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element, { theme: 'dark' });

      expect(embed.getContainer()?.getAttribute('data-theme')).toBe('dark');
    });

    it('should auto-detect dark theme from system preference', () => {
      mockSystemTheme('dark');
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element, { theme: 'auto' });

      expect(embed.getContainer()?.getAttribute('data-theme')).toBe('dark');
    });

    it('should auto-detect light theme from system preference', () => {
      mockSystemTheme('light');
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element, { theme: 'auto' });

      expect(embed.getContainer()?.getAttribute('data-theme')).toBe('light');
    });

    it('should handle custom theme names', () => {
      const element = createSQLElement('SELECT 1');
      const customThemes = {
        myTheme: {
          extends: 'light' as const,
          config: { bgColor: '#f0f0f0' },
        },
      };
      const embed = new Embedded(element, { theme: 'myTheme', customThemes });

      expect(embed.getContainer()?.getAttribute('data-theme')).toBe('myTheme');
    });

    it('should fall back to light theme on custom theme error', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element, { theme: 'nonexistent' });

      expect(embed.getContainer()?.getAttribute('data-theme')).toBe('light');
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('keyboard shortcuts', () => {
    it('should run query on Ctrl+Enter', async () => {
      vi.useRealTimers(); // Use real timers for async operations
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);
      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor') as HTMLElement;

      simulateKeyPress(editor, 'Enter', { ctrlKey: true });

      // Wait for async operations to complete
      await wait(300);

      expect(duckDBManager.query).toHaveBeenCalled();
      vi.useFakeTimers(); // Restore fake timers
    });

    it('should run query on Cmd+Enter (Mac)', async () => {
      vi.useRealTimers(); // Use real timers for async operations
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);
      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor') as HTMLElement;

      simulateKeyPress(editor, 'Enter', { metaKey: true });

      await wait(300);

      expect(duckDBManager.query).toHaveBeenCalled();
      vi.useFakeTimers(); // Restore fake timers
    });

    it('should reset on Ctrl+Backspace', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);
      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor') as HTMLElement;

      // Change code first
      editor.textContent = 'SELECT 42';

      simulateKeyPress(editor, 'Backspace', { ctrlKey: true });

      // Normalize whitespace/invisible characters and check
      const normalizedText = editor.textContent?.replace(/\s+/g, ' ').trim();
      expect(normalizedText).toBe('SELECT 1');
    });

    it('should open in SQL Workbench on Ctrl+Shift+Enter', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);
      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor') as HTMLElement;

      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      simulateKeyPress(editor, 'Enter', { ctrlKey: true, shiftKey: true });

      expect(windowOpenSpy).toHaveBeenCalled();
      expect(windowOpenSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://sql-workbench.com/#queries=v1,'),
        '_blank',
        'noopener'
      );

      windowOpenSpy.mockRestore();
    });

    it('should open in SQL Workbench on Cmd+Shift+Enter (Mac)', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);
      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor') as HTMLElement;

      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      simulateKeyPress(editor, 'Enter', { metaKey: true, shiftKey: true });

      expect(windowOpenSpy).toHaveBeenCalled();
      expect(windowOpenSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://sql-workbench.com/#queries=v1,'),
        '_blank',
        'noopener'
      );

      windowOpenSpy.mockRestore();
    });

  });

  describe('run method', () => {
    it('should execute SQL query', async () => {
      vi.useRealTimers(); // Use real timers for async operations
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);

      await embed.run();

      // Check that query was called with the SQL (normalize whitespace)
      expect(duckDBManager.query).toHaveBeenCalled();
      const callArg = vi.mocked(duckDBManager.query).mock.calls[0]?.[0];
      expect(callArg).toBeDefined();
      const normalizedArg = callArg!.replace(/\s+/g, ' ').trim();
      expect(normalizedArg).toBe('SELECT 1');
      vi.useFakeTimers(); // Restore fake timers
    });

    it('should configure DuckDB before first query', async () => {
      vi.useRealTimers();
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element, {
        duckdbVersion: '1.30.0',
        duckdbCDN: 'https://custom-cdn.com',
      });

      await embed.run();

      expect(duckDBManager.configure).toHaveBeenCalledWith({
        version: '1.30.0',
        cdn: 'https://custom-cdn.com',
      });
      vi.useFakeTimers();
    });

    it('should register file URLs before query execution', async () => {
      vi.useRealTimers();
      const sql = "SELECT * FROM 'data.parquet'";
      const element = createSQLElement(sql);
      const embed = new Embedded(element, {
        baseUrl: 'https://data.example.com',
      });

      await embed.run();

      expect(duckDBManager.registerFile).toHaveBeenCalledWith(
        'data.parquet',
        'https://data.example.com/data.parquet'
      );
      vi.useFakeTimers();
    });

    it('should show loading state during query execution', async () => {
      vi.useRealTimers();
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);

      const runPromise = embed.run();

      // Check loading state immediately
      const output = embed.getContainer()?.querySelector('.sql-workbench-output');
      expect(output?.className).toContain('loading');
      expect(output?.textContent).toContain('Executing query');

      await runPromise;
      vi.useFakeTimers();
    });

    it('should display results in table format', async () => {
      vi.useRealTimers();
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);

      await embed.run();

      const output = embed.getContainer()?.querySelector('.sql-workbench-output');
      expect(output?.querySelector('table')).toBeTruthy();
      expect(output?.textContent).toContain('Alice');
      expect(output?.textContent).toContain('Bob');
      vi.useFakeTimers();
    });

    it('should display execution metadata', async () => {
      vi.useRealTimers();
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);

      await embed.run();

      const metadata = embed.getContainer()?.querySelector('.sql-workbench-metadata');
      expect(metadata?.textContent).toContain('2 rows');
      expect(metadata?.textContent).toContain('Execution time');
      expect(metadata?.textContent).toContain('2 columns');
      vi.useFakeTimers();
    });

    it('should show empty result message when no rows returned', async () => {
      vi.useRealTimers();
      vi.mocked(duckDBManager.query).mockResolvedValueOnce({
        columns: ['id'],
        rows: [],
        rowCount: 0,
        executionTime: 10,
      });

      const element = createSQLElement('SELECT 1 WHERE FALSE');
      const embed = new Embedded(element);

      await embed.run();

      const output = embed.getContainer()?.querySelector('.sql-workbench-output');
      expect(output?.textContent).toContain('No rows returned');
      vi.useFakeTimers();
    });

    it('should show error message on query failure', async () => {
      vi.useRealTimers();
      vi.mocked(duckDBManager.query).mockRejectedValueOnce(new Error('Syntax error'));

      const element = createSQLElement('SELECT * FROM invalid');
      const embed = new Embedded(element);

      await embed.run();

      const error = embed.getContainer()?.querySelector('.sql-workbench-error');
      expect(error?.textContent).toContain('Syntax error');
      vi.useFakeTimers();
    });

    it('should escape HTML in error messages', async () => {
      vi.useRealTimers();
      vi.mocked(duckDBManager.query).mockRejectedValueOnce(
        new Error('<script>alert("XSS")</script>')
      );

      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);

      await embed.run();

      const error = embed.getContainer()?.querySelector('.sql-workbench-error');
      expect(error?.innerHTML).not.toContain('<script>');
      expect(error?.innerHTML).toContain('&lt;script&gt;');
      vi.useFakeTimers();
    });

    it('should escape HTML in table cells', async () => {
      vi.useRealTimers();
      vi.mocked(duckDBManager.query).mockResolvedValueOnce({
        columns: ['name'],
        rows: [['<script>alert("XSS")</script>']],
        rowCount: 1,
        executionTime: 10,
      });

      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);

      await embed.run();

      const table = embed.getContainer()?.querySelector('table');
      expect(table?.innerHTML).not.toContain('<script>');
      expect(table?.innerHTML).toContain('&lt;script&gt;');
      vi.useFakeTimers();
    });

    it('should disable buttons during query execution', async () => {
      vi.useRealTimers();
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);

      const runPromise = embed.run();

      const runButton = embed.getContainer()?.querySelector('.sql-workbench-button-primary') as HTMLButtonElement;
      const resetButton = embed.getContainer()?.querySelector('.sql-workbench-button-reset') as HTMLButtonElement;

      expect(runButton?.disabled).toBe(true);
      expect(resetButton?.disabled).toBe(true);

      await runPromise;

      expect(runButton?.disabled).toBe(false);
      expect(resetButton?.disabled).toBe(false);
      vi.useFakeTimers();
    });

    it('should show reset button after first query', async () => {
      vi.useRealTimers();
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);

      const resetButton = embed.getContainer()?.querySelector('.sql-workbench-button-reset');
      expect(resetButton?.classList.contains('sql-workbench-button-hidden')).toBe(true);

      await embed.run();

      expect(resetButton?.classList.contains('sql-workbench-button-hidden')).toBe(false);
      vi.useFakeTimers();
    });

    it('should enforce minimum 200ms loading duration', async () => {
      vi.useRealTimers();
      // Mock fast query
      vi.mocked(duckDBManager.query).mockImplementation(async () => {
        await wait(10);
        return {
          columns: ['id'],
          rows: [[1]],
          rowCount: 1,
          executionTime: 10,
        };
      });

      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);

      const startTime = Date.now();
      await embed.run();
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(200);
      vi.useFakeTimers();
    });

    it('should not run query when already loading', async () => {
      vi.useRealTimers();
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);

      const run1 = embed.run();
      const run2 = embed.run();

      await Promise.all([run1, run2]);

      expect(duckDBManager.query).toHaveBeenCalledTimes(1);
      vi.useFakeTimers();
    });

    it('should show error for empty query', async () => {
      const element = createSQLElement('   ');
      const embed = new Embedded(element);

      await embed.run();

      const error = embed.getContainer()?.querySelector('.sql-workbench-error');
      expect(error?.textContent).toContain('No SQL query to execute');
    });
  });

  describe('reset method', () => {
    it('should restore initial code', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);
      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor') as HTMLElement;

      editor.textContent = 'SELECT 42';
      embed.reset();

      // Normalize whitespace/invisible characters and check
      const normalizedText = editor.textContent?.replace(/\s+/g, ' ').trim();
      expect(normalizedText).toBe('SELECT 1');
    });

    it('should clear output area', async () => {
      vi.useRealTimers();
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);

      await embed.run();

      embed.reset();

      const output = embed.getContainer()?.querySelector('.sql-workbench-output');
      expect(output?.classList.contains('sql-workbench-output-hidden')).toBe(true);
      expect(output?.textContent).toBe('');
      vi.useFakeTimers();
    });

    it('should hide reset button', async () => {
      vi.useRealTimers();
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);

      await embed.run();

      const resetButton = embed.getContainer()?.querySelector('.sql-workbench-button-reset');
      expect(resetButton?.classList.contains('sql-workbench-button-hidden')).toBe(false);

      embed.reset();

      expect(resetButton?.classList.contains('sql-workbench-button-hidden')).toBe(true);
      vi.useFakeTimers();
    });
  });

  describe('destroy method', () => {
    it('should remove container from DOM', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);
      const container = embed.getContainer();

      embed.destroy();

      expect(document.body.contains(container)).toBe(false);
    });

    it('should mark embed as destroyed', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);

      expect(embed.isDestroyed()).toBe(false);

      embed.destroy();

      expect(embed.isDestroyed()).toBe(true);
    });

    it('should clear internal references', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);

      embed.destroy();

      expect(embed.getContainer()).toBeNull();
    });

    it('should be safe to call multiple times', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);

      embed.destroy();
      embed.destroy();
      embed.destroy();

      expect(embed.isDestroyed()).toBe(true);
    });
  });

  describe('syntax highlighting', () => {
    it('should apply syntax highlighting to initial code', () => {
      const element = createSQLElement('SELECT * FROM users');
      const embed = new Embedded(element);
      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor');

      expect(editor?.innerHTML).toContain('sql-keyword');
    });

    it('should update highlighting on input (debounced)', async () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);
      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor') as HTMLElement;

      editor.textContent = 'SELECT * FROM users';
      editor.dispatchEvent(new Event('input', { bubbles: true }));

      // Advance timers past debounce delay
      await vi.advanceTimersByTimeAsync(150);

      expect(editor.innerHTML).toContain('sql-keyword');
    });

  });

  describe('initQueries integration', () => {
    it('should configure init queries when DuckDB not initialized', async () => {
      vi.useRealTimers();
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element, {
        initQueries: ['INSTALL spatial', 'LOAD spatial'],
      });

      vi.mocked(duckDBManager.isInitialized).mockReturnValue(false);

      await embed.run();

      expect(duckDBManager.configure).toHaveBeenCalled();
      expect(duckDBManager.configureInitQueries).toHaveBeenCalledWith([
        'INSTALL spatial',
        'LOAD spatial',
      ]);

      vi.useFakeTimers();
    });

    it('should not configure init queries if DuckDB already initialized', async () => {
      vi.useRealTimers();
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element, {
        initQueries: ['INSTALL spatial', 'LOAD spatial'],
      });

      vi.mocked(duckDBManager.isInitialized).mockReturnValue(true);

      await embed.run();

      expect(duckDBManager.configure).not.toHaveBeenCalled();
      expect(duckDBManager.configureInitQueries).not.toHaveBeenCalled();

      vi.useFakeTimers();
    });

    it('should skip init queries configuration if none provided', async () => {
      vi.useRealTimers();
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element);

      vi.mocked(duckDBManager.isInitialized).mockReturnValue(false);

      await embed.run();

      expect(duckDBManager.configure).toHaveBeenCalled();
      expect(duckDBManager.configureInitQueries).not.toHaveBeenCalled();

      vi.useFakeTimers();
    });

    it('should skip init queries configuration if empty array', async () => {
      vi.useRealTimers();
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element, { initQueries: [] });

      vi.mocked(duckDBManager.isInitialized).mockReturnValue(false);

      await embed.run();

      expect(duckDBManager.configure).toHaveBeenCalled();
      expect(duckDBManager.configureInitQueries).not.toHaveBeenCalled();

      vi.useFakeTimers();
    });

    it('should support spatial extension installation', async () => {
      vi.useRealTimers();
      const element = createSQLElement('SELECT ST_Distance(ST_Point(0, 0), ST_Point(3, 4))');
      const embed = new Embedded(element, {
        initQueries: ['INSTALL spatial', 'LOAD spatial'],
      });

      vi.mocked(duckDBManager.isInitialized).mockReturnValue(false);

      await embed.run();

      expect(duckDBManager.configureInitQueries).toHaveBeenCalledWith([
        'INSTALL spatial',
        'LOAD spatial',
      ]);

      vi.useFakeTimers();
    });

    it('should support a5 community extension installation', async () => {
      vi.useRealTimers();
      const element = createSQLElement('SELECT ai5() FROM generate_series(1, 10)');
      const embed = new Embedded(element, {
        initQueries: ['INSTALL a5 FROM community', 'LOAD a5'],
      });

      vi.mocked(duckDBManager.isInitialized).mockReturnValue(false);

      await embed.run();

      expect(duckDBManager.configureInitQueries).toHaveBeenCalledWith([
        'INSTALL a5 FROM community',
        'LOAD a5',
      ]);

      vi.useFakeTimers();
    });

    it('should support multiple extensions in init queries', async () => {
      vi.useRealTimers();
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element, {
        initQueries: [
          'INSTALL spatial',
          'LOAD spatial',
          'INSTALL a5 FROM community',
          'LOAD a5',
          'INSTALL json',
          'LOAD json',
        ],
      });

      vi.mocked(duckDBManager.isInitialized).mockReturnValue(false);

      await embed.run();

      expect(duckDBManager.configureInitQueries).toHaveBeenCalledWith([
        'INSTALL spatial',
        'LOAD spatial',
        'INSTALL a5 FROM community',
        'LOAD a5',
        'INSTALL json',
        'LOAD json',
      ]);

      vi.useFakeTimers();
    });

    it('should support configuration options in init queries', async () => {
      vi.useRealTimers();
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element, {
        initQueries: ["SET memory_limit='2GB'", 'SET threads=4'],
      });

      vi.mocked(duckDBManager.isInitialized).mockReturnValue(false);

      await embed.run();

      expect(duckDBManager.configureInitQueries).toHaveBeenCalledWith([
        "SET memory_limit='2GB'",
        'SET threads=4',
      ]);

      vi.useFakeTimers();
    });

    it('should support user-defined functions in init queries', async () => {
      vi.useRealTimers();
      const element = createSQLElement('SELECT add_tax(100, 0.08)');
      const embed = new Embedded(element, {
        initQueries: [
          'CREATE MACRO add_tax(price, rate) AS price * (1 + rate)',
          'CREATE MACRO full_name(first, last) AS first || \' \' || last',
        ],
      });

      vi.mocked(duckDBManager.isInitialized).mockReturnValue(false);

      await embed.run();

      expect(duckDBManager.configureInitQueries).toHaveBeenCalledWith([
        'CREATE MACRO add_tax(price, rate) AS price * (1 + rate)',
        'CREATE MACRO full_name(first, last) AS first || \' \' || last',
      ]);

      vi.useFakeTimers();
    });

    it('should handle init query errors gracefully', async () => {
      vi.useRealTimers();
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element, {
        initQueries: ['INVALID SQL'],
      });

      vi.mocked(duckDBManager.isInitialized).mockReturnValue(false);
      vi.mocked(duckDBManager.query).mockRejectedValue(
        new Error('Initialization query failed: Syntax error')
      );

      await embed.run();

      const output = embed.getContainer()?.querySelector('.sql-workbench-output');
      expect(output?.textContent).toContain('Initialization query failed');

      vi.useFakeTimers();
    });
  });

  describe('openInSQLWorkbench with initQueries', () => {
    let windowOpenSpy: any;

    beforeEach(() => {
      windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    });

    afterEach(() => {
      windowOpenSpy.mockRestore();
    });

    it('should open SQL Workbench with query only when no init queries', () => {
      const element = createSQLElement('SELECT 42');
      const embed = new Embedded(element);

      const openButton = embed.getContainer()?.querySelector('.sql-workbench-button-open') as HTMLButtonElement;
      openButton?.click();

      expect(windowOpenSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://sql-workbench.com/#queries=v1,'),
        '_blank',
        'noopener'
      );

      // Verify the URL doesn't contain init queries
      const calledUrl = windowOpenSpy.mock.calls[0][0];
      expect(calledUrl).not.toContain('INSTALL');
      expect(calledUrl).not.toContain('LOAD');
    });

    it('should prepend init queries to encoded query', () => {
      const element = createSQLElement('SELECT 42');
      const embed = new Embedded(element, {
        initQueries: ['INSTALL spatial', 'LOAD spatial'],
      });

      const openButton = embed.getContainer()?.querySelector('.sql-workbench-button-open') as HTMLButtonElement;
      openButton?.click();

      expect(windowOpenSpy).toHaveBeenCalled();
      const calledUrl = windowOpenSpy.mock.calls[0][0];

      // Decode the URL to verify init queries are included
      const encodedPart = calledUrl.split('queries=v1,')[1];
      // Convert URL-safe base64 back to standard base64
      const base64 = encodedPart.replace(/-/g, '+').replace(/_/g, '/');
      // Add padding if needed
      const paddedBase64 = base64 + '==='.slice(0, (4 - base64.length % 4) % 4);
      const decodedQuery = decodeURIComponent(escape(atob(paddedBase64)));

      expect(decodedQuery).toContain('INSTALL spatial');
      expect(decodedQuery).toContain('LOAD spatial');
      expect(decodedQuery).toMatch(/SELECT\s+42/);
    });

    it('should format init queries with semicolons and newlines', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element, {
        initQueries: ['INSTALL spatial', 'LOAD spatial', 'INSTALL a5 FROM community'],
      });

      const openButton = embed.getContainer()?.querySelector('.sql-workbench-button-open') as HTMLButtonElement;
      openButton?.click();

      const calledUrl = windowOpenSpy.mock.calls[0][0];
      const encodedPart = calledUrl.split('queries=v1,')[1];
      const base64 = encodedPart.replace(/-/g, '+').replace(/_/g, '/');
      const paddedBase64 = base64 + '==='.slice(0, (4 - base64.length % 4) % 4);
      const decodedQuery = decodeURIComponent(escape(atob(paddedBase64)));

      // Verify proper formatting
      expect(decodedQuery).toMatch(/INSTALL spatial;\s*\n/);
      expect(decodedQuery).toMatch(/LOAD spatial;\s*\n/);
      expect(decodedQuery).toMatch(/INSTALL a5 FROM community;\s*\n/);
      expect(decodedQuery).toMatch(/;\s*\n\s*SELECT\s+1/);
    });

    it('should handle empty init queries array', () => {
      const element = createSQLElement('SELECT 42');
      const embed = new Embedded(element, {
        initQueries: [],
      });

      const openButton = embed.getContainer()?.querySelector('.sql-workbench-button-open') as HTMLButtonElement;
      openButton?.click();

      expect(windowOpenSpy).toHaveBeenCalled();
      const calledUrl = windowOpenSpy.mock.calls[0][0];
      const encodedPart = calledUrl.split('queries=v1,')[1];
      const base64 = encodedPart.replace(/-/g, '+').replace(/_/g, '/');
      const paddedBase64 = base64 + '==='.slice(0, (4 - base64.length % 4) % 4);
      const decodedQuery = decodeURIComponent(escape(atob(paddedBase64)));

      // Should only contain user query (with possible whitespace variations)
      expect(decodedQuery).toMatch(/SELECT\s+42/);
      expect(decodedQuery).not.toContain('INSTALL');
    });

    it('should work with keyboard shortcut Cmd+Shift+Enter', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embedded(element, {
        initQueries: ['INSTALL spatial'],
      });

      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor') as HTMLElement;
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        metaKey: true,
        shiftKey: true,
        bubbles: true,
      });
      editor?.dispatchEvent(event);

      expect(windowOpenSpy).toHaveBeenCalled();
    });

    it('should not open when query is empty', () => {
      const element = createSQLElement('   ');
      const embed = new Embedded(element, {
        initQueries: ['INSTALL spatial'],
      });

      const openButton = embed.getContainer()?.querySelector('.sql-workbench-button-open') as HTMLButtonElement;
      openButton?.click();

      expect(windowOpenSpy).not.toHaveBeenCalled();
    });
  });
});
