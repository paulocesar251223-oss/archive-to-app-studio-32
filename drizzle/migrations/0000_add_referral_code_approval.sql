ALTER TABLE public.profiles
  ADD COLUMN referral_code_status text NOT NULL DEFAULT 'not_requested',
  ADD COLUMN referral_requested_at timestamptz,
  ADD COLUMN referral_code_approved_at timestamptz,
  ADD COLUMN referral_code_approved_by uuid;

UPDATE public.profiles
SET referral_code_status = 'approved',
    referral_requested_at = created_at,
    referral_code_approved_at = created_at;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_referral_code_status_check
  CHECK (referral_code_status IN ('not_requested', 'pending', 'approved'));

CREATE OR REPLACE FUNCTION public.request_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  current_status text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT referral_code_status INTO current_status
  FROM public.profiles
  WHERE user_id = uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  IF current_status = 'not_requested' THEN
    PERFORM set_config('app.profile_guard_bypass', '1', true);
    UPDATE public.profiles
    SET referral_code_status = 'pending', referral_requested_at = now()
    WHERE user_id = uid;
    PERFORM set_config('app.profile_guard_bypass', '0', true);

    INSERT INTO public.audit_log (actor_id, action, target_table, target_id, details)
    VALUES (uid, 'referral_code_requested', 'profiles', uid::text, '{}'::jsonb);
    RETURN 'pending';
  END IF;

  RETURN current_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_referral_code(_user_id uuid, _code text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_code text := upper(nullif(btrim(_code), ''));
BEGIN
  PERFORM public.assert_staff_role(ARRAY['admin']::public.app_role[]);

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id) THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  IF normalized_code IS NULL THEN
    normalized_code := public.generate_referral_code();
  ELSIF normalized_code !~ '^[A-Z0-9]{8}$' THEN
    RAISE EXCEPTION 'INVALID_REFERRAL_CODE';
  END IF;

  PERFORM set_config('app.profile_guard_bypass', '1', true);
  UPDATE public.profiles
  SET referral_code = normalized_code,
      referral_code_status = 'approved',
      referral_requested_at = coalesce(referral_requested_at, now()),
      referral_code_approved_at = now(),
      referral_code_approved_by = auth.uid()
  WHERE user_id = _user_id;
  PERFORM set_config('app.profile_guard_bypass', '0', true);

  INSERT INTO public.audit_log (actor_id, action, target_table, target_id, details)
  VALUES (auth.uid(), 'referral_code_approved', 'profiles', _user_id::text,
          jsonb_build_object('referral_code', normalized_code));

  RETURN normalized_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_code text := upper(nullif(btrim(NEW.raw_user_meta_data->>'referral_code'), ''));
  referrer uuid;
  lang public.app_language := 'en';
BEGIN
  IF NEW.raw_user_meta_data->>'language' = 'ru' THEN
    lang := 'ru';
  END IF;

  IF ref_code IS NOT NULL THEN
    SELECT user_id INTO referrer
    FROM public.profiles
    WHERE referral_code = ref_code AND referral_code_status = 'approved';
  END IF;

  INSERT INTO public.profiles (user_id, email, language, referral_code, referred_by)
  VALUES (NEW.id, NEW.email, lang, public.generate_referral_code(), referrer)
  ON CONFLICT (user_id) DO NOTHING;

  IF referrer IS NOT NULL AND referrer <> NEW.id THEN
    INSERT INTO public.referrals (referrer_id, referred_id)
    VALUES (referrer, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_referral_code() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_referral_code(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_referral_code() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_referral_code(uuid, text) TO authenticated, service_role;