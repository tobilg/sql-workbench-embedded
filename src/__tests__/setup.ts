import { vi, beforeEach, afterEach } from 'vitest';

// Mock DuckDB WASM module
vi.mock('@duckdb/duckdb-wasm', () => ({
  selectBundle: vi.fn(() => ({
    mainModule: 'duckdb-mvp.wasm',
    mainWorker: 'duckdb-browser-mvp.worker.js',
  })),
  ConsoleLogger: vi.fn(function(this: any) {
    this.log = vi.fn();
  }),
  AsyncDuckDB: vi.fn(function(this: any) {
    // Mock AsyncDuckDB constructor
  }),
}));

// Setup DOM environment
beforeEach(() => {
  // Clear document body
  document.body.innerHTML = '';
  document.head.innerHTML = '';

  // Reset window.SQLWorkbench
  if ((window as any).SQLWorkbench) {
    delete (window as any).SQLWorkbench;
  }

  // Mock MutationObserver
  const MockMutationObserver = vi.fn(function(this: any, callback: MutationCallback) {
    this.observe = vi.fn();
    this.disconnect = vi.fn();
    this.takeRecords = vi.fn(() => []);
  }) as any;

  // Add prototype methods for spying
  MockMutationObserver.prototype.observe = vi.fn();
  MockMutationObserver.prototype.disconnect = vi.fn();
  MockMutationObserver.prototype.takeRecords = vi.fn(() => []);

  global.MutationObserver = MockMutationObserver;

  // Mock fetch for CDN loading
  global.fetch = vi.fn((url: string) => {
    if (typeof url === 'string' && url.includes('duckdb')) {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(`
          self.onmessage = function() {
            postMessage({ type: 'init' });
          };
        `),
        blob: () => Promise.resolve(new Blob(['mock worker'])),
      } as any);
    }
    return Promise.reject(new Error('Not found'));
  }) as any;

  // Mock URL.createObjectURL
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = vi.fn();

  // Mock Worker
  global.Worker = vi.fn(function(this: any, scriptURL: string | URL, options?: WorkerOptions) {
    this.postMessage = vi.fn();
    this.terminate = vi.fn();
    this.addEventListener = vi.fn();
    this.removeEventListener = vi.fn();
    this.dispatchEvent = vi.fn();
    this.onerror = null;
    this.onmessage = null;
    this.onmessageerror = null;
  }) as any;

  // Mock window.matchMedia (default to light theme)
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? false : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.clearAllMocks();
});
