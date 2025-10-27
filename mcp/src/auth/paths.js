#!/usr/bin/env node

/**
 * Shared path utilities for token management
 * This module provides consistent token path resolution across all scripts
 */

import path from 'path';
import { homedir } from 'os';

/**
 * Get the secure token storage path
 * Uses XDG Base Directory specification on Unix-like systems
 */
export function getSecureTokenPath() {
  console.error('[DEBUG] getSecureTokenPath() called');
  console.error('[DEBUG] GOOGLE_CALENDAR_MCP_TOKEN_PATH env var:', process.env.GOOGLE_CALENDAR_MCP_TOKEN_PATH);

  // Check environment variable first
  if (process.env.GOOGLE_CALENDAR_MCP_TOKEN_PATH) {
    console.error('[DEBUG] Using token path from env var:', process.env.GOOGLE_CALENDAR_MCP_TOKEN_PATH);
    return process.env.GOOGLE_CALENDAR_MCP_TOKEN_PATH;
  }
  // Fall back to default path
  const configDir = process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config');
  const defaultPath = path.join(configDir, 'google-mcp', 'tokens.json');
  console.error('[DEBUG] Using default token path:', defaultPath);
  return defaultPath;
}

/**
 * Get the legacy token path (for migration purposes)
 */
export function getLegacyTokenPath() {
  return path.join(process.cwd(), '.gcp-saved-tokens.json');
}

/**
 * Get current account mode from environment
 * Uses same logic as utils.ts but compatible with both JS and TS
 */
export function getAccountMode() {
  // If set explicitly via environment variable use that instead
  const explicitMode = process.env.GOOGLE_ACCOUNT_MODE?.toLowerCase();
  if (explicitMode === 'test' || explicitMode === 'normal') {
    return explicitMode;
  }
  
  // Auto-detect test environment
  if (process.env.NODE_ENV === 'test') {
    return 'test';
  }
  
  // Default to normal for regular app usage
  return 'normal';
}