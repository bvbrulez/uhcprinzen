begin;

create extension if not exists pgtap;
select plan(14);

insert into public.transaction_categories (name)
values ('Test contribution rules')
on conflict (name) do nothing;

insert into public.team_members (name)
values ('Test contribution rules')
returning id \gset test_

insert into public.transactions
  (type, account, description, amount, transaction_date, category)
values
  ('INCOME', 'BANK', 'Test contribution across rate change', 165.00, date '2027-04-01', 'Test contribution rules')
returning id \gset valid_

insert into public.transactions
  (type, account, description, amount, transaction_date, category)
values
  ('INCOME', 'BANK', 'Test contribution wrong amount', 75.00, date '2027-04-02', 'Test contribution rules')
returning id \gset wrong_

insert into public.transactions
  (type, account, description, amount, transaction_date, category)
values
  ('INCOME', 'BANK', 'Test contribution duplicate quarter', 80.00, date '2027-04-03', 'Test contribution rules')
returning id \gset duplicate_

select set_config(
  'request.jwt.claims',
  '{"email":"bvbrulez@gmail.com","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.set_team_contribution_rate(date '2026-10-01', 75.00)$$,
  'Admin can create the initial contribution rate'
);

select lives_ok(
  $$select public.set_team_contribution_rate(date '2027-04-01', 90.00)$$,
  'Admin can schedule a new rate from a quarter'
);

select lives_ok(
  format(
    $$select public.record_team_contribution_payment(%s, %s, array[date '2027-01-01', date '2027-04-01'])$$,
    :'test_id',
    :'valid_id'
  ),
  'Payment spanning two rates is accepted at the exact combined amount'
);

select is(
  (select sum(quarterly_amount) from public.team_contribution_payment_quarters where member_id = :'test_id'),
  165.00::numeric,
  'Quarter snapshots sum to the validated payment'
);

select is(
  (select quarterly_amount from public.team_contribution_payment_quarters where member_id = :'test_id' and quarter_start = date '2027-01-01'),
  75.00::numeric,
  'First quarter snapshots its effective rate'
);

select is(
  (select quarterly_amount from public.team_contribution_payment_quarters where member_id = :'test_id' and quarter_start = date '2027-04-01'),
  90.00::numeric,
  'Second quarter snapshots its effective rate'
);

select lives_ok(
  $$select public.set_team_contribution_rate(date '2027-01-01', 80.00)$$,
  'Admin can revise a rate entry'
);

select is(
  (select quarterly_amount from public.team_contribution_payment_quarters where member_id = :'test_id' and quarter_start = date '2027-01-01'),
  75.00::numeric,
  'Changing a historical rate does not rewrite existing payment snapshots'
);

select throws_ok(
  format(
    $$select public.record_team_contribution_payment(%s, %s, array[date '2027-04-01'])$$,
    :'test_id',
    :'wrong_id'
  ),
  'P0001',
  'Der Buchungsbetrag muss der Summe der für die ausgewählten Quartale gültigen Beitragssätze entsprechen.',
  'Payment with an incorrect amount is rejected'
);

select throws_ok(
  format(
    $$select public.record_team_contribution_payment(%s, %s, array[date '2027-01-01'])$$,
    :'test_id',
    :'duplicate_id'
  ),
  'P0001',
  'Mindestens eines dieser Quartale ist für das Mitglied bereits als bezahlt erfasst.',
  'A member cannot be assigned the same quarter twice'
);

select set_config(
  'request.jwt.claims',
  '{"email":"member@example.test","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.set_team_contribution_rate(date '2027-07-01', 95.00)$$,
  'P0001',
  'Nur Administratoren dürfen Beitragssätze ändern.',
  'Non-admin cannot change contribution rates'
);

select ok(
  not has_table_privilege('authenticated', 'public.team_contribution_rates', 'INSERT')
  and not has_table_privilege('authenticated', 'public.team_contribution_rates', 'UPDATE'),
  'Authenticated clients cannot write directly to the contribution-rate table'
);

select throws_ok(
  $$insert into public.recurring_transactions
    (type, account, description, amount, category, day_of_month, next_date, active)
    values ('INCOME', 'BANK', 'Before finance cutoff', 1.00, 'Test contribution rules', 30, date '2026-09-30', true)$$,
  '23514',
  null,
  'Active recurring schedules before the finance cutoff are rejected'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Members can read active transaction receipts'
      and cmd = 'SELECT'
      and qual like '%transaction-receipts%'
      and qual like '%receipt_path%'
      and qual like '%deleted_at%'
  ),
  'Members can read only receipts linked to active transactions'
);

select * from finish();
rollback;
