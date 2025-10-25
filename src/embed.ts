/**
 * SQL Workbench Embed class
 * Main class for creating interactive SQL embeds
 */

import { EmbedOptions, EmbedState, QueryResult, DEFAULT_CONFIG } from './types';
import { highlightSQL, debounce } from './syntax-highlight';
import { resolvePathsInSQL } from './path-resolver';
import { duckDBManager } from './duckdb-manager';
import { getThemeConfig, applyThemeConfig } from './styles';

export class Embed {
  private element: HTMLElement;
  private options: Required<EmbedOptions>;
  private container: HTMLElement | null = null;
  private editorElement: HTMLDivElement | null = null;
  private outputElement: HTMLDivElement | null = null;
  private runButton: HTMLButtonElement | null = null;
  private resetButton: HTMLButtonElement | null = null;
  private initialCode: string;
  private state: EmbedState = 'idle';
  private destroyed = false;

  constructor(element: HTMLElement, options: Partial<EmbedOptions> = {}) {
    this.element = element;
    
    // Extract theme from data-theme attribute if present
    const dataTheme = element.getAttribute('data-theme');
    
    this.options = {
      ...DEFAULT_CONFIG,
      ...options,
      // Priority: options.theme > data-theme attribute > DEFAULT_CONFIG.theme
      theme: options.theme ?? dataTheme ?? DEFAULT_CONFIG.theme,
      initialCode: options.initialCode ?? this.extractInitialCode(),
    };
    this.initialCode = this.options.initialCode;

    this.init();
  }

  /**
   * Extract initial SQL code from element
   */
  private extractInitialCode(): string {
    // Check for <pre><code> structure
    const codeElement = this.element.querySelector('code');
    if (codeElement) {
      return codeElement.textContent?.trim() ?? '';
    }

    // Fallback to element text content
    return this.element.textContent?.trim() ?? '';
  }

  /**
   * Initialize the embed
   */
  private init(): void {
    this.createUI();
    this.attachEventListeners();
    this.updateEditor();
  }

  /**
   * Create UI structure
   */
  private createUI(): void {
    // Create container
    this.container = document.createElement('div');
    this.container.className = 'sql-workbench-container';

    // Determine theme
    const theme = this.resolveTheme();
    this.container.setAttribute('data-theme', theme);

    // Apply custom theme variables if needed
    try {
      const themeConfig = getThemeConfig(theme, this.options.customThemes);
      applyThemeConfig(this.container, themeConfig);
    } catch (error) {
      console.warn('Failed to apply custom theme:', error);
      // Fall back to default theme
      const fallbackTheme = theme === 'dark' ? 'dark' : 'light';
      this.container.setAttribute('data-theme', fallbackTheme);
    }

    // Create editor
    this.editorElement = document.createElement('div');
    this.editorElement.className = 'sql-workbench-editor';
    this.editorElement.contentEditable = String(this.options.editable);
    this.editorElement.spellcheck = false;
    this.editorElement.setAttribute('role', 'textbox');
    this.editorElement.setAttribute('aria-label', 'SQL Editor');
    this.editorElement.setAttribute('aria-multiline', 'true');

    // Set initial code
    this.editorElement.textContent = this.initialCode;

    // Create controls
    const controls = document.createElement('div');
    controls.className = 'sql-workbench-controls';

    this.runButton = document.createElement('button');
    this.runButton.className = 'sql-workbench-button sql-workbench-button-primary';
    this.runButton.textContent = 'Run';
    this.runButton.setAttribute('aria-label', 'Execute SQL query');

    this.resetButton = document.createElement('button');
    this.resetButton.className = 'sql-workbench-button sql-workbench-button-secondary';
    this.resetButton.textContent = 'Reset';
    this.resetButton.setAttribute('aria-label', 'Reset to original code');

    controls.appendChild(this.runButton);
    controls.appendChild(this.resetButton);

    // Create output area
    this.outputElement = document.createElement('div');
    this.outputElement.className = 'sql-workbench-output sql-workbench-output-empty';
    this.outputElement.textContent = 'Run a query to see results';
    this.outputElement.setAttribute('role', 'region');
    this.outputElement.setAttribute('aria-label', 'Query results');
    this.outputElement.setAttribute('aria-live', 'polite');

    // Assemble
    this.container.appendChild(this.editorElement);
    this.container.appendChild(controls);
    this.container.appendChild(this.outputElement);

    // Replace original element
    this.element.parentNode?.replaceChild(this.container, this.element);
  }

  /**
   * Resolve theme (auto, light, dark, or custom)
   */
  private resolveTheme(): string {
    if (this.options.theme === 'light' || this.options.theme === 'dark') {
      return this.options.theme;
    }

    // Handle custom themes
    if (this.options.theme && this.options.theme !== 'auto') {
      return this.options.theme;
    }

    // Auto-detect based on system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    return 'light';
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Run button
    this.runButton?.addEventListener('click', () => this.run());

    // Reset button
    this.resetButton?.addEventListener('click', () => this.reset());

    // Keyboard shortcuts
    this.editorElement?.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.run();
      }
      // Handle Enter key to insert newline character instead of browser default
      else if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.insertText('\n');
      }
      // Handle Tab key to insert spaces
      else if (e.key === 'Tab') {
        e.preventDefault();
        this.insertText('  '); // Insert 2 spaces for tab
      }
    });

    // Syntax highlighting on input (debounced)
    if (this.options.editable) {
      const debouncedUpdate = debounce(() => this.updateEditor(), 150);
      this.editorElement?.addEventListener('input', debouncedUpdate);
    }
  }

  /**
   * Update editor with syntax highlighting
   */
  private updateEditor(): void {
    if (!this.editorElement) return;

    // Get current code
    const code = this.getCode();

    // Save cursor position relative to text content
    const selection = window.getSelection();
    let cursorPosition = 0;

    if (this.options.editable && selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(this.editorElement);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      cursorPosition = preCaretRange.toString().length;
    }

    // Apply syntax highlighting
    const highlighted = highlightSQL(code);
    this.editorElement.innerHTML = highlighted;

    // Restore cursor position
    if (this.options.editable && cursorPosition > 0) {
      try {
        this.setCursorPosition(cursorPosition);
      } catch {
        // Cursor restoration failed, ignore
      }
    }
  }

  /**
   * Insert text at current cursor position
   */
  private insertText(text: string): void {
    const selection = window.getSelection();
    if (!selection || !this.editorElement) return;

    // Delete any selected content first
    if (!selection.isCollapsed) {
      selection.deleteFromDocument();
    }

    // Get current cursor position
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(this.editorElement);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    const cursorPosition = preCaretRange.toString().length;

    // Insert text into the code
    const code = this.getCode();
    const newCode = code.substring(0, cursorPosition) + text + code.substring(cursorPosition);
    
    // Update editor with new code
    const highlighted = highlightSQL(newCode);
    this.editorElement.innerHTML = highlighted;

    // Restore cursor position after the inserted text
    this.setCursorPosition(cursorPosition + text.length);

    // Trigger input event for consistency
    const event = new Event('input', { bubbles: true });
    this.editorElement.dispatchEvent(event);
  }

  /**
   * Set cursor position in editor
   */
  private setCursorPosition(position: number): void {
    if (!this.editorElement) return;

    const selection = window.getSelection();
    if (!selection) return;

    let charCount = 0;
    const nodeIterator = document.createNodeIterator(
      this.editorElement,
      NodeFilter.SHOW_TEXT
    );

    let currentNode = nodeIterator.nextNode();
    let found = false;

    while (currentNode) {
      const textLength = currentNode.textContent?.length ?? 0;

      if (charCount + textLength >= position) {
        const range = document.createRange();
        const offset = Math.min(position - charCount, textLength);
        range.setStart(currentNode, offset);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        found = true;
        break;
      }

      charCount += textLength;
      currentNode = nodeIterator.nextNode();
    }

    // If we couldn't find the exact position, place cursor at the end
    if (!found && this.editorElement.lastChild) {
      const range = document.createRange();
      range.selectNodeContents(this.editorElement);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  /**
   * Get current SQL code from editor
   */
  private getCode(): string {
    return this.editorElement?.textContent ?? '';
  }

  /**
   * Set SQL code in editor
   */
  private setCode(code: string): void {
    if (!this.editorElement) return;
    this.editorElement.textContent = code;
    this.updateEditor();
  }

  /**
   * Run SQL query
   */
  async run(): Promise<void> {
    if (this.state === 'loading') return;

    const sql = this.getCode();
    if (!sql.trim()) {
      this.showError('No SQL query to execute');
      return;
    }

    this.setState('loading');
    this.showLoading();

    const startTime = performance.now();

    try {
      // Configure DuckDB if not initialized
      if (!duckDBManager.isInitialized()) {
        duckDBManager.configure({
          version: this.options.duckdbVersion,
          cdn: this.options.duckdbCDN,
        });
      }

      // Resolve and register file paths
      const pathMap = resolvePathsInSQL(sql, { baseUrl: this.options.baseUrl });

      for (const [originalPath, resolvedUrl] of pathMap.entries()) {
        // Extract filename for registration
        const filename = originalPath.split('/').pop() ?? originalPath;
        await duckDBManager.registerFile(filename, resolvedUrl);
      }

      // Execute query
      const result = await duckDBManager.query(sql);

      // Ensure minimum loading duration for UX
      const elapsed = performance.now() - startTime;
      if (elapsed < 200) {
        await new Promise(resolve => setTimeout(resolve, 200 - elapsed));
      }

      this.setState('success');
      this.showResult(result);
    } catch (error) {
      // Ensure minimum loading duration even on error
      const elapsed = performance.now() - startTime;
      if (elapsed < 200) {
        await new Promise(resolve => setTimeout(resolve, 200 - elapsed));
      }

      this.setState('error');
      this.showError(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Reset to original code
   */
  reset(): void {
    this.setCode(this.initialCode);
    this.setState('idle');
    if (this.outputElement) {
      this.outputElement.className = 'sql-workbench-output sql-workbench-output-empty';
      this.outputElement.textContent = 'Run a query to see results';
    }
  }

  /**
   * Set embed state
   */
  private setState(state: EmbedState): void {
    this.state = state;

    // Update button states
    if (this.runButton && this.resetButton) {
      this.runButton.disabled = state === 'loading';
      this.resetButton.disabled = state === 'loading';
    }
  }

  /**
   * Show loading state
   */
  private showLoading(): void {
    if (!this.outputElement) return;

    this.outputElement.className = 'sql-workbench-output sql-workbench-loading';
    this.outputElement.innerHTML = `
      <div class="sql-workbench-loading">
        <div class="sql-workbench-spinner"></div>
        <span>Executing query...</span>
      </div>
    `;
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    if (!this.outputElement) return;

    this.outputElement.className = 'sql-workbench-output';
    this.outputElement.innerHTML = `
      <div class="sql-workbench-error">
        <div class="sql-workbench-error-title">Error</div>
        <div>${this.escapeHtml(message)}</div>
      </div>
    `;
  }

  /**
   * Show query result
   */
  private showResult(result: QueryResult): void {
    if (!this.outputElement) return;

    this.outputElement.className = 'sql-workbench-output';

    if (result.rowCount === 0) {
      this.outputElement.innerHTML = `
        <div>Query executed successfully. No rows returned.</div>
        <div class="sql-workbench-metadata">
          <span>Execution time: ${result.executionTime.toFixed(2)}ms</span>
        </div>
      `;
      return;
    }

    // Build table
    let tableHTML = '<div class="sql-workbench-result-table"><table><thead><tr>';

    for (const column of result.columns) {
      tableHTML += `<th>${this.escapeHtml(column)}</th>`;
    }

    tableHTML += '</tr></thead><tbody>';

    for (const row of result.rows) {
      tableHTML += '<tr>';
      for (const cell of row) {
        const cellValue = cell === null || cell === undefined ? 'NULL' : String(cell);
        tableHTML += `<td>${this.escapeHtml(cellValue)}</td>`;
      }
      tableHTML += '</tr>';
    }

    tableHTML += '</tbody></table></div>';

    // Add metadata
    tableHTML += `
      <div class="sql-workbench-metadata">
        <span>${result.rowCount} row${result.rowCount === 1 ? '' : 's'}</span>
        <span>Execution time: ${result.executionTime.toFixed(2)}ms</span>
        <span>${result.columns.length} column${result.columns.length === 1 ? '' : 's'}</span>
      </div>
    `;

    this.outputElement.innerHTML = tableHTML;
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Destroy embed and cleanup
   */
  destroy(): void {
    if (this.destroyed) return;

    // Remove event listeners (handled by removing DOM elements)
    this.container?.remove();

    // Clear references
    this.container = null;
    this.editorElement = null;
    this.outputElement = null;
    this.runButton = null;
    this.resetButton = null;

    this.destroyed = true;
  }

  /**
   * Check if embed is destroyed
   */
  isDestroyed(): boolean {
    return this.destroyed;
  }

  /**
   * Get embed container element
   */
  getContainer(): HTMLElement | null {
    return this.container;
  }
}
