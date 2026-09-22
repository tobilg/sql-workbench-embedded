import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DuckDBManager } from '../duckdb-manager';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

const emptyResult = () => ({ schema: { fields: [] }, numRows: 0, getChildAt: () => null });

describe('DuckDB startup, loading, and shutdown', () => {
  let manager: DuckDBManager;
  let connection: { query: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
  let db: Record<string, ReturnType<typeof vi.fn>>;
  let module: any;

  beforeEach(() => {
    manager = new DuckDBManager();
    connection = { query: vi.fn(async () => emptyResult()), close: vi.fn(async () => {}) };
    db = {
      instantiate: vi.fn(async () => {}),
      connect: vi.fn(async () => connection),
      terminate: vi.fn(async () => {}),
      registerFileURL: vi.fn(async () => {}),
    };
    module = {
      PACKAGE_VERSION: '1.31.1-dev1.0',
      DuckDBDataProtocol: { HTTP: 4 },
      ConsoleLogger: vi.fn(function() {}),
      AsyncDuckDB: vi.fn(function() { return db; }),
      selectBundle: vi.fn(async bundles => bundles.eh),
    };
    (window as any).duckdb = module;
  });

  afterEach(async () => {
    await manager.close();
    delete (window as any).duckdb;
  });

  it('shares startup and remains uninitialized until the connection is ready', async () => {
    const gate = deferred();
    db.instantiate.mockReturnValue(gate.promise);
    const first = manager.query('SELECT 1');
    await vi.waitFor(() => expect(db.instantiate).toHaveBeenCalledOnce());
    expect(manager.isInitialized()).toBe(false);
    const second = manager.query('SELECT 2');
    await Promise.resolve();
    expect(connection.query).not.toHaveBeenCalled();
    gate.resolve();
    await Promise.all([first, second]);
    expect(module.AsyncDuckDB).toHaveBeenCalledOnce();
    expect(connection.query.mock.calls.map(call => call[0])).toEqual(['SELECT 1', 'SELECT 2']);
    expect(manager.isInitialized()).toBe(true);
  });

  it.each(['instantiate', 'connect'])('cleans up a failed %s and allows retry', async stage => {
    db[stage]!.mockRejectedValueOnce(new Error('temporary failure'));
    await expect(manager.query('SELECT 1')).rejects.toThrow('temporary failure');
    expect(manager.isInitialized()).toBe(false);
    expect(db.terminate).toHaveBeenCalledOnce();
    expect(vi.mocked(Worker).mock.instances[0].terminate).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
    await expect(manager.query('SELECT 2')).resolves.toMatchObject({ rowCount: 0 });
    expect(module.AsyncDuckDB).toHaveBeenCalledTimes(2);
    expect(manager.isInitialized()).toBe(true);
  });

  it('revokes the blob even if worker construction fails', async () => {
    vi.mocked(Worker).mockImplementationOnce(function() { throw new Error('worker refused'); });
    await expect(manager.query('SELECT 1')).rejects.toThrow('worker refused');
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
    await manager.query('SELECT 2');
  });

  it('waits for startup and active work before shutdown', async () => {
    const gate = deferred();
    db.instantiate.mockReturnValueOnce(gate.promise);
    const query = manager.query('SELECT 1');
    await vi.waitFor(() => expect(db.instantiate).toHaveBeenCalledOnce());
    const close = manager.close();
    expect(manager.close()).toBe(close);
    expect(db.terminate).not.toHaveBeenCalled();
    gate.resolve();
    await Promise.all([query, close]);
    expect(connection.close).toHaveBeenCalledOnce();
    expect(db.terminate).toHaveBeenCalledOnce();
    expect(manager.isInitialized()).toBe(false);
    await manager.query('SELECT 2');
    expect(module.AsyncDuckDB).toHaveBeenCalledTimes(2);
  });

  it('holds new queries until an in-flight query and shutdown finish', async () => {
    await manager.query('SELECT 1');
    const gate = deferred<ReturnType<typeof emptyResult>>();
    connection.query.mockReturnValueOnce(gate.promise);
    const active = manager.query('SELECT 2');
    await vi.waitFor(() => expect(connection.query).toHaveBeenCalledTimes(2));
    const close = manager.close();
    const next = manager.query('SELECT 3');
    expect(db.terminate).not.toHaveBeenCalled();
    gate.resolve(emptyResult());
    await Promise.all([active, close, next]);
    expect(module.AsyncDuckDB).toHaveBeenCalledTimes(2);
    expect(connection.query).toHaveBeenLastCalledWith('SELECT 3');
  });

  it('terminates and resets state even when closing the connection fails', async () => {
    await manager.query('SELECT 1');
    connection.close.mockRejectedValueOnce(new Error('close failed'));
    await expect(manager.close()).rejects.toThrow('close failed');
    expect(db.terminate).toHaveBeenCalledOnce();
    expect(manager.isInitialized()).toBe(false);
    await manager.query('SELECT 2');
  });

  it('constructs both bundles from the configured host and version', async () => {
    manager.configure({ cdn: 'https://mirror.example/duckdb/' });
    await manager.query('SELECT 1');
    const dist = 'https://mirror.example/duckdb@1.31.1-dev1.0/dist';
    expect(module.selectBundle).toHaveBeenCalledWith({
      mvp: { mainModule: `${dist}/duckdb-mvp.wasm`, mainWorker: `${dist}/duckdb-browser-mvp.worker.js` },
      eh: { mainModule: `${dist}/duckdb-eh.wasm`, mainWorker: `${dist}/duckdb-browser-eh.worker.js` },
    });
    expect(fetch).toHaveBeenCalledWith(`${dist}/duckdb-browser-eh.worker.js`);
  });

  it('uses the configured module URL when available modules have a different version', async () => {
    manager.configure({ cdn: 'https://mirror.example/duckdb', version: '9.9.9' });
    const load = vi.spyOn(manager as any, 'importCDNModule').mockResolvedValue(module);
    await manager.query('SELECT 1');
    expect(load).toHaveBeenCalledWith('https://mirror.example/duckdb@9.9.9/+esm');
    expect(fetch).toHaveBeenCalledWith('https://mirror.example/duckdb@9.9.9/dist/duckdb-browser-eh.worker.js');
  });

  it('reports the configured URL on module loading failure and permits a retry', async () => {
    manager.configure({ version: '9.9.9', cdn: 'https://mirror.example/duckdb' });
    const load = vi.spyOn(manager as any, 'importCDNModule').mockRejectedValueOnce(new Error('offline'));
    await expect(manager.query('SELECT 1')).rejects.toThrow('https://mirror.example/duckdb@9.9.9/+esm');
    load.mockResolvedValue(module);
    await manager.query('SELECT 2');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('passes the pthread worker URL, not the main worker URL', async () => {
    module.selectBundle.mockResolvedValue({ mainModule: 'engine.wasm', mainWorker: 'duckdb-main.js', pthreadWorker: 'duckdb-pthread.js' });
    await manager.query('SELECT 1');
    expect(db.instantiate).toHaveBeenCalledWith('engine.wasm', 'duckdb-pthread.js');
  });

  it('deduplicates concurrent registration and retries failed registrations', async () => {
    const gate = deferred();
    db.registerFileURL.mockReturnValueOnce(gate.promise);
    const a = manager.registerFile('https://a.test/data.csv', 'https://a.test/data.csv');
    const b = manager.registerFile('https://a.test/data.csv', 'https://a.test/data.csv');
    await vi.waitFor(() => expect(db.registerFileURL).toHaveBeenCalledOnce());
    gate.resolve();
    await Promise.all([a, b]);
    db.registerFileURL.mockRejectedValueOnce(new Error('network error'));
    await expect(manager.registerFile('https://b.test/data.csv', 'https://b.test/data.csv')).rejects.toThrow('network error');
    await manager.registerFile('https://b.test/data.csv', 'https://b.test/data.csv');
    expect(db.registerFileURL).toHaveBeenCalledTimes(3);
  });

  it('does not share the caller\'s initialization query array', async () => {
    const queries = ['SELECT 1'];
    manager.configureInitQueries(queries);
    queries.push('SELECT 2');
    await manager.query('SELECT 3');
    expect(connection.query.mock.calls.map(call => call[0])).toEqual(['SELECT 1', 'SELECT 3']);
  });
});
