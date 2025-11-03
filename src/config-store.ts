/**
 * Shared config store to avoid circular dependencies
 */

import { SQLWorkbenchConfig, DEFAULT_CONFIG } from './types';

let globalConfig: Required<SQLWorkbenchConfig> = { ...DEFAULT_CONFIG };

export function setGlobalConfig(config: Required<SQLWorkbenchConfig>): void {
  globalConfig = config;
}

export function getGlobalConfig(): Required<SQLWorkbenchConfig> {
  return globalConfig;
}
