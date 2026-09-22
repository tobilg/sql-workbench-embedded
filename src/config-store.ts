/**
 * Shared config store to avoid circular dependencies
 */

import { SQLWorkbenchConfig, DEFAULT_CONFIG } from './types';

/** Copy the mutable parts of configuration at every API boundary. */
export function cloneConfig<T extends SQLWorkbenchConfig>(config: T): T {
  const copy = { ...config };
  if (config.initQueries) copy.initQueries = [...config.initQueries];
  if (config.customThemes) {
    copy.customThemes = {};
    for (const [name, theme] of Object.entries(config.customThemes)) {
      copy.customThemes[name] = { ...theme, config: { ...theme.config } };
    }
  }
  return copy;
}

let globalConfig: Required<SQLWorkbenchConfig> = cloneConfig(DEFAULT_CONFIG);

export function setGlobalConfig(config: Required<SQLWorkbenchConfig>): void {
  globalConfig = cloneConfig(config);
}

export function getGlobalConfig(): Required<SQLWorkbenchConfig> {
  return cloneConfig(globalConfig);
}
