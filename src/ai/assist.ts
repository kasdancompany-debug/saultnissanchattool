/**
 * AI assist orchestration will call provider APIs from server-only modules.
 * Domain policies (when AI may reply) belong in server/services; keep provider SDKs out of UI.
 */

export type AiAssistState = "off" | "draft_suggestions" | "auto_reply_pending_review";
