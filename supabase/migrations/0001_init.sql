-- Onstage initial schema (plan §4). Tables + indexes + RLS.

-- ---------- updated_at helper ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- tables ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  owner_id uuid not null references public.profiles(id),
  plan text not null default 'free' check (plan in ('free','solo','team')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  seat_count int not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  joined_at timestamptz default now(),
  primary key (team_id, user_id)
);

create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  email text not null,
  role text not null check (role in ('editor','viewer')),
  token text unique not null,
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  app_name text,
  app_icon_url text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.screenshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  position int not null,
  device_frame text not null,
  layout_preset text not null,
  config jsonb not null,
  source_image_url text,
  thumbnail_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.screenshot_versions (
  id uuid primary key default gen_random_uuid(),
  screenshot_id uuid not null references public.screenshots(id) on delete cascade,
  config jsonb not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  url text not null,
  filename text not null,
  size_bytes int not null,
  mime_type text not null,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz default now()
);

create table public.export_history (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  user_id uuid not null references public.profiles(id),
  export_count int not null,
  created_at timestamptz default now()
);

-- ---------- indexes ----------
create index idx_team_members_user on public.team_members(user_id);
create index idx_screenshots_project_position on public.screenshots(project_id, position);
create index idx_export_history_team_created on public.export_history(team_id, created_at);

-- ---------- updated_at triggers ----------
create trigger set_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_teams_updated_at before update on public.teams
  for each row execute function public.set_updated_at();
create trigger set_projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger set_screenshots_updated_at before update on public.screenshots
  for each row execute function public.set_updated_at();

-- ---------- auto-create profile on signup ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- membership helpers (SECURITY DEFINER to avoid RLS recursion) ----------
create or replace function public.is_team_member(_team_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = _team_id and tm.user_id = auth.uid()
  );
$$;

create or replace function public.is_team_editor(_team_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = _team_id and tm.user_id = auth.uid()
      and tm.role in ('owner','editor')
  );
$$;

create or replace function public.is_team_owner(_team_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.teams t
    where t.id = _team_id and t.owner_id = auth.uid()
  );
$$;

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;
alter table public.projects enable row level security;
alter table public.screenshots enable row level security;
alter table public.screenshot_versions enable row level security;
alter table public.assets enable row level security;
alter table public.export_history enable row level security;

-- profiles: any authenticated user can read (for member names); write only own row
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid());

-- teams
create policy teams_select on public.teams for select to authenticated using (public.is_team_member(id));
create policy teams_insert on public.teams for insert to authenticated with check (owner_id = auth.uid());
create policy teams_update on public.teams for update to authenticated using (public.is_team_owner(id));
create policy teams_delete on public.teams for delete to authenticated using (public.is_team_owner(id));

-- team_members
create policy team_members_select on public.team_members for select to authenticated using (public.is_team_member(team_id));
create policy team_members_insert on public.team_members for insert to authenticated with check (public.is_team_owner(team_id));
create policy team_members_delete on public.team_members for delete to authenticated using (public.is_team_owner(team_id));

-- team_invites (acceptance by token happens server-side with the service role)
create policy team_invites_select on public.team_invites for select to authenticated using (public.is_team_member(team_id));
create policy team_invites_insert on public.team_invites for insert to authenticated with check (public.is_team_owner(team_id));
create policy team_invites_delete on public.team_invites for delete to authenticated using (public.is_team_owner(team_id));

-- projects
create policy projects_select on public.projects for select to authenticated using (public.is_team_member(team_id));
create policy projects_insert on public.projects for insert to authenticated with check (public.is_team_editor(team_id) and created_by = auth.uid());
create policy projects_update on public.projects for update to authenticated using (public.is_team_editor(team_id));
create policy projects_delete on public.projects for delete to authenticated using (public.is_team_editor(team_id));

-- screenshots (team resolved via project)
create policy screenshots_select on public.screenshots for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.is_team_member(p.team_id)));
create policy screenshots_write on public.screenshots for all to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.is_team_editor(p.team_id)))
  with check (exists (select 1 from public.projects p where p.id = project_id and public.is_team_editor(p.team_id)));

-- screenshot_versions (read for members, insert for editors)
create policy screenshot_versions_select on public.screenshot_versions for select to authenticated
  using (exists (
    select 1 from public.screenshots s join public.projects p on p.id = s.project_id
    where s.id = screenshot_id and public.is_team_member(p.team_id)
  ));
create policy screenshot_versions_insert on public.screenshot_versions for insert to authenticated
  with check (exists (
    select 1 from public.screenshots s join public.projects p on p.id = s.project_id
    where s.id = screenshot_id and public.is_team_editor(p.team_id)
  ));

-- assets
create policy assets_select on public.assets for select to authenticated using (public.is_team_member(team_id));
create policy assets_write on public.assets for all to authenticated
  using (public.is_team_editor(team_id)) with check (public.is_team_editor(team_id));

-- export_history
create policy export_history_select on public.export_history for select to authenticated using (public.is_team_member(team_id));
create policy export_history_insert on public.export_history for insert to authenticated with check (public.is_team_member(team_id));
