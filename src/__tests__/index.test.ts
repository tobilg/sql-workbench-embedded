import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SQLWorkbench } from '../index';
import { duckDBManager } from '../duckdb-manager';
import { createSQLElement } from './test-utils';
import { DEFAULT_CONFIG } from '../types';

vi.mock('../duckdb-manager');

describe('index (main entry point)', () => {
  beforeEach(() => {
    // Clear document body
    document.body.innerHTML = '';

    // Reattach SQLWorkbench to window (setup.ts clears it)
    (window as any).SQLWorkbench = SQLWorkbench;

    // Reset global config
    SQLWorkbench.config(DEFAULT_CONFIG);

    // Mock duckDBManager
    vi.mocked(duckDBManager.close).mockResolvedValue(undefined);
  });

  afterEach(() => {
    SQLWorkbench.destroy();
    vi.clearAllMocks();
  });

  describe('SQLWorkbench export', () => {
    it('should export Embedded class', () => {
      expect(SQLWorkbench.Embedded).toBeDefined();
      expect(typeof SQLWorkbench.Embedded).toBe('function');
    });

    it('should export init function', () => {
      expect(SQLWorkbench.init).toBeDefined();
      expect(typeof SQLWorkbench.init).toBe('function');
    });

    it('should export destroy function', () => {
      expect(SQLWorkbench.destroy).toBeDefined();
      expect(typeof SQLWorkbench.destroy).toBe('function');
    });

    it('should export config function', () => {
      expect(SQLWorkbench.config).toBeDefined();
      expect(typeof SQLWorkbench.config).toBe('function');
    });

    it('should export getConfig function', () => {
      expect(SQLWorkbench.getConfig).toBeDefined();
      expect(typeof SQLWorkbench.getConfig).toBe('function');
    });
  });

  describe('window attachment', () => {
    it('should attach SQLWorkbench to window object', () => {
      expect((window as any).SQLWorkbench).toBeDefined();
      expect((window as any).SQLWorkbench).toBe(SQLWorkbench);
    });

    it('should make Embedded accessible via window.SQLWorkbench.Embedded', () => {
      expect((window as any).SQLWorkbench.Embedded).toBe(SQLWorkbench.Embedded);
    });
  });

  describe('config', () => {
    it('should update global configuration', () => {
      SQLWorkbench.config({ baseUrl: 'https://custom.com' });

      const config = SQLWorkbench.getConfig();
      expect(config.baseUrl).toBe('https://custom.com');
    });

    it('should merge with existing configuration', () => {
      SQLWorkbench.config({ baseUrl: 'https://custom.com' });
      SQLWorkbench.config({ theme: 'dark' });

      const config = SQLWorkbench.getConfig();
      expect(config.baseUrl).toBe('https://custom.com');
      expect(config.theme).toBe('dark');
    });

    it('should not mutate DEFAULT_CONFIG', () => {
      const originalBaseUrl = DEFAULT_CONFIG.baseUrl;

      SQLWorkbench.config({ baseUrl: 'https://custom.com' });

      expect(DEFAULT_CONFIG.baseUrl).toBe(originalBaseUrl);
    });

    it('should allow setting selector', () => {
      SQLWorkbench.config({ selector: '.custom-sql' });

      const config = SQLWorkbench.getConfig();
      expect(config.selector).toBe('.custom-sql');
    });

    it('should allow setting autoInit', () => {
      SQLWorkbench.config({ autoInit: false });

      const config = SQLWorkbench.getConfig();
      expect(config.autoInit).toBe(false);
    });

    it('should allow setting DuckDB configuration', () => {
      SQLWorkbench.config({
        duckdbVersion: '1.30.0',
        duckdbCDN: 'https://custom-cdn.com',
      });

      const config = SQLWorkbench.getConfig();
      expect(config.duckdbVersion).toBe('1.30.0');
      expect(config.duckdbCDN).toBe('https://custom-cdn.com');
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = SQLWorkbench.getConfig();

      expect(config.selector).toBeDefined();
      expect(config.baseUrl).toBeDefined();
      expect(config.theme).toBeDefined();
    });

    it('should return a copy, not reference', () => {
      const config1 = SQLWorkbench.getConfig();
      const config2 = SQLWorkbench.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });

    it('should not allow mutation of internal config', () => {
      const config = SQLWorkbench.getConfig();
      config.baseUrl = 'https://modified.com';

      const newConfig = SQLWorkbench.getConfig();
      expect(newConfig.baseUrl).not.toBe('https://modified.com');
    });
  });

  describe('init', () => {
    it('should create embeds from matching elements', () => {
      createSQLElement('SELECT 1', 'sql-workbench-embedded');
      createSQLElement('SELECT 2', 'sql-workbench-embedded');

      SQLWorkbench.init();

      const containers = document.querySelectorAll('.sql-workbench-container');
      expect(containers.length).toBe(2);
    });

    it('should use configured selector', () => {
      SQLWorkbench.config({ selector: '.custom-sql' });
      createSQLElement('SELECT 1', 'custom-sql');
      createSQLElement('SELECT 2', 'other-class');

      SQLWorkbench.init();

      const containers = document.querySelectorAll('.sql-workbench-container');
      expect(containers.length).toBe(1);
    });

    it('should skip already initialized elements', () => {
      const element = createSQLElement('SELECT 1');

      SQLWorkbench.init();
      SQLWorkbench.init();

      const containers = document.querySelectorAll('.sql-workbench-container');
      expect(containers.length).toBe(1);
    });

    it('should inject CSS styles', () => {
      SQLWorkbench.init();

      const styleElement = document.getElementById('sql-workbench-embedded-styles');
      expect(styleElement).toBeTruthy();
    });

    it('should pass global config to embeds', () => {
      SQLWorkbench.config({
        baseUrl: 'https://custom.com',
        editable: false,
      });

      const element = createSQLElement('SELECT 1');
      SQLWorkbench.init();

      const editor = document.querySelector('.sql-workbench-editor') as HTMLElement;
      expect(editor?.contentEditable).toBe('false');
    });

    it('should prioritize data-theme over the global theme', () => {
      SQLWorkbench.config({ theme: 'dark' });

      const element = createSQLElement('SELECT 1');
      element.setAttribute('data-theme', 'light');

      SQLWorkbench.init();

      const container = document.querySelector('.sql-workbench-container');
      expect(container?.getAttribute('data-theme')).toBe('light');
    });

    it('should pass customThemes from global config', () => {
      const customThemes = {
        myTheme: {
          extends: 'light' as const,
          config: { bgColor: '#f0f0f0' },
        },
      };

      SQLWorkbench.config({ customThemes });

      const element = createSQLElement('SELECT 1');
      element.setAttribute('data-theme', 'myTheme');

      SQLWorkbench.init();

      const container = document.querySelector('.sql-workbench-container');
      expect(container?.getAttribute('data-theme')).toBe('myTheme');
    });

    it('should handle missing document gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Stub the global without assigning through the DOM's read-only getter.
      vi.stubGlobal('document', undefined);
      try {
        SQLWorkbench.init();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'SQLWorkbench: document is not available, skipping initialization'
        );
      } finally {
        vi.unstubAllGlobals();
        consoleWarnSpy.mockRestore();
      }
    });
  });

  describe('destroy', () => {
    it('should destroy all embeds', () => {
      createSQLElement('SELECT 1');
      createSQLElement('SELECT 2');

      SQLWorkbench.init();

      const containersBefore = document.querySelectorAll('.sql-workbench-container');
      expect(containersBefore.length).toBe(2);

      SQLWorkbench.destroy();

      const containersAfter = document.querySelectorAll('.sql-workbench-container');
      expect(containersAfter.length).toBe(0);
    });

    it('should close DuckDB connection', async () => {
      SQLWorkbench.destroy();

      expect(duckDBManager.close).toHaveBeenCalled();
    });

    it('should expose DuckDB close errors to the caller', async () => {
      vi.mocked(duckDBManager.close).mockRejectedValueOnce(new Error('Close failed'));
      await expect(SQLWorkbench.destroy()).rejects.toThrow('Close failed');
    });

    it('should clear internal embed tracking', () => {
      createSQLElement('SELECT 1');
      SQLWorkbench.init();
      SQLWorkbench.destroy();

      // Verify embeds are cleared by trying to destroy again
      expect(() => SQLWorkbench.destroy()).not.toThrow();
    });

    it('should be safe to call multiple times', () => {
      createSQLElement('SELECT 1');
      SQLWorkbench.init();

      SQLWorkbench.destroy();
      SQLWorkbench.destroy();
      SQLWorkbench.destroy();

      const containers = document.querySelectorAll('.sql-workbench-container');
      expect(containers.length).toBe(0);
    });
  });

  describe('MutationObserver cleanup', () => {
    it('should destroy embed when container is removed from DOM', () => {
      createSQLElement('SELECT 1');
      SQLWorkbench.init();

      const container = document.querySelector('.sql-workbench-container');
      expect(container).toBeTruthy();

      // Remove container from DOM
      container?.remove();

      // Manually trigger the mutation observer callback
      const mutations: MutationRecord[] = [
        {
          type: 'childList',
          removedNodes: [container!] as any,
          addedNodes: [] as any,
          target: document.body,
          attributeName: null,
          attributeNamespace: null,
          oldValue: null,
          nextSibling: null,
          previousSibling: null,
        },
      ];

      // Get the observer callback and call it
      const observerCallback = (MutationObserver as any).mock.calls[0][0];
      observerCallback(mutations);

      // Verify that containers have been cleaned up
      const containers = document.querySelectorAll('.sql-workbench-container');
      expect(containers.length).toBe(0);
    });
  });

  describe('automatic initialization', () => {
    it('should respect autoInit configuration', () => {
      SQLWorkbench.config({ autoInit: false });

      createSQLElement('SELECT 1');

      // Auto-init should not happen
      const containers = document.querySelectorAll('.sql-workbench-container');
      expect(containers.length).toBe(0);

      // Manual init should work
      SQLWorkbench.init();
      const containersAfterInit = document.querySelectorAll('.sql-workbench-container');
      expect(containersAfterInit.length).toBe(1);
    });
  });

  describe('WeakMap instance tracking', () => {
    it('should track embeds in WeakMap', () => {
      const element = createSQLElement('SELECT 1');
      SQLWorkbench.init();

      const container = document.querySelector('.sql-workbench-container') as HTMLElement;
      expect(container).toBeTruthy();

      // We can't directly access the WeakMap, but we can test that
      // re-initialization doesn't create duplicates
      SQLWorkbench.init();

      const containers = document.querySelectorAll('.sql-workbench-container');
      expect(containers.length).toBe(1);
    });
  });

  describe('multiple selector support', () => {
    it('should support multiple selectors', () => {
      SQLWorkbench.config({
        selector: 'pre.sql-workbench-embedded, .sql-workbench-embedded pre',
      });

      // Create both types
      const pre1 = document.createElement('pre');
      pre1.className = 'sql-workbench-embedded';
      pre1.innerHTML = '<code>SELECT 1</code>';
      document.body.appendChild(pre1);

      const div = document.createElement('div');
      div.className = 'sql-workbench-embedded';
      const pre2 = document.createElement('pre');
      pre2.innerHTML = '<code>SELECT 2</code>';
      div.appendChild(pre2);
      document.body.appendChild(div);

      SQLWorkbench.init();

      const containers = document.querySelectorAll('.sql-workbench-container');
      expect(containers.length).toBe(2);
    });
  });

  describe('Embed class direct usage', () => {
    beforeEach(() => {
      SQLWorkbench.config({ autoInit: false });
    });

    it('should inherit global appearance and editing settings', () => {
      SQLWorkbench.config({ theme: 'dark', editable: false, showOpenButton: false });

      const embed = new SQLWorkbench.Embedded(createSQLElement('SELECT 1'));
      const container = embed.getContainer()!;

      expect(container.getAttribute('data-theme')).toBe('dark');
      expect(container.querySelector<HTMLElement>('.sql-workbench-editor')?.contentEditable).toBe('false');
      expect(container.querySelector('.sql-workbench-button-open')).toBeNull();
    });

    it('should inherit a globally selected custom theme', () => {
      SQLWorkbench.config({
        theme: 'ocean',
        customThemes: { ocean: { extends: 'dark', config: { primaryBg: '#0ea5e9' } } },
      });

      const embed = new SQLWorkbench.Embedded(createSQLElement('SELECT 1'));
      const container = embed.getContainer()!;

      expect(container.getAttribute('data-theme')).toBe('ocean');
      expect(container.style.getPropertyValue('--sw-primary-bg')).toBe('#0ea5e9');
    });

    it('should let instance options override globals without changing global config', () => {
      SQLWorkbench.config({ theme: 'dark', editable: false, showOpenButton: false });
      const configBefore = SQLWorkbench.getConfig();

      const embed = new SQLWorkbench.Embedded(createSQLElement('SELECT 1'), {
        theme: 'light',
        editable: true,
        showOpenButton: true,
      });
      const container = embed.getContainer()!;

      expect(container.getAttribute('data-theme')).toBe('light');
      expect(container.querySelector<HTMLElement>('.sql-workbench-editor')?.contentEditable).toBe('true');
      expect(container.querySelector('.sql-workbench-button-open')).not.toBeNull();
      expect(SQLWorkbench.getConfig()).toEqual(configBefore);
    });

    it('should prioritize data-theme over instance and global themes', () => {
      SQLWorkbench.config({
        theme: 'dark',
        customThemes: { ocean: { extends: 'dark', config: {} } },
      });
      const element = createSQLElement('SELECT 1');
      element.setAttribute('data-theme', 'ocean');

      const embed = new SQLWorkbench.Embedded(element, { theme: 'light' });

      expect(embed.getContainer()?.getAttribute('data-theme')).toBe('ocean');
    });

    it.each([false, true])('should use inherited query settings with instance overrides: %s', async (override) => {
      const globalSettings = {
        baseUrl: 'https://global.example/data',
        duckdbVersion: '1.30.0',
        duckdbCDN: 'https://global.example/duckdb',
        initQueries: ['INSTALL spatial', 'LOAD spatial'],
      };
      const instanceSettings = {
        baseUrl: 'https://instance.example/data',
        duckdbVersion: '1.31.1-dev1.0',
        duckdbCDN: 'https://instance.example/duckdb',
        initQueries: [],
      };
      SQLWorkbench.config(globalSettings);
      vi.mocked(duckDBManager.isInitialized).mockReturnValue(false);
      vi.mocked(duckDBManager.registerFile).mockResolvedValue(undefined);
      vi.mocked(duckDBManager.query).mockResolvedValue({
        columns: [], rows: [], rowCount: 0, executionTime: 1,
      });
      const sql = "SELECT * FROM 'data.parquet'";
      const embed = new SQLWorkbench.Embedded(createSQLElement(sql), override ? instanceSettings : {});
      const expected = override ? instanceSettings : globalSettings;

      await embed.run();

      expect(duckDBManager.configure).toHaveBeenCalledWith({
        version: expected.duckdbVersion,
        cdn: expected.duckdbCDN,
      });
      expect(duckDBManager.registerFile).toHaveBeenCalledWith(`${expected.baseUrl}/data.parquet`, `${expected.baseUrl}/data.parquet`);
      if (override) {
        expect(duckDBManager.configureInitQueries).toHaveBeenCalledWith([]);
      } else {
        expect(duckDBManager.configureInitQueries).toHaveBeenCalledWith(globalSettings.initQueries);
      }
      expect(duckDBManager.query).toHaveBeenCalledWith(`SELECT * FROM '${expected.baseUrl}/data.parquet'`);
    });

    it('should allow creating embeds directly', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new SQLWorkbench.Embedded(element);

      expect(embed).toBeTruthy();
      expect(embed.getContainer()).toBeTruthy();
    });

    it('should allow destroying embeds created directly', () => {
      const element = createSQLElement('SELECT 1');
      const embed = new SQLWorkbench.Embedded(element);
      const container = embed.getContainer();

      embed.destroy();

      expect(document.body.contains(container)).toBe(false);
      expect(embed.isDestroyed()).toBe(true);
    });

    it('should allow running queries on directly created embeds', async () => {
      vi.mocked(duckDBManager.isInitialized).mockReturnValue(false);
      vi.mocked(duckDBManager.configure).mockReturnValue(undefined);
      vi.mocked(duckDBManager.query).mockResolvedValue({
        columns: ['result'],
        rows: [[42]],
        rowCount: 1,
        executionTime: 10,
      });

      const element = createSQLElement('SELECT 42');
      const embed = new SQLWorkbench.Embedded(element);

      await embed.run();

      const output = embed.getContainer()?.querySelector('.sql-workbench-output');
      expect(output?.textContent).toContain('42');
    });
  });
});
