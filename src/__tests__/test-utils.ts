import { vi } from 'vitest';
import type { QueryResult, DuckDBConnection } from '../types';

/**
 * Creates a mock DuckDB connection for testing
 */
export function createMockConnection(): DuckDBConnection {
  return {
    query: vi.fn(async (sql: string) => {
      // Mock Arrow result
      return {
        toArray: () => [
          { id: 1, name: 'Alice', age: 30 },
          { id: 2, name: 'Bob', age: 25 },
        ],
        schema: {
          fields: [
            { name: 'id', type: { toString: () => 'Int32' } },
            { name: 'name', type: { toString: () => 'Utf8' } },
            { name: 'age', type: { toString: () => 'Int32' } },
          ],
        },
        numRows: 2,
      };
    }),
    close: vi.fn(),
    insertCSVFromPath: vi.fn(),
    insertJSONFromPath: vi.fn(),
  } as any;
}

/**
 * Creates a mock query result for testing
 */
export function createMockQueryResult(): QueryResult {
  return {
    columns: [
      { name: 'id', type: 'Int32' },
      { name: 'name', type: 'Utf8' },
      { name: 'age', type: 'Int32' },
    ],
    rows: [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 },
    ],
    rowCount: 2,
    executionTime: 42,
  };
}

/**
 * Creates a DOM element with SQL code for testing embeds
 */
export function createSQLElement(sql: string, className = 'sql-workbench-embedded'): HTMLElement {
  const pre = document.createElement('pre');
  pre.className = className;
  const code = document.createElement('code');
  code.textContent = sql;
  pre.appendChild(code);
  document.body.appendChild(pre);
  return pre;
}

/**
 * Creates a simple pre element without code wrapper
 */
export function createSimpleSQLElement(sql: string, className = 'sql-workbench-embedded'): HTMLElement {
  const pre = document.createElement('pre');
  pre.className = className;
  pre.textContent = sql;
  document.body.appendChild(pre);
  return pre;
}

/**
 * Waits for a specified amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits for a condition to be true
 */
export async function waitFor(
  condition: () => boolean,
  timeout = 1000,
  interval = 10
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await wait(interval);
  }
}

/**
 * Gets the text content of an element, ignoring HTML tags
 */
export function getTextContent(element: HTMLElement): string {
  return element.textContent || '';
}

/**
 * Gets the HTML content of an element
 */
export function getHTMLContent(element: HTMLElement): string {
  return element.innerHTML;
}

/**
 * Simulates a keyboard event
 */
export function simulateKeyPress(
  element: HTMLElement,
  key: string,
  options: Partial<KeyboardEventInit> = {}
): void {
  const event = new KeyboardEvent('keydown', {
    key,
    code: key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  element.dispatchEvent(event);
}

/**
 * Simulates a click event
 */
export function simulateClick(element: HTMLElement): void {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(event);
}

/**
 * Advances all timers by the specified time
 */
export function advanceTimers(ms: number): void {
  vi.advanceTimersByTime(ms);
}

/**
 * Mocks the system theme preference
 */
export function mockSystemTheme(theme: 'light' | 'dark'): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === `(prefers-color-scheme: ${theme})`,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

/**
 * Gets computed style variables from an element
 */
export function getCSSVariable(element: HTMLElement, varName: string): string {
  return getComputedStyle(element).getPropertyValue(varName).trim();
}

/**
 * Checks if an element has a specific CSS class
 */
export function hasClass(element: HTMLElement, className: string): boolean {
  return element.classList.contains(className);
}

/**
 * Creates a mock blob URL
 */
export function createMockBlobURL(content: string = 'mock content'): string {
  return `blob:http://localhost:3000/${Math.random().toString(36).substr(2, 9)}`;
}
