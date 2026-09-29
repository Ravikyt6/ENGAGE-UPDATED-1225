-- ENGAGE: Admin withdrawal dashboard + status control
-- Uses the existing public.withdrawals ledger created by 004_admin_user_360.sql.
-- No new wallet calculation rules are introduced here.

create or replace function public.admin_list_withdrawals(
  p_page integer default 1,
  p_page_size integer default 25,
  p_status text default '',
  p_search text default '',
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns table(
  id uuid,
  user_id uuid,
  user_name text,
  user_email text,
  requested_at timestamptz,
  requested_amount numeric,
  coins_deducted numeric,
  payment_method text,
  status text,
  reference_id text,
  completed_at timestamptz,
  total_count bigint
)
language plpgsql security definer set search_path=public as $$
declare
  off integer := greatest(coalesce(p_page,1)-1,0)*least(greatest(coalesce(p_page_size,25),1),100);
  lim integer := least(greatest(coalesce(p_page_size,25),1),100);
  q text := lower(trim(coalesce(p_search,'')));
begin
  if not public.is_admin() then raise exception 'Unauthorized'; end if;

  return query
  select
    w.id,
    w.user_id,
    coalesce(p.name,'')::text,
    coalesce(p.email,'')::text,
    w.requested_at,
    w.requested_amount,
    w.coins_deducted,
    w.payment_method,
    w.status,
    w.reference_id,
    w.completed_at,
    count(*) over()::bigint
  from public.withdrawals w
  left join public.profiles p on p.id=w.user_id
  where (coalesce(p_status,'')='' or w.status=p_status)
    and (q='' or lower(coalesce(p.name,'')||' '||coalesce(p.email,'')||' '||w.id::text) like '%'||q||'%')
    and (p_date_from is null or w.requested_at>=p_date_from)
    and (p_date_to is null or w.requested_at<=p_date_to)
  order by
    case when w.status='pending' then 0 when w.status='processing' then 1 else 2 end,
    w.requested_at desc
  offset off limit lim;
end;
$$;

revoke all on function public.admin_list_withdrawals(integer,integer,text,text,timestamptz,timestamptz) from public;
grant execute on function public.admin_list_withdrawals(integer,integer,text,text,timestamptz,timestamptz) to authenticated;

create or replace function public.admin_withdrawal_summary()
returns table(
  total_count bigint,
  pending_count bigint,
  processing_count bigint,
  completed_count bigint,
  rejected_count bigint,
  failed_count bigint,
  pending_coins numeric,
  completed_coins numeric,
  completed_amount numeric
)
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Unauthorized'; end if;
  return query
  select
    count(*)::bigint,
    count(*) filter(where status='pending')::bigint,
    count(*) filter(where status='processing')::bigint,
    count(*) filter(where status='completed')::bigint,
    count(*) filter(where status='rejected')::bigint,
    count(*) filter(where status='failed')::bigint,
    coalesce(sum(coins_deducted) filter(where status in ('pending','processing')),0),
    coalesce(sum(coins_deducted) filter(where status='completed'),0),
    coalesce(sum(requested_amount) filter(where status='completed'),0)
  from public.withdrawals;
end;
$$;

revoke all on function public.admin_withdrawal_summary() from public;
grant execute on function public.admin_withdrawal_summary() to authenticated;

create or replace function public.admin_update_withdrawal(
  p_withdrawal_id uuid,
  p_status text,
  p_reference_id text default null
)
returns public.withdrawals
language plpgsql security definer set search_path=public as $$
declare
  current_row public.withdrawals%rowtype;
  result public.withdrawals%rowtype;
  new_balance numeric;
  refund_needed boolean := false;
  normalized_reference text := nullif(trim(coalesce(p_reference_id,'')),'');
begin
  if not public.is_admin() then raise exception 'Unauthorized'; end if;
  if p_status not in ('pending','processing','completed','rejected','failed') then
    raise exception 'Invalid withdrawal status.';
  end if;

  select * into current_row
  from public.withdrawals
  where id=p_withdrawal_id
  for update;

  if not found then raise exception 'Withdrawal not found.'; end if;

  -- Completed withdrawals are final. Rejected/failed withdrawals are also final.
  if current_row.status in ('completed','rejected','failed') and p_status <> current_row.status then
    raise exception 'Finalized withdrawal status cannot be changed.';
  end if;

  -- Once a request has been rejected/failed, its coins have already been returned.
  if current_row.status in ('pending','processing') and p_status in ('rejected','failed') then
    refund_needed := true;
  end if;

  if current_row.status='completed' and p_status='completed' then
    update public.withdrawals
    set reference_id=coalesce(normalized_reference, reference_id)
    where id=p_withdrawal_id
    returning * into result;
    return result;
  end if;

  if refund_needed then
    update public.wallets
    set coins=coins+current_row.coins_deducted,
        updated_at=now()
    where user_id=current_row.user_id
    returning coins into new_balance;

    if new_balance is null then raise exception 'Wallet not found for refund.'; end if;

    insert into public.wallet_transactions(
      user_id,type,coins,balance_after,description,reference_id
    ) values (
      current_row.user_id,
      'refund',
      current_row.coins_deducted,
      new_balance,
      'Withdrawal '||p_status||' refund',
      current_row.id
    );
  end if;

  update public.withdrawals
  set status=p_status,
      reference_id=coalesce(normalized_reference, reference_id),
      completed_at=case when p_status='completed' then coalesce(completed_at,now()) else completed_at end
  where id=p_withdrawal_id
  returning * into result;

  return result;
end;
$$;

revoke all on function public.admin_update_withdrawal(uuid,text,text) from public;
grant execute on function public.admin_update_withdrawal(uuid,text,text) to authenticated;
