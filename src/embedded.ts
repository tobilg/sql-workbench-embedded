/**
 * SQL Workbench Embedded class
 * Main class for creating interactive SQL embeds
 */

import { EmbeddedOptions, EmbeddedState, QueryResult, DEFAULT_CONFIG } from './types';
import { highlightSQL, debounce } from './syntax-highlight';
import { resolvePathsInSQL } from './path-resolver';
import { duckDBManager } from './duckdb-manager';
import { getThemeConfig, applyThemeConfig } from './styles';

export class Embedded {
  private element: HTMLElement;
  private options: Required<EmbeddedOptions>;
  private container: HTMLElement | null = null;
  private editorElement: HTMLDivElement | null = null;
  private outputElement: HTMLDivElement | null = null;
  private runButton: HTMLButtonElement | null = null;
  private resetButton: HTMLButtonElement | null = null;
  private openButton: HTMLButtonElement | null = null;
  private initialCode: string;
  private state: EmbeddedState = 'idle';
  private destroyed = false;

  constructor(element: HTMLElement, options: Partial<EmbeddedOptions> = {}) {
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

    // Create editor wrapper
    const editorWrapper = document.createElement('div');
    editorWrapper.className = 'sql-workbench-editor-wrapper';

    // Create editor header with buttons
    const editorHeader = document.createElement('div');
    editorHeader.className = 'sql-workbench-editor-header';

    // Create "Open in SQL Workbench" button if enabled
    if (this.options.showOpenButton) {
      this.openButton = document.createElement('button');
      this.openButton.className = 'sql-workbench-button sql-workbench-button-secondary sql-workbench-button-icon sql-workbench-button-open';
      this.openButton.setAttribute('aria-label', 'Open in SQL Workbench');
      this.openButton.setAttribute('title', 'Open in SQL Workbench');
      this.openButton.innerHTML = `<svg fill="currentColor" version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 209.322 209.322">
        <g>
          <path d="M105.572,101.811c9.889-6.368,27.417-16.464,28.106-42.166c0.536-20.278-9.971-49.506-49.155-50.878
            C53.041,7.659,39.9,28.251,36.071,46.739l-0.928-0.126c-1.932,0-3.438,1.28-5.34,2.889c-2.084,1.784-4.683,3.979-7.792,4.308
            c-3.573,0.361-8.111-1.206-11.698-2.449c-4.193-1.431-6.624-2.047-8.265-0.759c-1.503,1.163-2.178,3.262-2.028,6.226
            c0.331,6.326,4.971,18.917,16.016,25.778c7.67,4.765,16.248,5.482,20.681,5.482c0.006,0,0.006,0,0.006,0
            c2.37,0,4.945-0.239,7.388-0.726c2.741,4.218,5.228,7.476,6.037,9.752c2.054,5.851-27.848,25.087-27.848,55.01
            c0,29.916,22.013,48.475,56.727,48.475h55.004c30.593,0,70.814-29.908,75.291-92.48C180.781,132.191,167.028,98.15,105.572,101.811
            z M18.941,77.945C8.775,71.617,4.992,58.922,5.294,55.525c0.897,0.24,2.194,0.689,3.228,1.042
            c4.105,1.415,9.416,3.228,14.068,2.707c4.799-0.499,8.253-3.437,10.778-5.574c0.607-0.509,1.393-1.176,1.872-1.491
            c0.87,0.315,0.962,0.693,1.176,3.14c0.196,2.26,0.473,5.37,2.362,9.006c1.437,2.761,3.581,5.705,5.646,8.542
            c1.701,2.336,4.278,5.871,4.535,6.404c-0.445,1.184-4.907,3.282-12.229,3.282C30.177,82.591,23.69,80.904,18.941,77.945z
            M56.86,49.368c0-4.938,4.001-8.943,8.931-8.943c4.941,0,8.942,4.005,8.942,8.943c0,4.931-4.001,8.942-8.942,8.942
            C60.854,58.311,56.86,54.299,56.86,49.368z M149.159,155.398l-20.63,11.169l13.408,9.293c0,0-49.854,15.813-72.198-6.885
            c-11.006-11.16-13.06-28.533,4.124-38.84c17.184-10.312,84.609,3.943,84.609,3.943L134.295,147.8L149.159,155.398z"/>
        </g>
      </svg>`;
      editorHeader.appendChild(this.openButton);
    }

    this.resetButton = document.createElement('button');
    this.resetButton.className = 'sql-workbench-button sql-workbench-button-secondary sql-workbench-button-reset sql-workbench-button-hidden';
    this.resetButton.textContent = 'Reset';
    this.resetButton.setAttribute('aria-label', 'Reset to original code');

    this.runButton = document.createElement('button');
    this.runButton.className = 'sql-workbench-button sql-workbench-button-primary sql-workbench-button-run';
    this.runButton.textContent = 'Run';
    this.runButton.setAttribute('aria-label', 'Execute SQL query');

    editorHeader.appendChild(this.resetButton);
    editorHeader.appendChild(this.runButton);

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

    // Assemble editor section
    editorWrapper.appendChild(editorHeader);
    editorWrapper.appendChild(this.editorElement);

    // Create output area (initially hidden)
    this.outputElement = document.createElement('div');
    this.outputElement.className = 'sql-workbench-output sql-workbench-output-hidden';
    this.outputElement.setAttribute('role', 'region');
    this.outputElement.setAttribute('aria-label', 'Query results');
    this.outputElement.setAttribute('aria-live', 'polite');

    // Assemble
    this.container.appendChild(editorWrapper);
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

    // Open button
    this.openButton?.addEventListener('click', () => this.openInSQLWorkbench());

    // Keyboard shortcuts
    this.editorElement?.addEventListener('keydown', (e) => {
      // Open in SQL Workbench: CMD/CTRL + Shift + Enter
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        this.openInSQLWorkbench();
        return;
      }
      // Run query: CMD/CTRL + Enter
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.run();
        return;
      }
      // Reset to original: CMD/CTRL + Backspace
      if ((e.ctrlKey || e.metaKey) && e.key === 'Backspace') {
        if (this.state === 'loading') return; // Don't allow reset during query execution
        e.preventDefault();
        this.reset();
        return;
      }
      // Handle Enter key to insert newline character instead of browser default
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.insertText('\n');
        return;
      }
      // Handle Tab key to insert spaces
      if (e.key === 'Tab') {
        e.preventDefault();
        this.insertText('  '); // Insert 2 spaces for tab
        return;
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
      this.showResetButton();
    } catch (error) {
      // Ensure minimum loading duration even on error
      const elapsed = performance.now() - startTime;
      if (elapsed < 200) {
        await new Promise(resolve => setTimeout(resolve, 200 - elapsed));
      }

      this.setState('error');
      this.showError(error instanceof Error ? error.message : String(error));
      this.showResetButton();
    }
  }

  /**
   * Reset to original code
   */
  reset(): void {
    this.setCode(this.initialCode);
    this.setState('idle');
    if (this.outputElement) {
      this.outputElement.className = 'sql-workbench-output sql-workbench-output-hidden';
      this.outputElement.textContent = '';
    }
    // Hide the Reset button again
    if (this.resetButton) {
      this.resetButton.classList.add('sql-workbench-button-hidden');
    }
  }

  /**
   * Set embed state
   */
  private setState(state: EmbeddedState): void {
    this.state = state;

    // Update button states
    if (this.runButton && this.resetButton) {
      this.runButton.disabled = state === 'loading';
      this.resetButton.disabled = state === 'loading';
    }
  }

  /**
   * Show the Reset button (called after first query execution)
   */
  private showResetButton(): void {
    if (this.resetButton) {
      this.resetButton.classList.remove('sql-workbench-button-hidden');
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
        <span>${result.columns.length} column${result.columns.length === 1 ? '' : 's'}</span>
        <span>Execution time: ${result.executionTime.toFixed(2)}ms</span>
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
   * Encode query for URL using URL-safe Base64 without padding
   */
  private encodeQueryForURL(query: string): string {
    // Convert to Base64
    const base64 = btoa(unescape(encodeURIComponent(query)));
    
    // Make URL-safe: replace + with -, / with _, and remove padding =
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Open current query in SQL Workbench
   */
  private openInSQLWorkbench(): void {
    const query = this.getCode();
    if (!query.trim()) return;

    const encodedQuery = this.encodeQueryForURL(query);
    const url = `https://sql-workbench.com/#queries=v1,${encodedQuery}`;
    
    window.open(url, '_blank', 'noopener');
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
    this.openButton = null;

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
