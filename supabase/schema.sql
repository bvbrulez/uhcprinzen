-- Delta migration for an existing public.transactions table.
-- Run this script after the original base table was created.

alter table public.transactions
  add column if not exists account text not null default 'BANK';

alter table public.transactions
  drop constraint if exists transactions_account_check;

alter table public.transactions
  add constraint transactions_account_check
  check (account in ('BANK', 'PAYPAL'));

alter table public.transactions
  add column if not exists updated_at timestamptz not null default now();

alter table public.transactions
  add column if not exists updated_by uuid references auth.users(id);

alter table public.transactions
  add column if not exists deleted_at timestamptz;

alter table public.transactions
  add column if not exists deleted_by uuid references auth.users(id);

create index if not exists transactions_active_date_idx
  on public.transactions (transaction_date desc)
  where deleted_at is null;

create or replace function public.get_transaction_years()
returns table(year text)
language sql
stable
security invoker
as $$
  select distinct extract(year from transaction_date)::text
  from public.transactions
  where deleted_at is null
  order by 1 desc;
$$;

create or replace function public.get_transaction_analytics(p_year integer, p_account text default null)
returns jsonb
language sql
stable
security invoker
as $$
  with filtered as (
    select type, account, amount, extract(month from transaction_date)::integer - 1 as month_index, category
    from public.transactions
    where deleted_at is null
      and transaction_date >= make_date(p_year, 1, 1)
      and transaction_date < make_date(p_year + 1, 1, 1)
      and (p_account is null or account = p_account)
  ),
  totals as (
    select
      coalesce(sum(amount) filter (where type = 'INCOME'), 0) as income,
      coalesce(sum(amount) filter (where type = 'EXPENSE'), 0) as expenses
    from filtered
  ),
  accounts as (
    select account,
      coalesce(sum(case when type = 'INCOME' then amount else -amount end), 0) as balance
    from filtered
    group by account
  ),
  months as (
    select month_index,
      coalesce(sum(amount) filter (where type = 'INCOME'), 0) as income,
      coalesce(sum(amount) filter (where type = 'EXPENSE'), 0) as expenses
    from filtered
    group by month_index
  ),
  categories as (
    select category, coalesce(sum(amount), 0) as amount
    from filtered
    where type = 'EXPENSE'
    group by category
    order by amount desc
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'income', (select income from totals),
      'expenses', (select expenses from totals)
    ),
    'accounts', coalesce((select jsonb_object_agg(account, balance) from accounts), '{}'::jsonb),
    'months', coalesce((select jsonb_agg(jsonb_build_object('month', month_index, 'income', income, 'expenses', expenses) order by month_index) from months), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(jsonb_build_array(category, amount)) from categories), '[]'::jsonb)
  );
$$;

alter table public.transactions enable row level security;

drop policy if exists "Members can read transactions" on public.transactions;
create policy "Members can read transactions"
  on public.transactions for select
  to authenticated
  using (deleted_at is null);

drop policy if exists "Members can add transactions" on public.transactions;
create policy "Members can add transactions"
  on public.transactions for insert
  to authenticated
  with check (deleted_at is null);

drop policy if exists "Members can update transactions" on public.transactions;
create policy "Members can update transactions"
  on public.transactions for update
  to authenticated
  using (deleted_at is null)
  with check (true);

drop policy if exists "Members can delete transactions" on public.transactions;

create or replace function public.set_transaction_audit_fields()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  if new.deleted_at is not null and old.deleted_at is null then
    new.deleted_by = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_audit on public.transactions;
create trigger transactions_audit
before update on public.transactions
for each row execute function public.set_transaction_audit_fields();
