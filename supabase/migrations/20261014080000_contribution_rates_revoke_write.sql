do $migration$
begin
  if to_regclass('public.team_contribution_rates') is null then
    raise notice 'Skipping contribution-rate privileges: public.team_contribution_rates does not exist yet.';
    return;
  end if;

  execute 'revoke all privileges on table public.team_contribution_rates from public, anon, authenticated';
  execute 'grant select on table public.team_contribution_rates to authenticated';
end;
$migration$;
