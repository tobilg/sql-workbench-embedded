import { describe, it, expect, beforeEach } from 'vitest';
import {
  LIGHT_THEME_CONFIG,
  DARK_THEME_CONFIG,
  getThemeConfig,
  applyThemeConfig,
  validateThemeColors,
  injectStyles,
} from '../styles';
import type { CustomTheme, ThemeConfig } from '../types';

describe('styles', () => {
  describe('LIGHT_THEME_CONFIG', () => {
    it('should have all required color properties', () => {
      expect(LIGHT_THEME_CONFIG.bgColor).toBe('#ffffff');
      expect(LIGHT_THEME_CONFIG.textColor).toBe('#333333');
      expect(LIGHT_THEME_CONFIG.borderColor).toBe('#e5e5e5');
      expect(LIGHT_THEME_CONFIG.editorBg).toBe('#ffffff');
      expect(LIGHT_THEME_CONFIG.editorText).toBe('#333333');
      expect(LIGHT_THEME_CONFIG.primaryBg).toBe('#007acc');
    });

    it('should have syntax highlighting colors', () => {
      expect(LIGHT_THEME_CONFIG.syntaxKeyword).toBe('#0000ff');
      expect(LIGHT_THEME_CONFIG.syntaxString).toBe('#a31515');
      expect(LIGHT_THEME_CONFIG.syntaxNumber).toBe('#098658');
      expect(LIGHT_THEME_CONFIG.syntaxComment).toBe('#008000');
    });

    it('should have typography settings', () => {
      expect(LIGHT_THEME_CONFIG.fontFamily).toBeDefined();
      expect(LIGHT_THEME_CONFIG.editorFontFamily).toBeDefined();
      expect(LIGHT_THEME_CONFIG.fontSize).toBe('14px');
      expect(LIGHT_THEME_CONFIG.editorFontSize).toBe('13px');
    });
  });

  describe('DARK_THEME_CONFIG', () => {
    it('should have all required color properties', () => {
      expect(DARK_THEME_CONFIG.bgColor).toBe('#252526');
      expect(DARK_THEME_CONFIG.textColor).toBe('#d4d4d4');
      expect(DARK_THEME_CONFIG.borderColor).toBe('#3e3e42');
      expect(DARK_THEME_CONFIG.editorBg).toBe('#1e1e1e');
      expect(DARK_THEME_CONFIG.editorText).toBe('#d4d4d4');
      expect(DARK_THEME_CONFIG.primaryBg).toBe('#007acc');
    });

    it('should have syntax highlighting colors', () => {
      expect(DARK_THEME_CONFIG.syntaxKeyword).toBe('#569cd6');
      expect(DARK_THEME_CONFIG.syntaxString).toBe('#ce9178');
      expect(DARK_THEME_CONFIG.syntaxNumber).toBe('#b5cea8');
      expect(DARK_THEME_CONFIG.syntaxComment).toBe('#6a9955');
    });

    it('should have typography settings', () => {
      expect(DARK_THEME_CONFIG.fontFamily).toBeDefined();
      expect(DARK_THEME_CONFIG.editorFontFamily).toBeDefined();
      expect(DARK_THEME_CONFIG.fontSize).toBe('14px');
      expect(DARK_THEME_CONFIG.editorFontSize).toBe('13px');
    });
  });

  describe('validateThemeColors', () => {
    it('should not throw for complete theme config', () => {
      expect(() => validateThemeColors(LIGHT_THEME_CONFIG)).not.toThrow();
      expect(() => validateThemeColors(DARK_THEME_CONFIG)).not.toThrow();
    });

    it('should throw error for missing required keys', () => {
      const incomplete: Partial<ThemeConfig> = {
        bgColor: '#ffffff',
        textColor: '#333333',
      };
      expect(() => validateThemeColors(incomplete)).toThrow('Missing required theme variables');
    });

    it('should include missing key names in error message', () => {
      const incomplete: Partial<ThemeConfig> = {
        bgColor: '#ffffff',
        textColor: '#333333',
      };
      try {
        validateThemeColors(incomplete);
        expect.fail('Should have thrown an error');
      } catch (error) {
        const err = error as Error;
        expect(err.message).toContain('borderColor');
        expect(err.message).toContain('editorBg');
      }
    });

    it('should accept complete custom config', () => {
      const complete: Partial<ThemeConfig> = {
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
      };
      expect(() => validateThemeColors(complete)).not.toThrow();
    });
  });

  describe('getThemeConfig', () => {
    it('should return light theme for "light"', () => {
      const theme = getThemeConfig('light');
      expect(theme).toEqual(LIGHT_THEME_CONFIG);
    });

    it('should return dark theme for "dark"', () => {
      const theme = getThemeConfig('dark');
      expect(theme).toEqual(DARK_THEME_CONFIG);
    });

    it('should throw error for unknown theme without custom themes', () => {
      expect(() => getThemeConfig('unknown')).toThrow('Unknown theme: unknown');
    });

    it('should merge custom theme extending light', () => {
      const customThemes: Record<string, CustomTheme> = {
        myTheme: {
          extends: 'light',
          config: {
            bgColor: '#f0f0f0',
            primaryBg: '#ff0000',
          },
        },
      };
      const theme = getThemeConfig('myTheme', customThemes);
      expect(theme.bgColor).toBe('#f0f0f0');
      expect(theme.primaryBg).toBe('#ff0000');
      expect(theme.textColor).toBe(LIGHT_THEME_CONFIG.textColor);
      expect(theme.borderColor).toBe(LIGHT_THEME_CONFIG.borderColor);
    });

    it('should merge custom theme extending dark', () => {
      const customThemes: Record<string, CustomTheme> = {
        myDark: {
          extends: 'dark',
          config: {
            bgColor: '#000000',
            primaryBg: '#00ff00',
          },
        },
      };
      const theme = getThemeConfig('myDark', customThemes);
      expect(theme.bgColor).toBe('#000000');
      expect(theme.primaryBg).toBe('#00ff00');
      expect(theme.textColor).toBe(DARK_THEME_CONFIG.textColor);
      expect(theme.borderColor).toBe(DARK_THEME_CONFIG.borderColor);
    });

    it('should validate standalone custom theme without extends', () => {
      const customThemes: Record<string, CustomTheme> = {
        incomplete: {
          config: {
            bgColor: '#ffffff',
            textColor: '#333333',
          },
        },
      };
      expect(() => getThemeConfig('incomplete', customThemes)).toThrow(
        'Missing required theme variables'
      );
    });

    it('should accept complete standalone custom theme', () => {
      const customThemes: Record<string, CustomTheme> = {
        complete: {
          config: {
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
          },
        },
      };
      const theme = getThemeConfig('complete', customThemes);
      expect(theme.bgColor).toBe('#ffffff');
      expect(theme.textColor).toBe('#333333');
    });
  });

  describe('applyThemeConfig', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    it('should apply all required color variables', () => {
      applyThemeConfig(container, LIGHT_THEME_CONFIG);

      expect(container.style.getPropertyValue('--sw-bg-color')).toBe('#ffffff');
      expect(container.style.getPropertyValue('--sw-text-color')).toBe('#333333');
      expect(container.style.getPropertyValue('--sw-border-color')).toBe('#e5e5e5');
      expect(container.style.getPropertyValue('--sw-editor-bg')).toBe('#ffffff');
      expect(container.style.getPropertyValue('--sw-editor-text')).toBe('#333333');
      expect(container.style.getPropertyValue('--sw-primary-bg')).toBe('#007acc');
    });

    it('should apply syntax highlighting variables', () => {
      applyThemeConfig(container, LIGHT_THEME_CONFIG);

      expect(container.style.getPropertyValue('--sw-syntax-keyword')).toBe('#0000ff');
      expect(container.style.getPropertyValue('--sw-syntax-string')).toBe('#a31515');
      expect(container.style.getPropertyValue('--sw-syntax-number')).toBe('#098658');
      expect(container.style.getPropertyValue('--sw-syntax-comment')).toBe('#008000');
    });

    it('should apply typography variables', () => {
      applyThemeConfig(container, LIGHT_THEME_CONFIG);

      expect(container.style.getPropertyValue('--sw-font-family')).toBeTruthy();
      expect(container.style.getPropertyValue('--sw-editor-font-family')).toBeTruthy();
      expect(container.style.getPropertyValue('--sw-font-size')).toBe('14px');
      expect(container.style.getPropertyValue('--sw-editor-font-size')).toBe('13px');
      expect(container.style.getPropertyValue('--sw-button-font-size')).toBe('13px');
      expect(container.style.getPropertyValue('--sw-metadata-font-size')).toBe('12px');
    });

    it('should apply dark theme variables', () => {
      applyThemeConfig(container, DARK_THEME_CONFIG);

      expect(container.style.getPropertyValue('--sw-bg-color')).toBe('#252526');
      expect(container.style.getPropertyValue('--sw-text-color')).toBe('#d4d4d4');
      expect(container.style.getPropertyValue('--sw-editor-bg')).toBe('#1e1e1e');
    });

    it('should skip optional variables if not defined', () => {
      const minimalTheme: ThemeConfig = {
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
      };

      applyThemeConfig(container, minimalTheme);
      expect(container.style.getPropertyValue('--sw-bg-color')).toBe('#ffffff');
      // Optional syntax variables should not be set if undefined
      expect(container.style.getPropertyValue('--sw-syntax-keyword')).toBe('');
    });

    it('should override existing variables', () => {
      container.style.setProperty('--sw-bg-color', '#000000');
      applyThemeConfig(container, LIGHT_THEME_CONFIG);
      expect(container.style.getPropertyValue('--sw-bg-color')).toBe('#ffffff');
    });
  });

  describe('injectStyles', () => {
    beforeEach(() => {
      // Remove any existing style elements
      const existing = document.getElementById('sql-workbench-embedded-styles');
      if (existing) {
        existing.remove();
      }
    });

    it('should inject styles into document head', () => {
      injectStyles();
      const styleElement = document.getElementById('sql-workbench-embedded-styles');
      expect(styleElement).toBeTruthy();
      expect(styleElement?.tagName).toBe('STYLE');
    });

    it('should inject styles only once', () => {
      injectStyles();
      injectStyles();
      injectStyles();

      const styleElements = document.querySelectorAll('#sql-workbench-embedded-styles');
      expect(styleElements.length).toBe(1);
    });

    it('should contain CSS class definitions', () => {
      injectStyles();
      const styleElement = document.getElementById('sql-workbench-embedded-styles');
      const content = styleElement?.textContent || '';

      expect(content).toContain('.sql-workbench-container');
      expect(content).toContain('.sql-workbench-editor');
      expect(content).toContain('.sql-workbench-button');
      expect(content).toContain('.sql-workbench-output');
      expect(content).toContain('.sql-workbench-error');
      expect(content).toContain('.sql-workbench-result-table');
    });

    it('should contain syntax highlighting classes', () => {
      injectStyles();
      const styleElement = document.getElementById('sql-workbench-embedded-styles');
      const content = styleElement?.textContent || '';

      expect(content).toContain('.sql-keyword');
      expect(content).toContain('.sql-string');
      expect(content).toContain('.sql-number');
      expect(content).toContain('.sql-comment');
      expect(content).toContain('.sql-operator');
    });

    it('should contain CSS custom properties', () => {
      injectStyles();
      const styleElement = document.getElementById('sql-workbench-embedded-styles');
      const content = styleElement?.textContent || '';

      expect(content).toContain('var(--sw-bg-color');
      expect(content).toContain('var(--sw-text-color');
      expect(content).toContain('var(--sw-editor-bg');
      expect(content).toContain('var(--sw-primary-bg');
    });

    it('should contain animation keyframes', () => {
      injectStyles();
      const styleElement = document.getElementById('sql-workbench-embedded-styles');
      const content = styleElement?.textContent || '';

      expect(content).toContain('@keyframes sw-spin');
      expect(content).toContain('transform: rotate(360deg)');
    });

    it('should contain responsive media queries', () => {
      injectStyles();
      const styleElement = document.getElementById('sql-workbench-embedded-styles');
      const content = styleElement?.textContent || '';

      expect(content).toContain('@media (max-width: 480px)');
    });
  });
});
