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
