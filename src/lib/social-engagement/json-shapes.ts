/**
 * Documented JSON shapes for `public.social_engagement_items` JSON columns.
 * Stored as Json in Supabase — validate at ingest boundaries when comment pipelines are added.
 */

/** `social_engagement_items.post_reference` — post / media context (no secrets). */
export type SocialEngagementPostReferenceV1 = {
  permalink?: string;
  media_id?: string;
  post_id?: string;
  parent_comment_id?: string;
  /** Short excerpt of post caption for staff context (optional). */
  post_caption_snippet?: string;
};

/** `social_engagement_items.commenter` — public profile snapshot at ingest time. */
export type SocialEngagementCommenterV1 = {
  external_id?: string;
  display_name?: string;
  handle?: string;
  profile_url?: string;
};
