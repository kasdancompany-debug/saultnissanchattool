-- Manual inbox sample data (run in Supabase SQL Editor or psql).
-- 1) Set v_staff_id to your auth user id (public.staff_users.id).
-- 2) Run the whole script.
--
-- Optional: delete previous seed tagged the same way:
--   DELETE FROM public.conversations WHERE metadata @> '{"dev_seed":"inbox-manual-sample"}'::jsonb;
--   DELETE FROM public.customers WHERE metadata @> '{"dev_seed":"inbox-manual-sample"}'::jsonb;
-- (Deletes cascade messages.)

DO $$
DECLARE
  v_staff_id uuid := '00000000-0000-0000-0000-000000000000'; -- REPLACE
  v_dealership_id uuid;
  v_customer_id uuid;
  v_conv_id uuid;
  t0 timestamptz := now() - interval '5 minutes';
  t1 timestamptz := now() - interval '4 minutes';
  t2 timestamptz := now() - interval '3 minutes';
  t3 timestamptz := now() - interval '2 minutes';
  t4 timestamptz := now() - interval '1 minute';
BEGIN
  IF v_staff_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'Replace v_staff_id with your staff_users.id (same as auth.users id).';
  END IF;

  SELECT dealership_id
  INTO v_dealership_id
  FROM public.staff_users
  WHERE id = v_staff_id;

  IF v_dealership_id IS NULL THEN
    RAISE EXCEPTION 'staff_users row not found for id %', v_staff_id;
  END IF;

  INSERT INTO public.customers (
    dealership_id,
    display_name,
    phone_e164,
    email,
    metadata
  )
  VALUES (
    v_dealership_id,
    'Manual Dev Customer',
    '+15551230001',
    'manual.dev.customer@example.com',
    '{"dev_seed":"inbox-manual-sample"}'::jsonb
  )
  RETURNING id INTO v_customer_id;

  INSERT INTO public.conversations (
    dealership_id,
    customer_id,
    channel,
    department,
    status,
    sentiment,
    ai_enabled,
    assigned_to_user_id,
    title,
    metadata
  )
  VALUES (
    v_dealership_id,
    v_customer_id,
    'web_chat',
    'sales',
    'open',
    'neutral',
    false,
    v_staff_id,
    '[DEV] Manual seed conversation',
    '{"dev_seed":"inbox-manual-sample"}'::jsonb
  )
  RETURNING id INTO v_conv_id;

  INSERT INTO public.messages (
    conversation_id,
    sender_type,
    sender_user_id,
    body,
    delivery_status,
    created_at
  )
  VALUES
    (v_conv_id, 'customer', NULL, 'Customer: first message.', 'delivered', t0),
    (v_conv_id, 'staff', v_staff_id, 'Staff: reply.', 'sent', t1),
    (v_conv_id, 'customer', NULL, 'Customer: follow-up.', 'delivered', t2),
    (v_conv_id, 'staff', v_staff_id, 'Staff: closing detail.', 'sent', t3),
    (v_conv_id, 'customer', NULL, 'Customer: thanks.', 'delivered', t4);

  RAISE NOTICE 'customer_id=%, conversation_id=%', v_customer_id, v_conv_id;
END $$;
