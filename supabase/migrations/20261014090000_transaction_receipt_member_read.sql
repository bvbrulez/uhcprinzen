do $migration$
begin
  if to_regclass('public.transactions') is null
    or to_regclass('storage.objects') is null
    or not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'transactions'
        and column_name in ('receipt_path', 'deleted_at')
      group by table_schema, table_name
      having count(*) = 2
    )
  then
    return;
  end if;

  execute 'drop policy if exists "Members can read active transaction receipts" on storage.objects';
  execute $policy$
    create policy "Members can read active transaction receipts"
      on storage.objects for select
      to authenticated
      using (
        bucket_id = 'transaction-receipts'
        and exists (
          select 1
          from public.transactions
          where transactions.receipt_path = storage.objects.name
            and transactions.deleted_at is null
        )
      )
  $policy$;
end;
$migration$;
