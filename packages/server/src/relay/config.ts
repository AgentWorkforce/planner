/**
 * Relay Configuration
 *
 * Configuration for the embedded relay broker (3.x SDK).
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../../..');

export interface RelayConfig {
  /** Project root directory for the embedded broker */
  cwd: string;
  /** MCP server URL for agent tool access */
  mcpServerUrl: string;
}

/**
 * Get relay configuration from environment variables.
 */
export function getRelayConfig(): RelayConfig {
  const port = process.env.PORT || '3001';
  const host = process.env.MCP_SERVER_HOST || `http://localhost:${port}`;

  return {
    cwd: process.env.RELAY_CWD || PROJECT_ROOT,
    mcpServerUrl: process.env.MCP_SERVER_URL || `${host}/api/mcp`,
  };
}
