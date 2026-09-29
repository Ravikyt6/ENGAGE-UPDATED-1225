-- Campaign cancellation keeps the campaign as PARTIAL COMPLETED for history,
-- refunds only the unused viewer-reward pool, and removes its promoted content
-- so the deleted campaign content no longer appears in viewer feeds.

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
  content_to_remove uuid;
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

  remaining_users := greatest(0, c.target_views - c.current_views);
  refund_coins := greatest(0, remaining_users * c.coin_reward_per_user);
  content_to_remove := c.content_id;

  select coins into wallet_coins
  from public.wallets
  where user_id = p_creator_id
  for update;

  if wallet_coins is null then
    raise exception 'Wallet not found';
  end if;

  new_balance := wallet_coins + refund_coins;

  update public.wallets
  set coins = new_balance, updated_at = now()
  where user_id = p_creator_id;

  update public.campaigns
  set status = 'partial_completed', content_id = null
  where id = c.id;

  if refund_coins > 0 then
    insert into public.wallet_transactions(
      user_id, type, coins, balance_after, description, reference_id
    ) values (
      p_creator_id, 'refund', refund_coins, new_balance,
      'Unused campaign balance refunded: ' || c.title, c.id
    );
  end if;

  if content_to_remove is not null
     and not exists (
       select 1 from public.campaigns
       where content_id = content_to_remove
     ) then
    delete from public.contents where id = content_to_remove;
  end if;

  return query select c.id, 'partial_completed'::text, refund_coins;
end;
$$;

revoke all on function public.delete_campaign_and_refund(uuid,uuid) from public;
grant execute on function public.delete_campaign_and_refund(uuid,uuid) to authenticated;
