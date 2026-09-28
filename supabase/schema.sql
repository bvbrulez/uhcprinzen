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

create table if not exists public.transaction_categories (
  name text primary key check (char_length(name) between 1 and 60 and name = btrim(name)),
  created_at timestamptz not null default now()
);

insert into public.transaction_categories (name)
select distinct category from public.transactions
on conflict (name) do nothing;

insert into public.transaction_categories (name)
values ('Prinzenkröten'), ('Turnier'), ('Trainer'), ('Ausrüstung'), ('Sixpack'), ('Platzmiete'), ('Sonstiges')
on conflict (name) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_category_fkey'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_category_fkey
      foreign key (category) references public.transaction_categories(name);
  end if;
end;
$$;

alter table public.transaction_categories enable row level security;
grant select, insert, update, delete on public.transaction_categories to authenticated;

create or replace function public.is_finance_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or lower(auth.jwt() ->> 'email') = 'bvbrulez@gmail.com',
    false
  );
$$;
grant execute on function public.is_finance_admin() to authenticated;

drop policy if exists "Members can read transaction categories" on public.transaction_categories;
create policy "Members can read transaction categories"
  on public.transaction_categories for select
  to authenticated
  using (true);

drop policy if exists "Admins can manage transaction categories" on public.transaction_categories;
create policy "Admins can manage transaction categories"
  on public.transaction_categories for all
  to authenticated
  using (public.is_finance_admin())
  with check (public.is_finance_admin());

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

drop function if exists public.get_transaction_analytics(integer, text);

create or replace function public.get_transaction_analytics(
  p_year integer,
  p_account text default null,
  p_type text default null,
  p_search text default null
)
returns jsonb
language sql
stable
security invoker
as $$
  with year_rows as (
    select type, account, description, amount, extract(month from transaction_date)::integer - 1 as month_index, category
    from public.transactions
    where deleted_at is null
      and transaction_date >= make_date(p_year, 1, 1)
      and transaction_date < make_date(p_year + 1, 1, 1)
  ),
  filtered as (
    select * from year_rows
    where (p_account is null or account = p_account)
      and (p_type is null or type = p_type)
      and (
        p_search is null
        or position(lower(p_search) in lower(description)) > 0
        or position(lower(p_search) in lower(category)) > 0
      )
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
    from year_rows
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

do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'transactions'
  loop
    execute format('drop policy %I on public.transactions', policy_name);
  end loop;
end;
$$;

create policy "Members can read transactions"
  on public.transactions for select
  to authenticated
  using (deleted_at is null);

create policy "Admins can add transactions"
  on public.transactions for insert
  to authenticated
  with check (
    deleted_at is null
    and public.is_finance_admin()
  );

create policy "Admins can update transactions"
  on public.transactions for update
  to authenticated
  using (
    deleted_at is null
    and public.is_finance_admin()
  )
  with check (
    public.is_finance_admin()
  );

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

notify pgrst, 'reload schema';
