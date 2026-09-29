-- ENGAGE: Earning-user withdrawal requests
-- Run after 007_account_types_earning_promotion.sql.
-- Promotion accounts are not allowed to request withdrawals.

create or replace function public.request_withdrawal(
  p_user_id uuid,
  p_coins numeric,
  p_payment_method text default 'UPI',
  p_payment_details text default ''
)
returns public.withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.wallets%rowtype;
  result public.withdrawals%rowtype;
  new_balance numeric;
  requested_amount numeric;
  account_type_value text;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Unauthorized';
  end if;

  select account_type into account_type_value
  from public.profiles
  where id = p_user_id;

  if coalesce(account_type_value, 'earning') <> 'earning' then
    raise exception 'Only earning accounts can request withdrawals.';
  end if;

  if p_coins is null or p_coins < 100 then
    raise exception 'Minimum withdrawal is 100 coins.';
  end if;

  if p_payment_method not in ('UPI','BANK') then
    raise exception 'Invalid payment method.';
  end if;

  if coalesce(trim(p_payment_details), '') = '' then
    raise exception 'Payment details are required.';
  end if;

  select * into w
  from public.wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Wallet not found.';
  end if;

  if w.coins < p_coins then
    raise exception 'Insufficient coins.';
  end if;

  -- The app currently uses ₹0.0002 as the configured viewer coin value.
  requested_amount := p_coins * 0.0002;

  update public.wallets
  set coins = coins - p_coins,
      updated_at = now()
  where user_id = p_user_id
  returning coins into new_balance;

  insert into public.withdrawals(
    user_id, requested_amount, coins_deducted, payment_method, status, reference_id
  ) values (
    p_user_id,
    requested_amount,
    p_coins,
    p_payment_method,
    'pending',
    null
  ) returning * into result;

  insert into public.wallet_transactions(
    user_id, type, coins, balance_after, description, reference_id
  ) values (
    p_user_id,
    'withdrawal',
    p_coins,
    new_balance,
    'Withdrawal request via ' || p_payment_method,
    result.id
  );

  return result;
end;
$$;

revoke all on function public.request_withdrawal(uuid,numeric,text,text) from public;
grant execute on function public.request_withdrawal(uuid,numeric,text,text) to authenticated;
