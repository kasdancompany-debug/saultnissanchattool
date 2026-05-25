import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Public build marker so embeds can confirm which deployment is live. */
export async function GET() {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
    process.env.VERCEL_DEPLOYMENT_ID?.slice(0, 7) ??
    "local";
  return NextResponse.json({
    widget_version: sha,
    built_at: new Date().toISOString(),
    features: ["topic_menu", "widget_assistant_v2"],
  });
}
