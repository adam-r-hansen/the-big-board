-- Picks owner-only CRUD
alter table public.picks enable row level security;

drop policy if exists "picks_select_own" on public.picks;
create policy "picks_select_own" on public.picks
for select using (profile_id = auth.uid());

drop policy if exists "picks_insert_own" on public.picks;
create policy "picks_insert_own" on public.picks
for insert with check (profile_id = auth.uid());

drop policy if exists "picks_delete_own" on public.picks;
create policy "picks_delete_own" on public.picks
for delete using (profile_id = auth.uid());

-- League membership reads/inserts for auto-join
alter table public.league_members enable row level security;

drop policy if exists "lm_select_self" on public.league_members;
create policy "lm_select_self" on public.league_members
for select using (profile_id = auth.uid());

drop policy if exists "lm_insert_self" on public.league_members;
create policy "lm_insert_self" on public.league_members
for insert with check (profile_id = auth.uid());

-- Allow reads for games/teams (skip if RLS disabled there)
drop policy if exists "games_read_all" on public.games;
create policy "games_read_all" on public.games for select using (true);

drop policy if exists "teams_read_all" on public.teams;
create policy "teams_read_all" on public.teams for select using (true);

-- Helpful index
create index if not exists idx_picks_owner_week
on public.picks(profile_id, league_id, season, week);
