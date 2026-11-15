CREATE OR REPLACE FUNCTION public.admin_adjust_balance(_user_id uuid, _kind text, _amount numeric, _reason text, _tx_hash text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE entry bigint;
BEGIN
  PERFORM public.assert_staff_role(ARRAY['admin','finance']::public.app_role[]);
  IF _kind NOT IN ('deposit','adjustment') OR _amount IS NULL OR _amount = 0 OR round(_amount,2) <> _amount
     OR _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'INVALID_ADJUSTMENT'; END IF;
  IF _kind = 'deposit' AND _amount <= 0 THEN RAISE EXCEPTION 'DEPOSIT_MUST_BE_POSITIVE'; END IF;
  IF _kind = 'adjustment' AND _amount < 0 AND (SELECT COALESCE(sum(amount),0) FROM public.ledger WHERE user_id = _user_id) + _amount < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;
  INSERT INTO public.ledger (user_id, type, amount, reason, tx_hash, admin_id)
  VALUES (_user_id, _kind::public.ledger_type, _amount, trim(_reason), CASE WHEN _kind = 'deposit' THEN NULLIF(trim(_tx_hash), '') END, auth.uid())
  RETURNING id INTO entry;
  INSERT INTO public.audit_log (actor_id, action, target_table, target_id, details)
  VALUES (auth.uid(), 'balance_' || _kind, 'ledger', entry::text, jsonb_build_object('user_id', _user_id, 'amount', _amount, 'reason', _reason, 'tx_hash', NULLIF(trim(_tx_hash), '')));
  RETURN entry;
END $$;