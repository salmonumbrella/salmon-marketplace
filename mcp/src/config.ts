import process from 'node:process'

type RequiredEnv = 'NOTION_TOKEN' | 'NOTION_API_KEY'

const REQUIRED_TOKENS: RequiredEnv[] = ['NOTION_TOKEN', 'NOTION_API_KEY']

const OPTIONAL_DATABASE_VARS = [
  'NOTION_DB_ISSUE_TRACKER',
  'NOTION_DB_IPS',
  'NOTION_DB_MEETINGS',
  'NOTION_DB_ONE_ON_ONES',
  'NOTION_DB_GLOSSARY',
  'NOTION_DB_SOP',
  'NOTION_DB_CONTACTS',
  'NOTION_DB_AREAS_OF_RESPONSIBILITY',
  'NOTION_DB_CONTENT_CALENDAR',
  'NOTION_DB_GUIDES',
  'NOTION_DB_CONTRACTS',
  'NOTION_DB_NOTEBOOKS',
  'NOTION_DB_VENDOR_INVOICES',
  'NOTION_DB_PAYEE'
] as const

export type OptionalDatabaseVar = typeof OPTIONAL_DATABASE_VARS[number]

export interface NotionEnvConfig {
  authToken: string
  tokenSource: RequiredEnv
  userId?: string
  baseUrl?: string
  databaseIds: Partial<Record<OptionalDatabaseVar, string>>
}

export class MissingEnvError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MissingEnvError'
  }
}

/**
 * Reads environment variables and returns a normalized configuration object.
 * Throws if no Notion auth token is present.
 */
export function loadEnvConfig(): NotionEnvConfig {
  const tokenEntry = REQUIRED_TOKENS.find((key) => {
    const value = process.env[key]
    return typeof value === 'string' && value.trim().length > 0
  })

  if (!tokenEntry) {
    throw new MissingEnvError('Set NOTION_TOKEN (preferred) or NOTION_API_KEY before starting the Notion MCP server.')
  }

  const authToken = process.env[tokenEntry]!.trim()
  const userId = process.env.NOTION_USER_ID?.trim()
  const baseUrl = process.env.NOTION_BASE_URL?.trim()

  const databaseIds: Partial<Record<OptionalDatabaseVar, string>> = {}
  for (const key of OPTIONAL_DATABASE_VARS) {
    const value = process.env[key]
    if (value && value.trim().length > 0) {
      databaseIds[key] = value.trim()
    }
  }

  return {
    authToken,
    tokenSource: tokenEntry,
    userId: userId && userId.length > 0 ? userId : undefined,
    baseUrl: baseUrl && baseUrl.length > 0 ? baseUrl : undefined,
    databaseIds
  }
}

export function logConfigSummary(config: NotionEnvConfig): void {
  const missingDatabases = OPTIONAL_DATABASE_VARS.filter((key) => !config.databaseIds[key])
  const summary = [
    `[notion-mcp] Auth via ${config.tokenSource}`,
    `[notion-mcp] NOTION_USER_ID ${config.userId ? 'present' : 'missing'}`,
    `[notion-mcp] Preconfigured database IDs: ${Object.keys(config.databaseIds).length}`,
    missingDatabases.length > 0
      ? `[notion-mcp] Missing optional database vars: ${missingDatabases.join(', ')}`
      : '[notion-mcp] All optional database vars present'
  ]

  for (const line of summary) {
    console.error(line)
  }
}
