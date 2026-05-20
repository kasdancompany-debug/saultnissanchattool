const DEFAULT_MISSED_CALL_FOLLOWUP_SMS =
  "Sorry we missed your call. Are you looking for Sales, Service, or Parts?";

/**
 * Configurable follow-up SMS (`MISSED_CALL_FOLLOWUP_SMS` env override).
 */
export function getMissedCallFollowupSmsBody(): string {
  const raw = process.env.MISSED_CALL_FOLLOWUP_SMS?.trim();
  return raw || DEFAULT_MISSED_CALL_FOLLOWUP_SMS;
}
