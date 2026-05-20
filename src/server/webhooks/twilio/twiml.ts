/**
 * Twilio expects HTTP 200 with TwiML (or empty body) for SMS webhooks.
 */
export function twilioEmptyTwiMlResponse(): Response {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    {
      status: 200,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
      },
    }
  );
}
