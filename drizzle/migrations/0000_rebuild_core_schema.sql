-- Rebuilt base schema (original base migrations were not in the archive)
CREATE TYPE public.app_language AS ENUM ('en','ru');
CREATE TYPE public.app_role AS ENUM ('admin','finance','support');
CREATE TYPE public.installment_status AS ENUM ('pending','paid','cancelled');
CREATE TYPE public.kyc_file_kind AS ENUM ('document_front','document_back','selfie');
CREATE TYPE public.ledger_type AS ENUM ('deposit','bet','win','bonus','withdrawal','adjustment');
CREATE TYPE public.profile_status AS ENUM ('pending','approved','rejected','blocked');
CREATE TYPE public.withdrawal_status AS ENUM ('requested','approved','paid','rejected');

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text, full_name text, nationality text, document_number text, address text,
  language public.app_language NOT NULL DEFAULT 'en',
  status public.profile_status NOT NULL DEFAULT 'pending',
  status_before_block public.profile_status,
  rejection_reason text, kyc_submitted_at timestamptz,
  referral_code text NOT NULL UNIQUE, referred_by uuid REFERENCES public.profiles(user_id),
  solana_wallet_address text, telegram_id bigint UNIQUE,
  telegram_relink_allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;
-- MFA intentionally removed at owner request; kept for compatibility
CREATE OR REPLACE FUNCTION public.is_staff_mfa(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_staff(_user_id)
$$;
CREATE OR REPLACE FUNCTION public.assert_staff_role(_roles public.app_role[])
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ANY(_roles)
  ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
END $$;

CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile readable" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "own profile updatable" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.app_settings (
  key text PRIMARY KEY, value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable" ON public.app_settings FOR SELECT TO authenticated USING (true);

CREATE TABLE public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid, action text NOT NULL, target_table text, target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id),
  type public.ledger_type NOT NULL, amount numeric(18,2) NOT NULL CHECK (amount <> 0),
  reason text, reference_id uuid, tx_hash text, admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_user_created ON public.ledger (user_id, created_at DESC);
CREATE UNIQUE INDEX ledger_deposit_tx_unique ON public.ledger (tx_hash) WHERE type = 'deposit' AND tx_hash IS NOT NULL;
GRANT SELECT ON public.ledger TO authenticated;
GRANT ALL ON public.ledger TO service_role;
ALTER TABLE public.ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ledger" ON public.ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'finance'));

CREATE TABLE public.bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id),
  game text NOT NULL, amount numeric(18,2) NOT NULL, payout numeric(18,2) NOT NULL DEFAULT 0,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  balance_before numeric(18,2) NOT NULL, balance_after numeric(18,2) NOT NULL,
  server_seed_hash text NOT NULL, server_seed text, client_seed text NOT NULL, nonce bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bets_user_created ON public.bets (user_id, created_at DESC);
GRANT SELECT ON public.bets TO authenticated;
GRANT ALL ON public.bets TO service_role;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bets" ON public.bets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.prevent_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_RECORD'; END $$;
CREATE TRIGGER ledger_immutable BEFORE UPDATE OR DELETE ON public.ledger FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();
CREATE TRIGGER bets_immutable BEFORE UPDATE OR DELETE ON public.bets FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();

CREATE VIEW public.user_balances WITH (security_invoker = true) AS
  SELECT user_id, COALESCE(sum(amount),0)::numeric AS balance FROM public.ledger GROUP BY user_id;
GRANT SELECT ON public.user_balances TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_balance(_user_id uuid DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE target uuid := COALESCE(_user_id, auth.uid());
BEGIN
  IF auth.uid() IS NOT NULL AND target <> auth.uid() AND NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN COALESCE((SELECT sum(amount) FROM public.ledger WHERE user_id = target), 0);
END $$;

CREATE TABLE public.game_settings (
  game text PRIMARY KEY, enabled boolean NOT NULL DEFAULT true,
  rtp numeric(5,2) NOT NULL DEFAULT 96 CHECK (rtp BETWEEN 50 AND 99.5),
  min_bet numeric(18,2) NOT NULL DEFAULT 0.20, max_bet numeric(18,2) NOT NULL DEFAULT 100,
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.game_settings TO authenticated;
GRANT ALL ON public.game_settings TO service_role;
ALTER TABLE public.game_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "games readable" ON public.game_settings FOR SELECT TO authenticated USING (true);
INSERT INTO public.game_settings (game) VALUES ('lost-temple'),('wild-jungle'),('crystal-rush');

CREATE TABLE public.kyc_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  kind public.kyc_file_kind NOT NULL, storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.kyc_files TO authenticated;
GRANT ALL ON public.kyc_files TO service_role;
ALTER TABLE public.kyc_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kyc files read" ON public.kyc_files FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));
CREATE POLICY "own kyc files insert" ON public.kyc_files FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND split_part(storage_path,'/',1) = auth.uid()::text);

CREATE TABLE public.missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id),
  total_amount numeric(18,2) NOT NULL, installments_count integer NOT NULL,
  terms_version integer NOT NULL DEFAULT 1, status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.missions TO authenticated;
GRANT ALL ON public.missions TO service_role;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own missions" ON public.missions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE public.mission_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id),
  sequence integer NOT NULL, amount numeric(18,2) NOT NULL, due_at timestamptz NOT NULL,
  status public.installment_status NOT NULL DEFAULT 'pending',
  paid_at timestamptz, ledger_id bigint REFERENCES public.ledger(id),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (mission_id, sequence)
);
GRANT SELECT ON public.mission_installments TO authenticated;
GRANT ALL ON public.mission_installments TO service_role;
ALTER TABLE public.mission_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own installments" ON public.mission_installments FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(user_id),
  referred_id uuid NOT NULL UNIQUE REFERENCES public.profiles(user_id),
  reward_amount numeric(18,2) NOT NULL DEFAULT 150, rewarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own referrals" ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE, title_en text NOT NULL, title_ru text NOT NULL,
  description_en text, description_ru text, icon text,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb, reward_amount numeric(18,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements readable" ON public.achievements FOR SELECT TO authenticated USING (active OR public.is_staff(auth.uid()));
INSERT INTO public.achievements (code,title_en,title_ru,description_en,description_ru,icon,criteria) VALUES
 ('first_deposit','First deposit','Первый депозит','Make your first deposit','Сделайте первый депозит','wallet','{"type":"first_deposit"}'),
 ('first_bet','First spin','Первый спин','Play your first spin','Сделайте первый спин','sparkles','{"type":"first_bet"}'),
 ('spins_100','100 spins','100 спинов','Play 100 spins','Сделайте 100 спинов','trophy','{"type":"bet_count","threshold":100}');

CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id),
  achievement_id uuid NOT NULL REFERENCES public.achievements(id),
  unlocked_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, achievement_id)
);
GRANT SELECT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own user achievements" ON public.user_achievements FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id),
  amount numeric(18,2) NOT NULL CHECK (amount > 0), destination_address text NOT NULL,
  status public.withdrawal_status NOT NULL DEFAULT 'requested',
  tx_hash text, rejection_reason text, reviewed_by uuid, reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own withdrawals" ON public.withdrawals FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'finance'));

CREATE TABLE public.deposit_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id),
  period text NOT NULL CHECK (period IN ('daily','weekly','monthly')),
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  effective_from timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.deposit_limits TO authenticated;
GRANT ALL ON public.deposit_limits TO service_role;
ALTER TABLE public.deposit_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own limits" ON public.deposit_limits FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE TRIGGER limits_immutable BEFORE UPDATE OR DELETE ON public.deposit_limits FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();

CREATE TABLE public.self_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id),
  starts_at timestamptz NOT NULL DEFAULT now(), ends_at timestamptz, reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.self_exclusions TO authenticated;
GRANT ALL ON public.self_exclusions TO service_role;
ALTER TABLE public.self_exclusions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own exclusions" ON public.self_exclusions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE TRIGGER exclusions_immutable BEFORE UPDATE OR DELETE ON public.self_exclusions FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();

CREATE OR REPLACE FUNCTION public.is_self_excluded(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.self_exclusions WHERE user_id = _user_id
    AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()))
$$;

-- Profile guard: players may change only language directly
CREATE OR REPLACE FUNCTION public.guard_profile_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF current_setting('app.profile_guard_bypass', true) = '1'
     OR coalesce(auth.role(), 'service_role') = 'service_role' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - 'language' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'language' - 'updated_at') THEN
    RAISE EXCEPTION 'PROFILE_FIELD_LOCKED';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_guard BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

CREATE OR REPLACE FUNCTION public.generate_referral_code() RETURNS text
LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE code text;
BEGIN
  LOOP
    code := upper(substr(translate(encode(extensions.gen_random_bytes(8),'base64'),'+/=0OIl1',''),1,8));
    EXIT WHEN length(code) = 8 AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = code);
  END LOOP;
  RETURN code;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref_code text := upper(nullif(btrim(NEW.raw_user_meta_data->>'referral_code'),''));
  referrer uuid; lang public.app_language := 'en';
BEGIN
  IF NEW.raw_user_meta_data->>'language' = 'ru' THEN lang := 'ru'; END IF;
  IF ref_code IS NOT NULL THEN SELECT user_id INTO referrer FROM public.profiles WHERE referral_code = ref_code; END IF;
  INSERT INTO public.profiles (user_id, email, language, referral_code, referred_by)
  VALUES (NEW.id, NEW.email, lang, public.generate_referral_code(), referrer)
  ON CONFLICT (user_id) DO NOTHING;
  IF referrer IS NOT NULL AND referrer <> NEW.id THEN
    INSERT INTO public.referrals (referrer_id, referred_id) VALUES (referrer, NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ledger restrictions: self-exclusion and deposit limits
CREATE OR REPLACE FUNCTION public.enforce_ledger_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lim record; used numeric;
BEGIN
  IF NEW.type IN ('deposit','bet') AND public.is_self_excluded(NEW.user_id) THEN
    RAISE EXCEPTION 'SELF_EXCLUDED';
  END IF;
  IF NEW.type = 'deposit' THEN
    FOR lim IN SELECT DISTINCT ON (period) period, amount FROM public.deposit_limits
      WHERE user_id = NEW.user_id AND effective_from <= now() ORDER BY period, effective_from DESC, created_at DESC LOOP
      IF lim.amount > 0 THEN
        SELECT COALESCE(sum(amount),0) INTO used FROM public.ledger WHERE user_id = NEW.user_id AND type = 'deposit'
          AND created_at >= now() - CASE lim.period WHEN 'daily' THEN interval '1 day' WHEN 'weekly' THEN interval '7 days' ELSE interval '30 days' END;
        IF used + NEW.amount > lim.amount THEN RAISE EXCEPTION 'DEPOSIT_LIMIT_EXCEEDED'; END IF;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ledger_rules BEFORE INSERT ON public.ledger FOR EACH ROW EXECUTE FUNCTION public.enforce_ledger_rules();

CREATE OR REPLACE FUNCTION public.post_ledger_entry(_user_id uuid, _type public.ledger_type, _amount numeric,
  _reason text DEFAULT NULL, _reference_id uuid DEFAULT NULL, _tx_hash text DEFAULT NULL, _admin_id uuid DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE entry bigint;
BEGIN
  INSERT INTO public.ledger (user_id, type, amount, reason, reference_id, tx_hash, admin_id)
  VALUES (_user_id, _type, round(_amount,2), _reason, _reference_id, _tx_hash, _admin_id) RETURNING id INTO entry;
  RETURN entry;
END $$;

-- Player functions (service-only, called after server checks)
CREATE OR REPLACE FUNCTION public.player_save_limits(_user_id uuid, _daily numeric, _weekly numeric, _monthly numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p text; v numeric; cur numeric;
BEGIN
  FOREACH p IN ARRAY ARRAY['daily','weekly','monthly'] LOOP
    v := CASE p WHEN 'daily' THEN _daily WHEN 'weekly' THEN _weekly ELSE _monthly END;
    IF v IS NULL OR v < 0 OR v > 1000000 THEN RAISE EXCEPTION 'INVALID_LIMIT'; END IF;
    SELECT amount INTO cur FROM public.deposit_limits WHERE user_id = _user_id AND period = p AND effective_from <= now()
      ORDER BY effective_from DESC, created_at DESC LIMIT 1;
    IF cur IS NOT DISTINCT FROM v THEN CONTINUE; END IF;
    -- Lowering (stricter) applies now; raising or removing waits 24h
    INSERT INTO public.deposit_limits (user_id, period, amount, effective_from)
    VALUES (_user_id, p, v, CASE WHEN cur IS NULL OR cur = 0 OR (v > 0 AND v < cur) THEN now() ELSE now() + interval '24 hours' END);
  END LOOP;
  INSERT INTO public.audit_log (actor_id, action, target_table, target_id, details)
  VALUES (_user_id, 'deposit_limits_saved', 'deposit_limits', _user_id::text,
    jsonb_build_object('daily',_daily,'weekly',_weekly,'monthly',_monthly));
END $$;

CREATE OR REPLACE FUNCTION public.player_self_exclude(_user_id uuid, _days integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _days IS NOT NULL AND (_days < 1 OR _days > 3650) THEN RAISE EXCEPTION 'INVALID_EXCLUSION'; END IF;
  INSERT INTO public.self_exclusions (user_id, ends_at)
  VALUES (_user_id, CASE WHEN _days IS NULL THEN NULL ELSE now() + make_interval(days => _days) END);
  INSERT INTO public.audit_log (actor_id, action, target_table, target_id, details)
  VALUES (_user_id, 'self_excluded', 'self_exclusions', _user_id::text, jsonb_build_object('days', _days));
END $$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric, _destination_address text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); st public.profile_status; bal numeric; wid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR round(_amount,2) <> _amount THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  IF _destination_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' THEN RAISE EXCEPTION 'INVALID_SOLANA_WALLET'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  SELECT status INTO st FROM public.profiles WHERE user_id = uid FOR UPDATE;
  IF st IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'PLAYER_NOT_APPROVED'; END IF;
  SELECT COALESCE(sum(amount),0) INTO bal FROM public.ledger WHERE user_id = uid;
  IF bal < _amount THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
  INSERT INTO public.withdrawals (user_id, amount, destination_address) VALUES (uid, _amount, _destination_address) RETURNING id INTO wid;
  INSERT INTO public.ledger (user_id, type, amount, reason, reference_id) VALUES (uid, 'withdrawal', -_amount, 'Withdrawal reserved', wid);
  INSERT INTO public.audit_log (actor_id, action, target_table, target_id, details)
  VALUES (uid, 'withdrawal_requested', 'withdrawals', wid::text, jsonb_build_object('amount', _amount));
  RETURN wid;
END $$;

-- Admin functions
CREATE OR REPLACE FUNCTION public.admin_review_kyc(_user_id uuid, _decision text, _reason text DEFAULT NULL, _wallet text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.profiles; ref record;
BEGIN
  PERFORM public.assert_staff_role(ARRAY['admin','support']::public.app_role[]);
  SELECT * INTO p FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND OR p.status <> 'pending' OR p.kyc_submitted_at IS NULL THEN RAISE EXCEPTION 'KYC_NOT_PENDING'; END IF;
  PERFORM set_config('app.profile_guard_bypass', '1', true);
  IF _decision = 'approve' THEN
    IF _wallet IS NULL OR _wallet !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' THEN RAISE EXCEPTION 'INVALID_SOLANA_WALLET'; END IF;
    UPDATE public.profiles SET status = 'approved', rejection_reason = NULL, solana_wallet_address = _wallet WHERE user_id = _user_id;
    SELECT * INTO ref FROM public.referrals WHERE referred_id = _user_id AND rewarded_at IS NULL FOR UPDATE;
    IF FOUND THEN
      INSERT INTO public.ledger (user_id, type, amount, reason, reference_id)
      VALUES (ref.referrer_id, 'bonus', ref.reward_amount, 'Referral reward', ref.id);
      UPDATE public.referrals SET rewarded_at = now() WHERE id = ref.id;
    END IF;
  ELSIF _decision = 'reject' THEN
    IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
    UPDATE public.profiles SET status = 'rejected', rejection_reason = trim(_reason) WHERE user_id = _user_id;
  ELSE RAISE EXCEPTION 'INVALID_DECISION'; END IF;
  PERFORM set_config('app.profile_guard_bypass', '0', true);
  INSERT INTO public.audit_log (actor_id, action, target_table, target_id, details)
  VALUES (auth.uid(), 'kyc_' || _decision, 'profiles', _user_id::text, jsonb_build_object('reason', _reason, 'wallet', _wallet));
END $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_balance(_user_id uuid, _kind text, _amount numeric, _reason text, _tx_hash text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE entry bigint;
BEGIN
  PERFORM public.assert_staff_role(ARRAY['admin','finance']::public.app_role[]);
  IF _kind NOT IN ('deposit','adjustment') OR _amount IS NULL OR _amount = 0 OR round(_amount,2) <> _amount
     OR _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'INVALID_ADJUSTMENT'; END IF;
  IF _kind = 'deposit' AND (_amount <= 0 OR _tx_hash IS NULL) THEN RAISE EXCEPTION 'VALID_TX_HASH_REQUIRED'; END IF;
  IF _kind = 'adjustment' AND _amount < 0 AND (SELECT COALESCE(sum(amount),0) FROM public.ledger WHERE user_id = _user_id) + _amount < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;
  INSERT INTO public.ledger (user_id, type, amount, reason, tx_hash, admin_id)
  VALUES (_user_id, _kind::public.ledger_type, _amount, trim(_reason), CASE WHEN _kind = 'deposit' THEN _tx_hash END, auth.uid())
  RETURNING id INTO entry;
  INSERT INTO public.audit_log (actor_id, action, target_table, target_id, details)
  VALUES (auth.uid(), 'balance_' || _kind, 'ledger', entry::text, jsonb_build_object('user_id', _user_id, 'amount', _amount, 'reason', _reason, 'tx_hash', _tx_hash));
  RETURN entry;
END $$;

CREATE OR REPLACE FUNCTION public.admin_review_withdrawal(_withdrawal_id uuid, _decision text, _reason text DEFAULT NULL, _tx_hash text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.withdrawals;
BEGIN
  PERFORM public.assert_staff_role(ARRAY['admin','finance']::public.app_role[]);
  SELECT * INTO w FROM public.withdrawals WHERE id = _withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WITHDRAWAL_NOT_FOUND'; END IF;
  IF _decision = 'approve' AND w.status = 'requested' THEN
    UPDATE public.withdrawals SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now() WHERE id = w.id;
  ELSIF _decision = 'pay' AND w.status IN ('requested','approved') THEN
    IF _tx_hash IS NULL OR length(_tx_hash) < 32 THEN RAISE EXCEPTION 'VALID_TX_HASH_REQUIRED'; END IF;
    UPDATE public.withdrawals SET status = 'paid', tx_hash = _tx_hash, reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now() WHERE id = w.id;
  ELSIF _decision = 'reject' AND w.status IN ('requested','approved') THEN
    IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
    UPDATE public.withdrawals SET status = 'rejected', rejection_reason = trim(_reason), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now() WHERE id = w.id;
    INSERT INTO public.ledger (user_id, type, amount, reason, reference_id, admin_id)
    VALUES (w.user_id, 'withdrawal', w.amount, 'Withdrawal rejected - refund', w.id, auth.uid());
  ELSE RAISE EXCEPTION 'INVALID_WITHDRAWAL_TRANSITION'; END IF;
  INSERT INTO public.audit_log (actor_id, action, target_table, target_id, details)
  VALUES (auth.uid(), 'withdrawal_' || _decision, 'withdrawals', w.id::text, jsonb_build_object('reason', _reason, 'tx_hash', _tx_hash, 'amount', w.amount));
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_user_blocked(_user_id uuid, _blocked boolean, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.profiles;
BEGIN
  PERFORM public.assert_staff_role(ARRAY['admin']::public.app_role[]);
  SELECT * INTO p FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PLAYER_NOT_FOUND'; END IF;
  PERFORM set_config('app.profile_guard_bypass', '1', true);
  IF _blocked AND p.status <> 'blocked' THEN
    UPDATE public.profiles SET status_before_block = p.status, status = 'blocked', rejection_reason = _reason WHERE user_id = _user_id;
  ELSIF NOT _blocked AND p.status = 'blocked' THEN
    UPDATE public.profiles SET status = COALESCE(p.status_before_block, 'pending'), status_before_block = NULL, rejection_reason = NULL WHERE user_id = _user_id;
  END IF;
  PERFORM set_config('app.profile_guard_bypass', '0', true);
  INSERT INTO public.audit_log (actor_id, action, target_table, target_id, details)
  VALUES (auth.uid(), CASE WHEN _blocked THEN 'user_blocked' ELSE 'user_unblocked' END, 'profiles', _user_id::text, jsonb_build_object('reason', _reason));
END $$;

CREATE OR REPLACE FUNCTION public.admin_allow_telegram_relink(_user_id uuid, _allowed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_staff_role(ARRAY['admin','support']::public.app_role[]);
  PERFORM set_config('app.profile_guard_bypass', '1', true);
  UPDATE public.profiles SET telegram_relink_allowed = _allowed WHERE user_id = _user_id;
  PERFORM set_config('app.profile_guard_bypass', '0', true);
  INSERT INTO public.audit_log (actor_id, action, target_table, target_id, details)
  VALUES (auth.uid(), 'telegram_relink_set', 'profiles', _user_id::text, jsonb_build_object('allowed', _allowed));
END $$;

CREATE OR REPLACE FUNCTION public.admin_save_game_settings(_game text, _rtp numeric, _min_bet numeric, _max_bet numeric, _enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_staff_role(ARRAY['admin']::public.app_role[]);
  IF _rtp < 50 OR _rtp > 99.5 OR _min_bet <= 0 OR _max_bet < _min_bet THEN RAISE EXCEPTION 'INVALID_GAME_SETTINGS'; END IF;
  INSERT INTO public.game_settings (game, rtp, min_bet, max_bet, enabled, updated_by, updated_at)
  VALUES (_game, _rtp, _min_bet, _max_bet, _enabled, auth.uid(), now())
  ON CONFLICT (game) DO UPDATE SET rtp = excluded.rtp, min_bet = excluded.min_bet, max_bet = excluded.max_bet,
    enabled = excluded.enabled, updated_by = excluded.updated_by, updated_at = now();
  INSERT INTO public.audit_log (actor_id, action, target_table, target_id, details)
  VALUES (auth.uid(), 'game_settings_saved', 'game_settings', _game, jsonb_build_object('rtp',_rtp,'min_bet',_min_bet,'max_bet',_max_bet,'enabled',_enabled));
END $$;

CREATE OR REPLACE FUNCTION public.admin_save_mission_terms(_terms text, _version integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_staff_role(ARRAY['admin']::public.app_role[]);
  INSERT INTO public.app_settings (key, value, updated_by)
  VALUES ('mission_terms', jsonb_build_object('version', _version, 'terms', _terms), auth.uid())
  ON CONFLICT (key) DO UPDATE SET value = public.app_settings.value || excluded.value, updated_by = auth.uid(), updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.admin_save_achievement(_id uuid, _code text, _title_en text, _title_ru text,
  _description_en text, _description_ru text, _icon text, _criteria jsonb, _reward_amount numeric, _active boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE aid uuid;
BEGIN
  PERFORM public.assert_staff_role(ARRAY['admin']::public.app_role[]);
  IF _id IS NULL THEN
    INSERT INTO public.achievements (code,title_en,title_ru,description_en,description_ru,icon,criteria,reward_amount,active)
    VALUES (_code,_title_en,_title_ru,_description_en,_description_ru,_icon,_criteria,_reward_amount,_active) RETURNING id INTO aid;
  ELSE
    UPDATE public.achievements SET code=_code,title_en=_title_en,title_ru=_title_ru,description_en=_description_en,
      description_ru=_description_ru,icon=_icon,criteria=_criteria,reward_amount=_reward_amount,active=_active
    WHERE id = _id RETURNING id INTO aid;
    IF aid IS NULL THEN RAISE EXCEPTION 'ACHIEVEMENT_NOT_FOUND'; END IF;
  END IF;
  INSERT INTO public.audit_log (actor_id, action, target_table, target_id, details)
  VALUES (auth.uid(), 'achievement_saved', 'achievements', aid::text, jsonb_build_object('code', _code));
  RETURN aid;
END $$;

CREATE OR REPLACE FUNCTION public.admin_reports(_from timestamptz, _to timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public.assert_staff_role(ARRAY['admin','finance']::public.app_role[]);
  SELECT jsonb_build_object(
    'revenue', COALESCE((SELECT sum(amount - payout) FROM public.bets WHERE created_at >= _from AND created_at < _to),0),
    'deposits', COALESCE((SELECT sum(amount) FROM public.ledger WHERE type='deposit' AND created_at >= _from AND created_at < _to),0),
    'withdrawals', COALESCE((SELECT sum(amount) FROM public.withdrawals WHERE status='paid' AND reviewed_at >= _from AND reviewed_at < _to),0),
    'bet_volume', COALESCE((SELECT sum(amount) FROM public.bets WHERE created_at >= _from AND created_at < _to),0),
    'active_players', (SELECT count(DISTINCT user_id) FROM public.bets WHERE created_at >= _from AND created_at < _to),
    'games', COALESCE((SELECT jsonb_agg(jsonb_build_object('game',game,'volume',volume,'bets',n) ORDER BY volume DESC)
       FROM (SELECT game, sum(amount) volume, count(*) n FROM public.bets WHERE created_at >= _from AND created_at < _to GROUP BY game) g),'[]'::jsonb)
  ) INTO result;
  RETURN result;
END $$;

-- Lock down function execution
REVOKE EXECUTE ON FUNCTION public.post_ledger_entry(uuid,public.ledger_type,numeric,text,uuid,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.player_save_limits(uuid,numeric,numeric,numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.player_self_exclude(uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_ledger_entry(uuid,public.ledger_type,numeric,text,uuid,text,uuid), public.player_save_limits(uuid,numeric,numeric,numeric), public.player_self_exclude(uuid,integer) TO service_role;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Private KYC storage policies
CREATE POLICY "kyc own upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "kyc own read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text);