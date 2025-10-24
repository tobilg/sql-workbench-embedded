/**
 * SQL Workbench Embed
 * Main entry point
 */

import { Embed } from './embed';
import { SQLWorkbenchConfig, DEFAULT_CONFIG } from './types';
import { injectStyles } from './styles';
import { duckDBManager } from './duckdb-manager';

// Track all embed instances
const embedInstances = new WeakMap<HTMLElement, Embed>();
const allEmbeds: Embed[] = [];

// Global configuration
let globalConfig: Required<SQLWorkbenchConfig> = { ...DEFAULT_CONFIG };

/**
 * Set global configuration
 */
function config(options: Partial<SQLWorkbenchConfig>): void {
  globalConfig = { ...globalConfig, ...options };
}

/**
 * Get current global configuration
 */
function getConfig(): Required<SQLWorkbenchConfig> {
  return { ...globalConfig };
}

/**
 * Initialize embeds automatically
 */
function init(): void {
  if (typeof document === 'undefined') {
    console.warn('SQLWorkbench: document is not available, skipping initialization');
    return;
  }

  // Inject styles
  injectStyles();

  // Find all matching elements
  const elements = document.querySelectorAll<HTMLElement>(globalConfig.selector);

  elements.forEach((element) => {
    // Skip if already initialized
    if (embedInstances.has(element)) {
      return;
    }

    // Create embed - don't pass theme from globalConfig, let it be extracted from data-theme
    // But DO pass customThemes so custom themes can be resolved
    const { theme: _ignoredTheme, ...configWithoutTheme } = globalConfig;
    const embed = new Embed(element, configWithoutTheme);
    const container = embed.getContainer();

    if (container) {
      embedInstances.set(container, embed);
      allEmbeds.push(embed);
    }
  });

  // Set up MutationObserver for automatic cleanup
  setupMutationObserver();
}

/**
 * Setup MutationObserver to detect removed embeds
 */
function setupMutationObserver(): void {
  if (typeof window === 'undefined' || !window.MutationObserver) {
    return;
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
        mutation.removedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            const embed = embedInstances.get(node);
            if (embed && !embed.isDestroyed()) {
              embed.destroy();
              const index = allEmbeds.indexOf(embed);
              if (index > -1) {
                allEmbeds.splice(index, 1);
              }
            }
          }
        });
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/**
 * Destroy all embeds and cleanup
 */
function destroy(): void {
  // Destroy all embed instances
  allEmbeds.forEach((embed) => {
    if (!embed.isDestroyed()) {
      embed.destroy();
    }
  });

  allEmbeds.length = 0;

  // Close DuckDB connection
  duckDBManager.close().catch((error) => {
    console.error('Failed to close DuckDB connection:', error);
  });
}

/**
 * Auto-initialize on DOMContentLoaded if configured
 * Note: This runs at module load time, so users should call config() BEFORE importing
 * Or set autoInit: false and call init() manually
 */
if (typeof document !== 'undefined') {
  // Delay the check until after user code has a chance to run config()
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (globalConfig.autoInit) {
        init();
      }
    });
  } else {
    // DOM already loaded, use setTimeout to let user config() run first
    setTimeout(() => {
      if (globalConfig.autoInit) {
        init();
      }
    }, 0);
  }
}

// Export public API
export const SQLWorkbench = {
  Embed,
  init,
  destroy,
  config,
  getConfig,
};

// Attach to window for UMD builds
if (typeof window !== 'undefined') {
  (window as unknown as { SQLWorkbench: typeof SQLWorkbench }).SQLWorkbench = SQLWorkbench;
}

// Default export
export default SQLWorkbench;

// Named exports for tree-shaking
export { Embed };
export type { SQLWorkbenchConfig, EmbedOptions, QueryResult } from './types';
