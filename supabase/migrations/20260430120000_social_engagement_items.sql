-- ---------------------------------------------------------------------------
-- Public social comments & mentions (separate lane from private DM threads)
-- ---------------------------------------------------------------------------
-- Model: `social_engagement_items` holds one row per public comment / @mention.
-- - Never link to `conversations` / `messages` — those stay for 1:1 messaging only.
-- - Ingestion (e.g. Meta `changes` for comments) is not wired here; this migration is schema-only.
-- - Product UX: surface in inbox via a **parallel queue** (tab, drawer, or badge) that queries this
--   table — not by merging rows into the conversation list SQL.

CREATE TYPE public.social_engagement_handling_state AS ENUM (
  'unhandled',
  'handled',
  'dismissed'
);

COMMENT ON TYPE public.social_engagement_handling_state IS
  'Staff triage for social alerts. Distinct from conversation_status (private threads).';

CREATE TABLE public.social_engagement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  dealership_id uuid NOT NULL REFERENCES public.dealerships (id) ON DELETE CASCADE,
  /**
   * Provider + surface, e.g. meta_instagram_comment, meta_facebook_comment, meta_facebook_mention.
   * Free text (like dealership_channel_accounts.provider) so new networks do not require enum migrations.
   */
  platform text NOT NULL,
  /** Stable id from the network (comment id) for dedupe with `platform`. */
  external_comment_id text NOT NULL,
  /** Post / media / permalink references — see app type `SocialEngagementPostReferenceV1`. */
  post_reference jsonb NOT NULL DEFAULT '{}'::jsonb,
  /** Commenter identity — see app type `SocialEngagementCommenterV1`. */
  commenter jsonb NOT NULL DEFAULT '{}'::jsonb,
  body text NOT NULL,
  /** When the comment was authored on the network (from webhook payload). */
  occurred_at timestamptz NOT NULL,
  /** When this row was written by our ingest pipeline. */
  received_at timestamptz NOT NULL DEFAULT now (),
  handling_state public.social_engagement_handling_state NOT NULL DEFAULT 'unhandled',
  handled_at timestamptz NULL,
  handled_by_user_id uuid NULL REFERENCES public.staff_users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now (),
  updated_at timestamptz NOT NULL DEFAULT now (),
  CONSTRAINT social_engagement_items_platform_nonempty CHECK (length(trim(platform)) > 0),
  CONSTRAINT social_engagement_items_external_comment_nonempty CHECK (length(trim(external_comment_id)) > 0),
  CONSTRAINT social_engagement_items_body_nonempty CHECK (length(trim(body)) > 0),
  CONSTRAINT social_engagement_items_handling_timestamps CHECK (
    (
      handling_state = 'unhandled'
      AND handled_at IS NULL
    )
    OR (
      handling_state <> 'unhandled'
      AND handled_at IS NOT NULL
    )
  )
);

COMMENT ON TABLE public.social_engagement_items IS
  'Public social engagement (comments, mentions). Not private DMs — do not reuse conversations/messages.';

COMMENT ON COLUMN public.social_engagement_items.post_reference IS
  'JSON: permalink, media_id, post_id, parent_comment_id, etc.';

COMMENT ON COLUMN public.social_engagement_items.commenter IS
  'JSON: external_id, display_name, handle, profile_url (optional).';

CREATE UNIQUE INDEX social_engagement_items_dedupe_uidx ON public.social_engagement_items (
  dealership_id,
  platform,
  external_comment_id
);

CREATE INDEX social_engagement_items_queue_idx ON public.social_engagement_items (
  dealership_id,
  handling_state,
  occurred_at DESC
);

CREATE TRIGGER social_engagement_items_set_updated_at BEFORE
UPDATE ON public.social_engagement_items FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();

ALTER TABLE public.social_engagement_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY social_engagement_items_select ON public.social_engagement_items FOR SELECT TO authenticated USING (
  user_has_dealership_access (dealership_id)
);

CREATE POLICY social_engagement_items_insert ON public.social_engagement_items FOR INSERT TO authenticated
WITH CHECK (
  user_has_dealership_access (dealership_id)
    AND current_staff_is_privileged ()
);

CREATE POLICY social_engagement_items_update ON public.social_engagement_items FOR UPDATE TO authenticated USING (
  user_has_dealership_access (dealership_id)
)
WITH CHECK (
  user_has_dealership_access (dealership_id)
);

CREATE POLICY social_engagement_items_delete ON public.social_engagement_items FOR DELETE TO authenticated USING (
  user_has_dealership_access (dealership_id)
    AND current_staff_is_privileged ()
);
