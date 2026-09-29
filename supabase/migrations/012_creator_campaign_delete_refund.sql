-- Creator campaign cancellation/refund.
-- The campaign is not hard-deleted: it becomes PARTIAL COMPLETED.
-- Only the unused viewer-reward pool is refunded. The 15% platform/internal
-- margin included in creation_cost remains deducted.

drop function if exists public.delete_campaign_and_refund(uuid,uuid);

create or replace function public.delete_campaign_and_refund(
  p_campaign_id uuid,
  p_creator_id uuid
)
returns table(
  campaign_id uuid,
  status text,
  refunded_coins numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.campaigns%rowtype;
  wallet_coins numeric;
  remaining_users numeric;
  refund_coins numeric;
  new_balance numeric;
begin
  if auth.uid() is null or auth.uid() <> p_creator_id then
    raise exception 'Unauthorized';
  end if;

  select * into c
  from public.campaigns
  where id = p_campaign_id
    and creator_id = p_creator_id
  for update;

  if not found then
    raise exception 'Campaign not found';
  end if;

  if c.status not in ('active','paused','pending') then
    raise exception 'This campaign can no longer be deleted';
  end if;

  -- Refund only the unspent viewer reward pool. Example:
  -- target=100, reward/user=5 => viewer pool=500, creation cost=575.
  -- If 10 views were qualified, 450 is refunded and the 75 margin stays spent.
  remaining_users := greatest(0, c.target_views - c.current_views);
  refund_coins := greatest(0, remaining_users * c.coin_reward_per_user);

  select coins into wallet_coins
  from public.wallets
  where user_id = p_creator_id
  for update;

  if wallet_coins is null then
    raise exception 'Wallet not found';
  end if;

  new_balance := wallet_coins + refund_coins;

  update public.wallets
  set coins = new_balance,
      updated_at = now()
  where user_id = p_creator_id;

  update public.campaigns
  set status = 'partial_completed'
  where id = c.id;

  if refund_coins > 0 then
    insert into public.wallet_transactions(
      user_id, type, coins, balance_after, description, reference_id
    ) values (
      p_creator_id,
      'refund',
      refund_coins,
      new_balance,
      'Unused campaign balance refunded: ' || c.title,
      c.id
    );
  end if;

  return query
  select c.id, 'partial_completed'::text, refund_coins;
end;
$$;

revoke all on function public.delete_campaign_and_refund(uuid,uuid) from public;
grant execute on function public.delete_campaign_and_refund(uuid,uuid) to authenticated;
