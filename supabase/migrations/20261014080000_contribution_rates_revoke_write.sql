revoke all privileges
  on table public.team_contribution_rates
  from public, anon, authenticated;

grant select on table public.team_contribution_rates to authenticated;
