ALTER TABLE public.missions
  ADD COLUMN deposit_amount numeric,
  ADD COLUMN source_ledger_id bigint REFERENCES public.ledger(id),
  ADD COLUMN rollover numeric NOT NULL DEFAULT 1,
  ADD COLUMN expires_at timestamptz;

CREATE UNIQUE INDEX missions_one_cashback_per_user ON public.missions (user_id);
CREATE UNIQUE INDEX missions_source_ledger_unique ON public.missions (source_ledger_id) WHERE source_ledger_id IS NOT NULL;
CREATE INDEX mission_installments_release_queue ON public.mission_installments (status, due_at) WHERE status = 'pending';
CREATE UNIQUE INDEX profiles_document_number_normalized_unique ON public.profiles (upper(btrim(document_number))) WHERE document_number IS NOT NULL AND btrim(document_number) <> '';

CREATE OR REPLACE FUNCTION public.create_cashback_mission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  mission_id uuid; terms jsonb; term_version integer := 1; expiry_days integer := 30; rollover_value numeric := 1;
BEGIN
  IF NEW.type <> 'deposit' OR NEW.amount <= 0 OR NEW.amount > 200 THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.missions WHERE user_id = NEW.user_id) THEN RETURN NEW; END IF;
  SELECT value INTO terms FROM public.app_settings WHERE key = 'mission_terms';
  IF terms IS NOT NULL THEN
    term_version := GREATEST(1, COALESCE((terms->>'version')::integer, 1));
    expiry_days := LEAST(365, GREATEST(1, COALESCE((terms->>'expiresDays')::integer, 30)));
    rollover_value := LEAST(1000, GREATEST(0, COALESCE((terms->>'rollover')::numeric, 1)));
  END IF;
  INSERT INTO public.missions (user_id, total_amount, installments_count, terms_version, deposit_amount, source_ledger_id, rollover, expires_at)
  VALUES (NEW.user_id, 100, 5, term_version, NEW.amount, NEW.id, rollover_value, now() + make_interval(days => expiry_days))
  RETURNING id INTO mission_id;
  INSERT INTO public.mission_installments (mission_id, user_id, sequence, amount, due_at)
  SELECT mission_id, NEW.user_id, sequence, 20, date_trunc('day', now()) + (sequence * interval '1 day')
  FROM generate_series(1, 5) AS sequence;
  INSERT INTO public.audit_log (actor_id, action, target_table, target_id, details)
  VALUES (NULL, 'cashback_mission_created', 'missions', mission_id::text,
    jsonb_build_object('user_id', NEW.user_id, 'deposit_amount', NEW.amount, 'terms_version', term_version));
  RETURN NEW;
END;
$function$;
CREATE TRIGGER trg_create_cashback_mission AFTER INSERT ON public.ledger FOR EACH ROW EXECUTE FUNCTION public.create_cashback_mission();

CREATE OR REPLACE FUNCTION public.release_cashback_installments()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE item record; entry_id bigint; released_count integer := 0;
BEGIN
  UPDATE public.mission_installments i SET status = 'cancelled' FROM public.missions m
  WHERE i.mission_id = m.id AND i.status = 'pending' AND m.status = 'active' AND m.expires_at IS NOT NULL AND m.expires_at <= now();
  UPDATE public.missions m SET status = 'expired' WHERE m.status = 'active' AND m.expires_at IS NOT NULL AND m.expires_at <= now();
  FOR item IN
    SELECT i.id, i.mission_id, i.user_id, i.amount FROM public.mission_installments i
    JOIN public.missions m ON m.id = i.mission_id
    WHERE i.status = 'pending' AND m.status = 'active' AND i.due_at <= now() AND (m.expires_at IS NULL OR m.expires_at > now())
    ORDER BY i.due_at, i.sequence FOR UPDATE OF i, m SKIP LOCKED
  LOOP
    INSERT INTO public.ledger (user_id, type, amount, reason, reference_id)
    VALUES (item.user_id, 'bonus', item.amount, 'Daily cashback installment', item.mission_id) RETURNING id INTO entry_id;
    UPDATE public.mission_installments SET status = 'paid', paid_at = now(), ledger_id = entry_id WHERE id = item.id;
    INSERT INTO public.audit_log (actor_id, action, target_table, target_id, details)
    VALUES (NULL, 'cashback_installment_released', 'mission_installments', item.id::text,
      jsonb_build_object('user_id', item.user_id, 'mission_id', item.mission_id, 'ledger_id', entry_id, 'amount', item.amount));
    released_count := released_count + 1;
  END LOOP;
  UPDATE public.missions m SET status = 'completed'
  WHERE m.status = 'active' AND NOT EXISTS (SELECT 1 FROM public.mission_installments i WHERE i.mission_id = m.id AND i.status = 'pending');
  RETURN released_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.evaluate_achievements(_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE achievement record; metric numeric; qualifies boolean; unlocked_count integer := 0;
BEGIN
  IF _user_id IS NULL THEN RETURN 0; END IF;
  FOR achievement IN SELECT id, criteria FROM public.achievements WHERE active LOOP
    IF EXISTS (SELECT 1 FROM public.user_achievements WHERE user_id = _user_id AND achievement_id = achievement.id) THEN CONTINUE; END IF;
    qualifies := false;
    CASE achievement.criteria->>'type'
      WHEN 'first_deposit' THEN
        SELECT EXISTS (SELECT 1 FROM public.ledger WHERE user_id = _user_id AND type = 'deposit' AND amount > 0) INTO qualifies;
      WHEN 'first_bet' THEN
        SELECT EXISTS (SELECT 1 FROM public.bets WHERE user_id = _user_id) INTO qualifies;
      WHEN 'bet_count' THEN
        SELECT count(*) INTO metric FROM public.bets WHERE user_id = _user_id;
        qualifies := metric >= GREATEST(1, COALESCE((achievement.criteria->>'threshold')::numeric, 1));
      WHEN 'total_wagered' THEN
        SELECT COALESCE(sum(amount), 0) INTO metric FROM public.bets WHERE user_id = _user_id;
        qualifies := metric >= GREATEST(0, COALESCE((achievement.criteria->>'threshold')::numeric, 0));
      ELSE qualifies := false;
    END CASE;
    IF qualifies THEN
      INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (_user_id, achievement.id) ON CONFLICT (user_id, achievement_id) DO NOTHING;
      IF FOUND THEN unlocked_count := unlocked_count + 1; END IF;
    END IF;
  END LOOP;
  RETURN unlocked_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.evaluate_ledger_achievements()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.type = 'deposit' AND NEW.amount > 0 THEN PERFORM public.evaluate_achievements(NEW.user_id); END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.evaluate_bet_achievements()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN PERFORM public.evaluate_achievements(NEW.user_id); RETURN NEW; END;
$function$;
CREATE TRIGGER trg_evaluate_ledger_achievements AFTER INSERT ON public.ledger FOR EACH ROW EXECUTE FUNCTION public.evaluate_ledger_achievements();
CREATE TRIGGER trg_evaluate_bet_achievements AFTER INSERT ON public.bets FOR EACH ROW EXECUTE FUNCTION public.evaluate_bet_achievements();

CREATE OR REPLACE FUNCTION public.admin_save_cashback_terms(_version integer, _rollover numeric, _expires_days integer, _terms text, _withdrawal_rules text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_staff_role(ARRAY['admin']::public.app_role[]);
  IF _version < 1 OR _rollover < 0 OR _rollover > 1000 OR _expires_days < 1 OR _expires_days > 365
     OR _terms IS NULL OR length(trim(_terms)) < 10 OR length(_terms) > 20000
     OR _withdrawal_rules IS NULL OR length(trim(_withdrawal_rules)) < 3 OR length(_withdrawal_rules) > 5000 THEN
    RAISE EXCEPTION 'INVALID_MISSION_TERMS';
  END IF;
  INSERT INTO public.app_settings (key, value, updated_by)
  VALUES ('mission_terms', jsonb_build_object('version', _version, 'rollover', _rollover, 'expiresDays', _expires_days,
    'terms', trim(_terms), 'withdrawalRules', trim(_withdrawal_rules)), auth.uid())
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_by = auth.uid();
  INSERT INTO public.audit_log (actor_id, action, target_table, target_id, details)
  VALUES (auth.uid(), 'mission_terms_saved', 'app_settings', 'mission_terms',
    jsonb_build_object('version', _version, 'rollover', _rollover, 'expires_days', _expires_days));
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_kyc(_full_name text, _nationality text, _document_number text, _address text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.profiles; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO p FROM public.profiles WHERE user_id = uid FOR UPDATE;
  IF NOT (p.status = 'rejected' OR (p.status = 'pending' AND p.kyc_submitted_at IS NULL)) THEN
    RAISE EXCEPTION 'KYC cannot be submitted in current status';
  END IF;
  IF length(trim(coalesce(_full_name,''))) < 3 OR length(trim(coalesce(_document_number,''))) < 3
     OR length(trim(coalesce(_address,''))) < 5 OR _nationality !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'Invalid KYC data';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kyc_files WHERE user_id = uid AND kind = 'document_front' AND created_at > coalesce(p.kyc_submitted_at, '-infinity'))
     OR NOT EXISTS (SELECT 1 FROM public.kyc_files WHERE user_id = uid AND kind = 'selfie' AND created_at > coalesce(p.kyc_submitted_at, '-infinity')) THEN
    RAISE EXCEPTION 'Document photo and selfie required';
  END IF;
  PERFORM set_config('app.profile_guard_bypass', '1', true);
  UPDATE public.profiles SET full_name = trim(_full_name), nationality = _nationality,
    document_number = upper(trim(_document_number)), address = trim(_address),
    status = 'pending', rejection_reason = NULL, kyc_submitted_at = now()
  WHERE user_id = uid;
  PERFORM set_config('app.profile_guard_bypass', '0', true);
  INSERT INTO public.audit_log(actor_id, action, target_table, target_id) VALUES (uid, 'kyc_submitted', 'profiles', uid::text);
END;
$function$;

CREATE TABLE public.slot_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id),
  game text NOT NULL, server_seed text NOT NULL, server_seed_hash text NOT NULL, client_seed text NOT NULL,
  nonce bigint NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(), revealed_at timestamptz
);
GRANT ALL ON public.slot_sessions TO service_role;
ALTER TABLE public.slot_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX slot_sessions_user_game ON public.slot_sessions (user_id, game, created_at DESC);

CREATE TABLE public.spin_requests (
  request_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id),
  session_id uuid NOT NULL REFERENCES public.slot_sessions(id),
  response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.spin_requests TO service_role;
ALTER TABLE public.spin_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX spin_requests_user_created ON public.spin_requests (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.play_slot_spins(_session_id uuid, _request_id uuid, _bet numeric, _spins integer, _results jsonb, _response jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  session record; existing_response jsonb; player_status public.profile_status; settings record;
  balance_before numeric; balance_after numeric; total_payout numeric; total_debit numeric;
BEGIN
  SELECT * INTO session FROM public.slot_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SPIN_SESSION_NOT_FOUND'; END IF;
  SELECT response INTO existing_response FROM public.spin_requests
  WHERE request_id = _request_id AND session_id = _session_id AND user_id = session.user_id;
  IF existing_response IS NOT NULL THEN RETURN existing_response; END IF;
  IF EXISTS (SELECT 1 FROM public.spin_requests WHERE request_id = _request_id) THEN RAISE EXCEPTION 'REQUEST_ID_IN_USE'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(session.user_id::text, 0));
  SELECT status INTO player_status FROM public.profiles WHERE user_id = session.user_id FOR UPDATE;
  IF player_status <> 'approved' THEN RAISE EXCEPTION 'PLAYER_NOT_APPROVED'; END IF;
  IF public.is_self_excluded(session.user_id) THEN RAISE EXCEPTION 'SELF_EXCLUDED'; END IF;
  IF session.status <> 'active' THEN RAISE EXCEPTION 'SPIN_SESSION_REVEALED'; END IF;
  SELECT * INTO settings FROM public.game_settings WHERE game = session.game;
  IF NOT FOUND OR NOT settings.enabled THEN RAISE EXCEPTION 'GAME_DISABLED'; END IF;
  IF _bet IS NULL OR round(_bet, 2) <> _bet OR _bet NOT IN (0.20,0.50,1,2,5,10,15,20,25,50,100)
     OR _bet < settings.min_bet OR _bet > settings.max_bet THEN RAISE EXCEPTION 'INVALID_BET'; END IF;
  IF _spins NOT IN (1,10,100) OR jsonb_typeof(_results) <> 'array' OR jsonb_array_length(_results) <> _spins THEN
    RAISE EXCEPTION 'INVALID_SPIN_COUNT';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(_results) item
    WHERE jsonb_typeof(item->'reels') <> 'array' OR (item->>'payout')::numeric < 0 OR (item->>'payout')::numeric > 1000000000
  ) THEN RAISE EXCEPTION 'INVALID_SPIN_RESULTS'; END IF;
  total_debit := _bet * _spins;
  SELECT COALESCE(sum((item->>'payout')::numeric), 0) INTO total_payout FROM jsonb_array_elements(_results) item;
  SELECT COALESCE(sum(amount), 0) INTO balance_before FROM public.ledger WHERE user_id = session.user_id;
  IF balance_before < total_debit THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
  balance_after := balance_before - total_debit + total_payout;
  _response := jsonb_set(_response, '{balance}', to_jsonb(balance_after), true);
  WITH parsed AS (
    SELECT item.value AS result, item.ordinality, (item.value->>'payout')::numeric AS payout
    FROM jsonb_array_elements(_results) WITH ORDINALITY AS item(value, ordinality)
  ), running AS (
    SELECT parsed.*, COALESCE(sum(payout) OVER (ORDER BY ordinality ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), 0) - payout AS prior_payout
    FROM parsed
  )
  INSERT INTO public.bets (user_id, game, amount, result, payout, balance_before, balance_after, server_seed_hash, client_seed, nonce)
  SELECT session.user_id, session.game, _bet, result, payout,
    balance_before + prior_payout - (_bet * (ordinality - 1)),
    balance_before + prior_payout + payout - (_bet * ordinality),
    session.server_seed_hash, session.client_seed, session.nonce + ordinality - 1
  FROM running;
  INSERT INTO public.ledger (user_id, type, amount, reason, reference_id) VALUES (session.user_id, 'bet', -total_debit, 'Slot spin batch', session.id);
  IF total_payout > 0 THEN
    INSERT INTO public.ledger (user_id, type, amount, reason, reference_id) VALUES (session.user_id, 'win', total_payout, 'Slot spin prize', session.id);
  END IF;
  UPDATE public.slot_sessions SET nonce = nonce + _spins WHERE id = session.id;
  INSERT INTO public.spin_requests (request_id, user_id, session_id, response) VALUES (_request_id, session.user_id, session.id, _response);
  INSERT INTO public.audit_log (actor_id, action, target_table, target_id, details)
  VALUES (session.user_id, 'slot_spins_completed', 'slot_sessions', session.id::text,
    jsonb_build_object('request_id', _request_id, 'game', session.game, 'bet', _bet,
      'spins', _spins, 'debit', total_debit, 'payout', total_payout, 'balance_after', balance_after));
  RETURN _response;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_spin_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF (SELECT count(*) FROM public.spin_requests WHERE user_id = NEW.user_id AND created_at >= now() - interval '10 seconds') >= 5 THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER trg_spin_rate_limit BEFORE INSERT ON public.spin_requests FOR EACH ROW EXECUTE FUNCTION public.enforce_spin_rate_limit();

REVOKE ALL ON FUNCTION public.release_cashback_installments() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.evaluate_achievements(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.play_slot_spins(uuid,uuid,numeric,integer,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_spin_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_cashback_mission() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.evaluate_ledger_achievements() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.evaluate_bet_achievements() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_cashback_installments(), public.evaluate_achievements(uuid), public.play_slot_spins(uuid,uuid,numeric,integer,jsonb,jsonb) TO service_role;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;