-- Per-dealership bindings to external messaging providers (Twilio lines, Meta Page / IG / WA ids).
-- Keeps provider-specific identifiers out of ad-hoc columns; app reads this for webhook routing + outbound From.

CREATE TABLE public.dealership_channel_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  dealership_id uuid NOT NULL REFERENCES public.dealerships (id) ON DELETE CASCADE,
  /**
   * Provider key (app-level convention), e.g.:
   *   twilio_sms        — external_account_id = E.164 number (inbound To / outbound From)
   *   meta_messenger    — external_account_id = Meta Page-Scoped ID or Page id (as you standardize in metadata)
   *   meta_instagram    — IG professional / business account id
   *   meta_whatsapp     — WhatsApp Business phone id (future)
   * Add new values without DB migrations beyond INSERT conventions.
   */
  provider text NOT NULL,
  /** Provider-native stable id (phone E.164, page id, etc.); normalized in app before insert. */
  external_account_id text NOT NULL,
  display_label text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dealership_channel_accounts_provider_nonempty CHECK (length(trim(provider)) > 0),
  CONSTRAINT dealership_channel_accounts_external_nonempty CHECK (length(trim(external_account_id)) > 0)
);

COMMENT ON TABLE public.dealership_channel_accounts IS
  'Maps a dealership to external messaging identities. Inbound webhooks resolve dealership_id from (provider, external_account_id); outbound picks an active row for From/Page id.';

COMMENT ON COLUMN public.dealership_channel_accounts.provider IS
  'Logical provider slug (text). Known: twilio_sms, meta_messenger, meta_instagram, meta_whatsapp.';

COMMENT ON COLUMN public.dealership_channel_accounts.external_account_id IS
  'Opaque id from the provider (E.164 for Twilio SMS, Page/IG/WA ids for Meta).';

COMMENT ON COLUMN public.dealership_channel_accounts.metadata IS
  'Provider extras: e.g. twilio_messaging_service_sid, meta_app_id, webhook verify flags — avoid secrets here.';

CREATE UNIQUE INDEX dealership_channel_accounts_dealership_provider_external_uidx
  ON public.dealership_channel_accounts (dealership_id, provider, external_account_id);

CREATE INDEX dealership_channel_accounts_lookup_inbound_idx
  ON public.dealership_channel_accounts (provider, external_account_id)
  WHERE
    is_active = TRUE;

CREATE INDEX dealership_channel_accounts_dealership_active_idx
  ON public.dealership_channel_accounts (dealership_id)
  WHERE
    is_active = TRUE;

CREATE TRIGGER dealership_channel_accounts_set_updated_at
  BEFORE UPDATE ON public.dealership_channel_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at ();

ALTER TABLE public.dealership_channel_accounts
  ADD CONSTRAINT dealership_channel_accounts_timestamps_consistent CHECK (updated_at >= created_at);

-- ---------------------------------------------------------------------------
-- RLS (staff read; privileged write — same posture as dealerships mutations)
-- ---------------------------------------------------------------------------
ALTER TABLE public.dealership_channel_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY dealership_channel_accounts_select ON public.dealership_channel_accounts
  FOR SELECT TO authenticated
    USING (user_has_dealership_access (dealership_id));

CREATE POLICY dealership_channel_accounts_insert ON public.dealership_channel_accounts
  FOR INSERT TO authenticated
    WITH CHECK (user_has_dealership_access (dealership_id)
      AND current_staff_is_privileged ());

CREATE POLICY dealership_channel_accounts_update ON public.dealership_channel_accounts
  FOR UPDATE TO authenticated
    USING (user_has_dealership_access (dealership_id)
      AND current_staff_is_privileged ())
    WITH CHECK (user_has_dealership_access (dealership_id)
      AND current_staff_is_privileged ());

CREATE POLICY dealership_channel_accounts_delete ON public.dealership_channel_accounts
  FOR DELETE TO authenticated
    USING (user_has_dealership_access (dealership_id)
      AND current_staff_is_privileged ());
