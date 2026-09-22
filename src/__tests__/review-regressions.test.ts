import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { SQLWorkbench } from '../index';
import { duckDBManager } from '../duckdb-manager';
import { getEditorText } from '../editor-text';
import { createSQLElement } from './test-utils';

vi.mock('../duckdb-manager');

function removed(...nodes: Node[]) {
  const callback = vi.mocked(MutationObserver).mock.calls.at(-1)![0];
  callback([{ type: 'childList', removedNodes: nodes } as unknown as MutationRecord], {} as MutationObserver);
}

async function run(embed: InstanceType<typeof SQLWorkbench.Embedded>) {
  const pending = embed.run();
  await vi.runAllTimersAsync();
  await pending;
}

describe('embed integration regressions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    SQLWorkbench.config({ autoInit: false });
    vi.mocked(duckDBManager.close).mockResolvedValue(undefined);
    vi.mocked(duckDBManager.isInitialized).mockReturnValue(false);
    vi.mocked(duckDBManager.registerFile).mockResolvedValue(undefined);
    vi.mocked(duckDBManager.query).mockResolvedValue({ columns: [], rows: [], rowCount: 0, executionTime: 1 });
  });
  afterEach(async () => {
    await SQLWorkbench.destroy();
    vi.useRealTimers();
  });

  it('injects styles when only the constructor is used', () => {
    new SQLWorkbench.Embedded(createSQLElement('SELECT 1'));
    new SQLWorkbench.Embedded(createSQLElement('SELECT 2'));
    expect(document.querySelectorAll('#sql-workbench-embedded-styles')).toHaveLength(1);
  });

  it('keeps one observer and releases it on global destruction', async () => {
    new SQLWorkbench.Embedded(createSQLElement('SELECT 1'));
    SQLWorkbench.init();
    SQLWorkbench.init();
    new SQLWorkbench.Embedded(createSQLElement('SELECT 2'));
    expect(MutationObserver).toHaveBeenCalledOnce();
    const observer = vi.mocked(MutationObserver).mock.instances[0];
    await SQLWorkbench.destroy();
    expect(observer.disconnect).toHaveBeenCalled();
    new SQLWorkbench.Embedded(createSQLElement('SELECT 3'));
    expect(MutationObserver).toHaveBeenCalledTimes(2);
  });

  it('destroys embeds within a removed ancestor and unregisters them', () => {
    const wrapper = document.createElement('section');
    document.body.append(wrapper);
    const source = createSQLElement('SELECT 1');
    wrapper.append(source);
    const embed = new SQLWorkbench.Embedded(source);
    wrapper.remove();
    removed(wrapper);
    expect(embed.isDestroyed()).toBe(true);
    expect(embed.getContainer()).toBeNull();
    expect(vi.mocked(MutationObserver).mock.instances[0].disconnect).toHaveBeenCalled();
  });

  it('preserves embeds moved between connected parents', () => {
    const embed = new SQLWorkbench.Embedded(createSQLElement('SELECT 1'));
    const container = embed.getContainer()!;
    const nextParent = document.createElement('section');
    document.body.append(nextParent);
    nextParent.append(container);
    removed(container);
    expect(embed.isDestroyed()).toBe(false);
    expect(container.parentElement).toBe(nextParent);
  });

  it('globally destroys direct and discovered instances and returns the close promise', async () => {
    const direct = new SQLWorkbench.Embedded(createSQLElement('SELECT 1'));
    createSQLElement('SELECT 2');
    SQLWorkbench.init();
    let finish!: () => void;
    const closing = new Promise<void>(resolve => { finish = resolve; });
    vi.mocked(duckDBManager.close).mockReturnValueOnce(closing);
    const result = SQLWorkbench.destroy();
    expect(result).toBe(closing);
    expect(direct.isDestroyed()).toBe(true);
    expect(document.querySelectorAll('.sql-workbench-container')).toHaveLength(0);
    finish();
    await result;
  });

  it.each([false, true])('preserves Tab navigation, shift=%s', shiftKey => {
    const embed = new SQLWorkbench.Embedded(createSQLElement('SELECT 1'));
    const editor = embed.getContainer()!.querySelector('.sql-workbench-editor')!;
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
    editor.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(editor.textContent).toBe('SELECT 1');
  });

  it('does not submit a host form when controls are clicked', () => {
    const form = document.createElement('form');
    document.body.append(form);
    const source = createSQLElement('SELECT 1');
    form.append(source);
    const embed = new SQLWorkbench.Embedded(source);
    const submit = vi.fn(event => event.preventDefault());
    form.addEventListener('submit', submit);
    vi.spyOn(window, 'open').mockReturnValue(null);
    const buttons = embed.getContainer()!.querySelectorAll('button');
    expect([...buttons].every(button => button.type === 'button')).toBe(true);
    embed.getContainer()!.querySelector<HTMLButtonElement>('.sql-workbench-button-reset')!.click();
    embed.getContainer()!.querySelector<HTMLButtonElement>('.sql-workbench-button-open')!.click();
    expect(submit).not.toHaveBeenCalled();
  });

  it('applies real fallback colors for an unknown or incomplete theme', () => {
    SQLWorkbench.config({ customThemes: { incomplete: { config: {} } } });
    for (const theme of ['unknown', 'incomplete']) {
      const embed = new SQLWorkbench.Embedded(createSQLElement('SELECT 1'), { theme });
      const container = embed.getContainer()!;
      expect(container.dataset.theme).toBe('light');
      expect(container.style.getPropertyValue('--sw-bg-color')).toBe('#ffffff');
      expect(container.style.getPropertyValue('--sw-editor-text')).toBe('#333333');
    }
  });

  it('registers and executes distinct full URLs for same-name files', async () => {
    for (const [path, base] of [['./data.csv', 'https://a.test/files'], ['nested/data.csv', 'https://b.test/files']]) {
      const embed = new SQLWorkbench.Embedded(createSQLElement(`SELECT * FROM '${path}'`), { baseUrl: base });
      await run(embed);
    }
    expect(duckDBManager.registerFile).toHaveBeenNthCalledWith(1, 'https://a.test/files/data.csv', 'https://a.test/files/data.csv');
    expect(duckDBManager.registerFile).toHaveBeenNthCalledWith(2, 'https://b.test/files/nested/data.csv', 'https://b.test/files/nested/data.csv');
    expect(duckDBManager.query).toHaveBeenNthCalledWith(1, "SELECT * FROM 'https://a.test/files/data.csv'");
    expect(duckDBManager.query).toHaveBeenNthCalledWith(2, "SELECT * FROM 'https://b.test/files/nested/data.csv'");
  });

  it('keeps query literals unchanged while resolving table references', async () => {
    const sql = "SELECT 'data.csv' AS label FROM 'data.csv' -- 'data.csv'";
    const embed = new SQLWorkbench.Embedded(createSQLElement(sql), { baseUrl: 'https://data.test' });
    await run(embed);
    expect(duckDBManager.query).toHaveBeenCalledWith("SELECT 'data.csv' AS label FROM 'https://data.test/data.csv' -- 'data.csv'");
  });

  it('isolates supplied config, returned config, and per-instance config', async () => {
    const config = { initQueries: ['SELECT 1'], customThemes: { ocean: { extends: 'dark' as const, config: { primaryBg: '#123456' } } } };
    SQLWorkbench.config(config);
    config.initQueries.push('SELECT 2');
    config.customThemes.ocean.config.primaryBg = '#ffffff';
    const snapshot = SQLWorkbench.getConfig();
    snapshot.initQueries.push('SELECT 3');
    snapshot.customThemes.ocean!.config.primaryBg = '#000000';
    expect(SQLWorkbench.getConfig().initQueries).toEqual(['SELECT 1']);
    expect(SQLWorkbench.getConfig().customThemes.ocean!.config.primaryBg).toBe('#123456');
    const options = { theme: 'ocean', initQueries: ['SELECT 4'] };
    const embed = new SQLWorkbench.Embedded(createSQLElement('SELECT 5'), options);
    options.initQueries.push('SELECT 6');
    SQLWorkbench.config({ initQueries: ['SELECT 7'] });
    await run(embed);
    expect(duckDBManager.configureInitQueries).toHaveBeenCalledWith(['SELECT 4']);
    expect(embed.getContainer()!.style.getPropertyValue('--sw-primary-bg')).toBe('#123456');
  });

  it('normalizes HTML line breaks before executing the query', async () => {
    const embed = new SQLWorkbench.Embedded(createSQLElement('SELECT 1'));
    const editor = embed.getContainer()!.querySelector('.sql-workbench-editor')!;
    editor.innerHTML = 'SELECT 1 -- comment<br>+ 2';
    editor.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(150);
    expect(editor.textContent).toBe('SELECT 1 -- comment\n+ 2');
    await run(embed);
    expect(duckDBManager.query).toHaveBeenCalledWith('SELECT 1 -- comment\n+ 2');
  });

  it('pastes plain text without inserting clipboard HTML', () => {
    const embed = new SQLWorkbench.Embedded(createSQLElement('SELECT 1'));
    const editor = embed.getContainer()!.querySelector<HTMLElement>('.sql-workbench-editor')!;
    const range = document.createRange();
    range.selectNodeContents(editor);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    const event = new Event('paste', { bubbles: true, cancelable: true });
    const sql = "SELECT '<img src=x>'\n-- second line";
    Object.defineProperty(event, 'clipboardData', { value: { getData: (type: string) => type === 'text/plain' ? sql : '<img src=x>' } });
    editor.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(editor.textContent).toBe(sql);
    expect(editor.querySelector('img')).toBeNull();
  });

  it('preserves a selection while highlighting and leaves composition untouched', async () => {
    const embed = new SQLWorkbench.Embedded(createSQLElement('SELECT 1'));
    const editor = embed.getContainer()!.querySelector<HTMLElement>('.sql-workbench-editor')!;
    editor.textContent = 'SELECT 12';
    const selection = window.getSelection()!;
    selection.setBaseAndExtent(editor.firstChild!, 7, editor.firstChild!, 9);
    editor.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(150);
    expect(selection.toString()).toBe('12');
    editor.dispatchEvent(new Event('compositionstart'));
    editor.innerHTML = 'SELECT 123';
    editor.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(150);
    expect(editor.innerHTML).toBe('SELECT 123');
    editor.dispatchEvent(new Event('compositionend'));
    expect(editor.querySelector('.sql-keyword')).not.toBeNull();
  });

  it('does not execute a destroyed embed', async () => {
    const embed = new SQLWorkbench.Embedded(createSQLElement('SELECT 1'));
    embed.destroy();
    await embed.run();
    expect(duckDBManager.query).not.toHaveBeenCalled();
  });

  it('does not restart the engine if destroyed while registering a file', async () => {
    let finish!: () => void;
    vi.mocked(duckDBManager.registerFile).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const embed = new SQLWorkbench.Embedded(createSQLElement("SELECT * FROM 'data.csv'"));
    const pending = embed.run();
    await SQLWorkbench.destroy();
    finish();
    await pending;
    expect(duckDBManager.query).not.toHaveBeenCalled();
  });
});

describe('HTML editor text', () => {
  it.each([
    ['SELECT 1<br>+ 2', 'SELECT 1\n+ 2'],
    ['<div>SELECT 1</div><div>+ 2</div>', 'SELECT 1\n+ 2'],
    ['SELECT 1<div>+ 2</div>', 'SELECT 1\n+ 2'],
    ['<div>SELECT 1</div><div><br></div><div>+ 2</div>', 'SELECT 1\n\n+ 2'],
    ['<div>SELECT 1</div><div><br></div>', 'SELECT 1\n'],
    ['<div><br></div><div>SELECT 1</div>', '\nSELECT 1'],
    ['<div><br></div><div><br></div><div>SELECT 1</div>', '\n\nSELECT 1'],
    ['SELECT 1<div><br></div>', 'SELECT 1\n'],
    ['<div><br></div>', ''],
    ['SELECT 1\n<br data-sql-workbench-placeholder>', 'SELECT 1\n'],
    ['<span>SELECT</span> \'a  b\'\n', "SELECT 'a  b'\n"],
  ])('normalizes %s', (html, expected) => {
    const editor = document.createElement('div');
    editor.innerHTML = html;
    expect(getEditorText(editor)).toBe(expected);
  });
});
