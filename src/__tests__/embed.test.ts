import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Embed } from '../embed';
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

describe('Embed', () => {
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
      const embed = new Embed(element);

      const container = embed.getContainer();
      expect(container).toBeTruthy();
      expect(container?.className).toBe('sql-workbench-container');
    });

    it('should create embed from simple <pre> element', () => {
      const element = createSimpleSQLElement('SELECT 1');
      const embed = new Embed(element);

      const container = embed.getContainer();
      expect(container).toBeTruthy();
    });

    it('should extract initial code from <code> element', () => {
      const sql = 'SELECT * FROM users';
      const element = createSQLElement(sql);
      const embed = new Embed(element);

      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor');
      expect(editor?.textContent).toContain('SELECT');
    });

    it('should use initialCode option when provided', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element, { initialCode: 'SELECT 42' });

      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor');
      expect(editor?.textContent).toContain('42');
    });

    it('should merge options with defaults', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element, { baseUrl: 'https://custom.com' });

      expect((embed as any).options.baseUrl).toBe('https://custom.com');
      expect((embed as any).options.theme).toBe(DEFAULT_CONFIG.theme);
      expect((embed as any).options.editable).toBe(DEFAULT_CONFIG.editable);
    });

    it('should respect data-theme attribute', () => {
      const element = createSQLElement('SELECT 1');
      element.setAttribute('data-theme', 'dark');
      const embed = new Embed(element);

      const container = embed.getContainer();
      expect(container?.getAttribute('data-theme')).toBe('dark');
    });

    it('should prioritize options.theme over data-theme attribute', () => {
      const element = createSQLElement('SELECT 1');
      element.setAttribute('data-theme', 'dark');
      const embed = new Embed(element, { theme: 'light' });

      const container = embed.getContainer();
      expect(container?.getAttribute('data-theme')).toBe('light');
    });
  });

  describe('UI creation', () => {
    it('should create all required UI elements', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element);
      const container = embed.getContainer();

      expect(container?.querySelector('.sql-workbench-editor')).toBeTruthy();
      expect(container?.querySelector('.sql-workbench-button-primary')).toBeTruthy();
      expect(container?.querySelector('.sql-workbench-button-secondary')).toBeTruthy();
      expect(container?.querySelector('.sql-workbench-output')).toBeTruthy();
    });

    it('should create Run button with correct attributes', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element);
      const runButton = embed.getContainer()?.querySelector('.sql-workbench-button-primary');

      expect(runButton?.textContent).toBe('Run');
      expect(runButton?.getAttribute('aria-label')).toBe('Execute SQL query');
    });

    it('should create Reset button initially hidden', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element);
      const resetButton = embed.getContainer()?.querySelector('.sql-workbench-button-secondary');

      expect(resetButton?.classList.contains('sql-workbench-button-hidden')).toBe(true);
    });

    it('should create editor with correct attributes', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element);
      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor') as HTMLElement;

      expect(editor?.getAttribute('role')).toBe('textbox');
      expect(editor?.getAttribute('aria-label')).toBe('SQL Editor');
      expect(editor?.getAttribute('aria-multiline')).toBe('true');
      expect(editor?.spellcheck).toBe(false);
    });

    it('should create output area with accessibility attributes', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element);
      const output = embed.getContainer()?.querySelector('.sql-workbench-output');

      expect(output?.getAttribute('role')).toBe('region');
      expect(output?.getAttribute('aria-label')).toBe('Query results');
      expect(output?.getAttribute('aria-live')).toBe('polite');
    });

    it('should make editor editable when editable option is true', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element, { editable: true });
      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor') as HTMLElement;

      expect(editor?.contentEditable).toBe('true');
    });

    it('should make editor non-editable when editable option is false', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element, { editable: false });
      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor') as HTMLElement;

      expect(editor?.contentEditable).toBe('false');
    });

    it('should replace original element with container', () => {
      const element = createSQLElement('SELECT 1');
      const parent = element.parentNode;
      const embed = new Embed(element);

      expect(parent?.contains(element)).toBe(false);
      expect(parent?.contains(embed.getContainer()!)).toBe(true);
    });
  });

  describe('theme resolution', () => {
    it('should use light theme when specified', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element, { theme: 'light' });

      expect(embed.getContainer()?.getAttribute('data-theme')).toBe('light');
    });

    it('should use dark theme when specified', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element, { theme: 'dark' });

      expect(embed.getContainer()?.getAttribute('data-theme')).toBe('dark');
    });

    it('should auto-detect dark theme from system preference', () => {
      mockSystemTheme('dark');
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element, { theme: 'auto' });

      expect(embed.getContainer()?.getAttribute('data-theme')).toBe('dark');
    });

    it('should auto-detect light theme from system preference', () => {
      mockSystemTheme('light');
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element, { theme: 'auto' });

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
      const embed = new Embed(element, { theme: 'myTheme', customThemes });

      expect(embed.getContainer()?.getAttribute('data-theme')).toBe('myTheme');
    });

    it('should fall back to light theme on custom theme error', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element, { theme: 'nonexistent' });

      expect(embed.getContainer()?.getAttribute('data-theme')).toBe('light');
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('keyboard shortcuts', () => {
    it('should run query on Ctrl+Enter', async () => {
      vi.useRealTimers(); // Use real timers for async operations
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element);
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
      const embed = new Embed(element);
      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor') as HTMLElement;

      simulateKeyPress(editor, 'Enter', { metaKey: true });

      await wait(300);

      expect(duckDBManager.query).toHaveBeenCalled();
      vi.useFakeTimers(); // Restore fake timers
    });

    it('should reset on Ctrl+Backspace', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element);
      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor') as HTMLElement;

      // Change code first
      editor.textContent = 'SELECT 42';

      simulateKeyPress(editor, 'Backspace', { ctrlKey: true });

      // Normalize whitespace/invisible characters and check
      const normalizedText = editor.textContent?.replace(/\s+/g, ' ').trim();
      expect(normalizedText).toBe('SELECT 1');
    });

  });

  describe('run method', () => {
    it('should execute SQL query', async () => {
      vi.useRealTimers(); // Use real timers for async operations
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element);

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
      const embed = new Embed(element, {
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
      const embed = new Embed(element, {
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
      const embed = new Embed(element);

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
      const embed = new Embed(element);

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
      const embed = new Embed(element);

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
      const embed = new Embed(element);

      await embed.run();

      const output = embed.getContainer()?.querySelector('.sql-workbench-output');
      expect(output?.textContent).toContain('No rows returned');
      vi.useFakeTimers();
    });

    it('should show error message on query failure', async () => {
      vi.useRealTimers();
      vi.mocked(duckDBManager.query).mockRejectedValueOnce(new Error('Syntax error'));

      const element = createSQLElement('SELECT * FROM invalid');
      const embed = new Embed(element);

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
      const embed = new Embed(element);

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
      const embed = new Embed(element);

      await embed.run();

      const table = embed.getContainer()?.querySelector('table');
      expect(table?.innerHTML).not.toContain('<script>');
      expect(table?.innerHTML).toContain('&lt;script&gt;');
      vi.useFakeTimers();
    });

    it('should disable buttons during query execution', async () => {
      vi.useRealTimers();
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element);

      const runPromise = embed.run();

      const runButton = embed.getContainer()?.querySelector('.sql-workbench-button-primary') as HTMLButtonElement;
      const resetButton = embed.getContainer()?.querySelector('.sql-workbench-button-secondary') as HTMLButtonElement;

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
      const embed = new Embed(element);

      const resetButton = embed.getContainer()?.querySelector('.sql-workbench-button-secondary');
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
      const embed = new Embed(element);

      const startTime = Date.now();
      await embed.run();
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(200);
      vi.useFakeTimers();
    });

    it('should not run query when already loading', async () => {
      vi.useRealTimers();
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element);

      const run1 = embed.run();
      const run2 = embed.run();

      await Promise.all([run1, run2]);

      expect(duckDBManager.query).toHaveBeenCalledTimes(1);
      vi.useFakeTimers();
    });

    it('should show error for empty query', async () => {
      const element = createSQLElement('   ');
      const embed = new Embed(element);

      await embed.run();

      const error = embed.getContainer()?.querySelector('.sql-workbench-error');
      expect(error?.textContent).toContain('No SQL query to execute');
    });
  });

  describe('reset method', () => {
    it('should restore initial code', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element);
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
      const embed = new Embed(element);

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
      const embed = new Embed(element);

      await embed.run();

      const resetButton = embed.getContainer()?.querySelector('.sql-workbench-button-secondary');
      expect(resetButton?.classList.contains('sql-workbench-button-hidden')).toBe(false);

      embed.reset();

      expect(resetButton?.classList.contains('sql-workbench-button-hidden')).toBe(true);
      vi.useFakeTimers();
    });
  });

  describe('destroy method', () => {
    it('should remove container from DOM', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element);
      const container = embed.getContainer();

      embed.destroy();

      expect(document.body.contains(container)).toBe(false);
    });

    it('should mark embed as destroyed', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element);

      expect(embed.isDestroyed()).toBe(false);

      embed.destroy();

      expect(embed.isDestroyed()).toBe(true);
    });

    it('should clear internal references', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element);

      embed.destroy();

      expect(embed.getContainer()).toBeNull();
    });

    it('should be safe to call multiple times', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element);

      embed.destroy();
      embed.destroy();
      embed.destroy();

      expect(embed.isDestroyed()).toBe(true);
    });
  });

  describe('syntax highlighting', () => {
    it('should apply syntax highlighting to initial code', () => {
      const element = createSQLElement('SELECT * FROM users');
      const embed = new Embed(element);
      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor');

      expect(editor?.innerHTML).toContain('sql-keyword');
    });

    it('should update highlighting on input (debounced)', async () => {
      const element = createSQLElement('SELECT 1');
      const embed = new Embed(element);
      const editor = embed.getContainer()?.querySelector('.sql-workbench-editor') as HTMLElement;

      editor.textContent = 'SELECT * FROM users';
      editor.dispatchEvent(new Event('input', { bubbles: true }));

      // Advance timers past debounce delay
      await vi.advanceTimersByTimeAsync(150);

      expect(editor.innerHTML).toContain('sql-keyword');
    });

  });
});
