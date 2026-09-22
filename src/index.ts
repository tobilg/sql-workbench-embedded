/**
 * SQL Workbench Embedded
 * Main entry point
 */

import { Embedded } from './embedded';
import { SQLWorkbenchConfig } from './types';
import { injectStyles } from './styles';
import { duckDBManager } from './duckdb-manager';
import { getGlobalConfig, setGlobalConfig } from './config-store';
import { findEmbed, destroyEmbeds } from './instance-registry';

let autoInitTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Set global configuration
 */
function config(options: Partial<SQLWorkbenchConfig>): void {
  const current = getGlobalConfig();
  setGlobalConfig({ ...current, ...options });
}

/**
 * Get current global configuration
 */
function getConfig(): Required<SQLWorkbenchConfig> {
  return getGlobalConfig();
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
  const globalConfig = getGlobalConfig();
  const elements = document.querySelectorAll<HTMLElement>(globalConfig.selector);

  elements.forEach((element) => {
    // Skip if already initialized
    if (findEmbed(element)) {
      return;
    }

    // Pass full globalConfig - Embedded constructor handles theme priority
    // Priority: data-theme attribute > globalConfig.theme > DEFAULT_CONFIG.theme
    new Embedded(element, globalConfig);
  });
}

/**
 * Destroy all embeds and cleanup
 */
function destroy(): Promise<void> {
  if (typeof document !== 'undefined') document.removeEventListener('DOMContentLoaded', autoInitialize);
  clearTimeout(autoInitTimer);
  destroyEmbeds();
  return duckDBManager.close();
}

function autoInitialize(): void {
  if (getGlobalConfig().autoInit) init();
}

/**
 * Auto-initialize on DOMContentLoaded if configured
 * Note: This runs at module load time, so users should call config() BEFORE importing
 * Or set autoInit: false and call init() manually
 */
if (typeof document !== 'undefined') {
  // Delay the check until after user code has a chance to run config()
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInitialize, { once: true });
  } else {
    // DOM already loaded, use setTimeout to let user config() run first
    autoInitTimer = setTimeout(autoInitialize, 0);
  }
}

// Export public API
export const SQLWorkbench = {
  Embedded,
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
export { Embedded };
export type { SQLWorkbenchConfig, EmbeddedOptions, QueryResult } from './types';
