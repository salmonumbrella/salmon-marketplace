/**
 * Pattern 1 wrapper for Gmail API
 * Converts 64+ Gmail tools into single use_gmail tool with action parameter
 */

import { google, gmail_v1 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { z } from 'zod'

// Gmail actions enum - focusing on core operations
export enum GmailAction {
  // Messages
  LIST_MESSAGES = "list_messages",
  GET_MESSAGE = "get_message",
  SEND_MESSAGE = "send_message",
  MODIFY_MESSAGE = "modify_message",
  TRASH_MESSAGE = "trash_message",
  DELETE_MESSAGE = "delete_message",

  // Threads
  LIST_THREADS = "list_threads",
  GET_THREAD = "get_thread",
  MODIFY_THREAD = "modify_thread",
  TRASH_THREAD = "trash_thread",
  UNTRASH_THREAD = "untrash_thread",
  DELETE_THREAD = "delete_thread",

  // Drafts
  LIST_DRAFTS = "list_drafts",
  GET_DRAFT = "get_draft",
  CREATE_DRAFT = "create_draft",
  SEND_DRAFT = "send_draft",
  DELETE_DRAFT = "delete_draft",

  // Labels
  LIST_LABELS = "list_labels",
  GET_LABEL = "get_label",
  CREATE_LABEL = "create_label",
  UPDATE_LABEL = "update_label",
  DELETE_LABEL = "delete_label",

  // Profile & Settings
  GET_PROFILE = "get_profile",

  // Attachments
  GET_ATTACHMENT = "get_attachment",

  // Batch operations
  BATCH_MODIFY_MESSAGES = "batch_modify_messages",
  BATCH_DELETE_MESSAGES = "batch_delete_messages"
}

// Zod schema for use_gmail tool parameters
export const UseGmailParams = {
  action: z.nativeEnum(GmailAction).describe("Action to perform"),

  // Message/Thread/Draft IDs
  id: z.string().optional().describe("Message, thread, draft, or label ID"),
  messageId: z.string().optional().describe("Message ID"),
  threadId: z.string().optional().describe("Thread ID"),
  draftId: z.string().optional().describe("Draft ID"),
  labelId: z.string().optional().describe("Label ID"),
  attachmentId: z.string().optional().describe("Attachment ID"),

  // List parameters
  maxResults: z.number().optional().describe("Maximum number of results (1-500)"),
  pageToken: z.string().optional().describe("Page token for pagination"),
  q: z.string().optional().describe("Gmail search query"),
  labelIds: z.array(z.string()).optional().describe("Label IDs to filter by"),
  includeSpamTrash: z.boolean().optional().describe("Include SPAM and TRASH"),

  // Email composition
  to: z.array(z.string()).optional().describe("To recipients"),
  cc: z.array(z.string()).optional().describe("CC recipients"),
  bcc: z.array(z.string()).optional().describe("BCC recipients"),
  subject: z.string().optional().describe("Email subject"),
  body: z.string().optional().describe("Email body"),
  raw: z.string().optional().describe("Raw RFC 2822 email (base64url encoded)"),

  // Label operations
  name: z.string().optional().describe("Label name"),
  labelListVisibility: z.enum(['labelShow', 'labelShowIfUnread', 'labelHide']).optional(),
  messageListVisibility: z.enum(['show', 'hide']).optional(),
  color: z.object({
    backgroundColor: z.string().optional(),
    textColor: z.string().optional()
  }).optional().describe("Label color"),

  // Modify operations
  addLabelIds: z.array(z.string()).optional().describe("Label IDs to add"),
  removeLabelIds: z.array(z.string()).optional().describe("Label IDs to remove"),

  // Batch operations
  ids: z.array(z.string()).optional().describe("List of message IDs for batch operations"),

  // Display options
  format: z.enum(['minimal', 'full', 'raw', 'metadata']).optional().describe("Message format"),
  metadataHeaders: z.array(z.string()).optional().describe("Headers to include in metadata format")
}

export type UseGmailInput = z.infer<ReturnType<typeof z.object<typeof UseGmailParams>>>

/**
 * Helper to validate required parameters
 */
function requireParam<T>(value: T | undefined | null, paramName: string, action: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Missing required parameter '${paramName}' for action '${action}'`)
  }
  return value
}

/**
 * Helper to construct email message in RFC 2822 format
 */
function createEmailMessage(params: UseGmailInput): string {
  const lines: string[] = []

  if (params.to?.length) {
    lines.push(`To: ${params.to.join(', ')}`)
  }
  if (params.cc?.length) {
    lines.push(`Cc: ${params.cc.join(', ')}`)
  }
  if (params.bcc?.length) {
    lines.push(`Bcc: ${params.bcc.join(', ')}`)
  }
  if (params.subject) {
    lines.push(`Subject: ${params.subject}`)
  }

  lines.push('Content-Type: text/plain; charset=utf-8')
  lines.push('MIME-Version: 1.0')
  lines.push('')
  lines.push(params.body || '')

  return lines.join('\r\n')
}

/**
 * Convert email message to base64url encoding
 */
function encodeMessage(message: string): string {
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Execute Gmail action using Gmail API
 */
export async function executeGmailAction(params: UseGmailInput, oauth2Client: OAuth2Client): Promise<any> {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  const userId = 'me'

  switch (params.action) {
    // Messages
    case GmailAction.LIST_MESSAGES:
      const listMessagesResponse = await gmail.users.messages.list({
        userId,
        maxResults: params.maxResults,
        pageToken: params.pageToken,
        q: params.q,
        labelIds: params.labelIds,
        includeSpamTrash: params.includeSpamTrash
      })
      return listMessagesResponse.data

    case GmailAction.GET_MESSAGE:
      const getMessageResponse = await gmail.users.messages.get({
        userId,
        id: params.id || requireParam(params.messageId, 'id or messageId', GmailAction.GET_MESSAGE),
        format: params.format || 'full',
        metadataHeaders: params.metadataHeaders
      })
      return getMessageResponse.data

    case GmailAction.SEND_MESSAGE:
      let rawMessage = params.raw
      if (!rawMessage) {
        const emailMessage = createEmailMessage(params)
        rawMessage = encodeMessage(emailMessage)
      }
      const sendResponse = await gmail.users.messages.send({
        userId,
        requestBody: {
          raw: rawMessage,
          threadId: params.threadId
        }
      })
      return sendResponse.data

    case GmailAction.MODIFY_MESSAGE:
      const modifyResponse = await gmail.users.messages.modify({
        userId,
        id: params.id || requireParam(params.messageId, 'id or messageId', GmailAction.MODIFY_MESSAGE),
        requestBody: {
          addLabelIds: params.addLabelIds,
          removeLabelIds: params.removeLabelIds
        }
      })
      return modifyResponse.data

    case GmailAction.TRASH_MESSAGE:
      const trashResponse = await gmail.users.messages.trash({
        userId,
        id: params.id || requireParam(params.messageId, 'id or messageId', GmailAction.TRASH_MESSAGE)
      })
      return trashResponse.data

    case GmailAction.DELETE_MESSAGE:
      await gmail.users.messages.delete({
        userId,
        id: params.id || requireParam(params.messageId, 'id or messageId', GmailAction.DELETE_MESSAGE)
      })
      return { success: true, deleted: params.id || params.messageId }

    // Threads
    case GmailAction.LIST_THREADS:
      const listThreadsResponse = await gmail.users.threads.list({
        userId,
        maxResults: params.maxResults,
        pageToken: params.pageToken,
        q: params.q,
        labelIds: params.labelIds,
        includeSpamTrash: params.includeSpamTrash
      })
      return listThreadsResponse.data

    case GmailAction.GET_THREAD:
      const getThreadResponse = await gmail.users.threads.get({
        userId,
        id: params.id || requireParam(params.threadId, 'id or threadId', GmailAction.GET_THREAD),
        format: params.format,
        metadataHeaders: params.metadataHeaders
      })
      return getThreadResponse.data

    case GmailAction.MODIFY_THREAD:
      const modifyThreadResponse = await gmail.users.threads.modify({
        userId,
        id: params.id || requireParam(params.threadId, 'id or threadId', GmailAction.MODIFY_THREAD),
        requestBody: {
          addLabelIds: params.addLabelIds,
          removeLabelIds: params.removeLabelIds
        }
      })
      return modifyThreadResponse.data

    case GmailAction.TRASH_THREAD:
      const trashThreadResponse = await gmail.users.threads.trash({
        userId,
        id: params.id || requireParam(params.threadId, 'id or threadId', GmailAction.TRASH_THREAD)
      })
      return trashThreadResponse.data

    case GmailAction.UNTRASH_THREAD:
      const untrashThreadResponse = await gmail.users.threads.untrash({
        userId,
        id: params.id || requireParam(params.threadId, 'id or threadId', GmailAction.UNTRASH_THREAD)
      })
      return untrashThreadResponse.data

    case GmailAction.DELETE_THREAD:
      await gmail.users.threads.delete({
        userId,
        id: params.id || requireParam(params.threadId, 'id or threadId', GmailAction.DELETE_THREAD)
      })
      return { success: true, deleted: params.id || params.threadId }

    // Drafts
    case GmailAction.LIST_DRAFTS:
      const listDraftsResponse = await gmail.users.drafts.list({
        userId,
        maxResults: params.maxResults,
        pageToken: params.pageToken,
        q: params.q,
        includeSpamTrash: params.includeSpamTrash
      })
      return listDraftsResponse.data

    case GmailAction.GET_DRAFT:
      const getDraftResponse = await gmail.users.drafts.get({
        userId,
        id: params.id || requireParam(params.draftId, 'id or draftId', GmailAction.GET_DRAFT),
        format: params.format
      })
      return getDraftResponse.data

    case GmailAction.CREATE_DRAFT:
      let draftRaw = params.raw
      if (!draftRaw) {
        const draftMessage = createEmailMessage(params)
        draftRaw = encodeMessage(draftMessage)
      }
      const createDraftResponse = await gmail.users.drafts.create({
        userId,
        requestBody: {
          message: {
            raw: draftRaw,
            threadId: params.threadId
          }
        }
      })
      return createDraftResponse.data

    case GmailAction.SEND_DRAFT:
      const sendDraftResponse = await gmail.users.drafts.send({
        userId,
        requestBody: {
          id: params.id || requireParam(params.draftId, 'id or draftId', GmailAction.SEND_DRAFT)
        }
      })
      return sendDraftResponse.data

    case GmailAction.DELETE_DRAFT:
      await gmail.users.drafts.delete({
        userId,
        id: params.id || requireParam(params.draftId, 'id or draftId', GmailAction.DELETE_DRAFT)
      })
      return { success: true, deleted: params.id || params.draftId }

    // Labels
    case GmailAction.LIST_LABELS:
      const listLabelsResponse = await gmail.users.labels.list({ userId })
      return listLabelsResponse.data

    case GmailAction.GET_LABEL:
      const getLabelResponse = await gmail.users.labels.get({
        userId,
        id: params.id || requireParam(params.labelId, 'id or labelId', GmailAction.GET_LABEL)
      })
      return getLabelResponse.data

    case GmailAction.CREATE_LABEL:
      const createLabelResponse = await gmail.users.labels.create({
        userId,
        requestBody: {
          name: requireParam(params.name, 'name', GmailAction.CREATE_LABEL),
          labelListVisibility: params.labelListVisibility,
          messageListVisibility: params.messageListVisibility,
          color: params.color
        }
      })
      return createLabelResponse.data

    case GmailAction.UPDATE_LABEL:
      const updateLabelResponse = await gmail.users.labels.update({
        userId,
        id: params.id || requireParam(params.labelId, 'id or labelId', GmailAction.UPDATE_LABEL),
        requestBody: {
          name: params.name,
          labelListVisibility: params.labelListVisibility,
          messageListVisibility: params.messageListVisibility,
          color: params.color
        }
      })
      return updateLabelResponse.data

    case GmailAction.DELETE_LABEL:
      await gmail.users.labels.delete({
        userId,
        id: params.id || requireParam(params.labelId, 'id or labelId', GmailAction.DELETE_LABEL)
      })
      return { success: true, deleted: params.id || params.labelId }

    // Profile
    case GmailAction.GET_PROFILE:
      const getProfileResponse = await gmail.users.getProfile({ userId })
      return getProfileResponse.data

    // Attachments
    case GmailAction.GET_ATTACHMENT:
      const getAttachmentResponse = await gmail.users.messages.attachments.get({
        userId,
        messageId: requireParam(params.messageId, 'messageId', GmailAction.GET_ATTACHMENT),
        id: params.id || requireParam(params.attachmentId, 'id or attachmentId', GmailAction.GET_ATTACHMENT)
      })
      return getAttachmentResponse.data

    // Batch operations
    case GmailAction.BATCH_MODIFY_MESSAGES:
      const batchModifyResponse = await gmail.users.messages.batchModify({
        userId,
        requestBody: {
          ids: requireParam(params.ids, 'ids', GmailAction.BATCH_MODIFY_MESSAGES),
          addLabelIds: params.addLabelIds,
          removeLabelIds: params.removeLabelIds
        }
      })
      return { success: true, modified: params.ids }

    case GmailAction.BATCH_DELETE_MESSAGES:
      const batchDeleteResponse = await gmail.users.messages.batchDelete({
        userId,
        requestBody: {
          ids: requireParam(params.ids, 'ids', GmailAction.BATCH_DELETE_MESSAGES)
        }
      })
      return { success: true, deleted: params.ids }

    default:
      throw new Error(`Unknown Gmail action: ${params.action}`)
  }
}
