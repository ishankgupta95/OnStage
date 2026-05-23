-- Onstage Phase 4 — multi-team collaboration: personal-workspace flag,
-- member role management + self-leave, and SECURITY DEFINER invite RPCs.
-- (0001 is never edited; all changes land here.)

-- ---------- personal-workspace flag ----------
-- Distinguishes the auto-provisioned personal workspace from teams the user
-- creates. Used to label "Personal" in the switcher and to block leaving or
-- deleting it. Pre-launch with zero real teams, every existing team IS a
-- personal workspace, so the backfill is unconditional.
alter table public.teams add column personal boolean not null default false;
update public.teams set personal = true;

-- ---------- team_members: owners change roles, members can leave ----------
-- Owners may update another member's role (editor <-> viewer). They cannot
-- touch their own row, and cannot promote anyone to 'owner' — ownership
-- transfer is out of scope, so the new role is constrained to editor/viewer.
create policy team_members_update on public.team_members
  for update to authenticated
  using (public.is_team_owner(team_id) and user_id <> auth.uid())
  with check (
    public.is_team_owner(team_id)
    and user_id <> auth.uid()
    and role in ('editor', 'viewer')
  );

-- Replace the owner-only delete policy: an owner can remove other members, and
-- any non-owner can remove THEIR OWN membership (leave a team). The owner
-- cannot delete their own membership row — they must delete the whole team —
-- which prevents a team being orphaned with no owner.
drop policy team_members_delete on public.team_members;
create policy team_members_delete on public.team_members
  for delete to authenticated
  using (
    (public.is_team_owner(team_id) and user_id <> auth.uid())
    or (user_id = auth.uid() and not public.is_team_owner(team_id))
  );

-- ---------- invite preview (token bearer) ----------
-- Returns just enough to render the accept page for whoever holds the token,
-- including logged-out visitors (so they can be prompted to sign in). Runs as
-- definer to bypass RLS; exposure is gated by possession of the high-entropy
-- token, which is delivered only to the invited email. No token is returned.
create or replace function public.get_team_invite(_token text)
returns table (
  team_id uuid,
  team_name text,
  role text,
  email text,
  inviter_name text,
  expired boolean,
  accepted boolean
)
language sql security definer set search_path = public stable as $$
  select
    i.team_id,
    t.name as team_name,
    i.role,
    i.email,
    coalesce(p.display_name, '') as inviter_name,
    (i.expires_at < now()) as expired,
    (i.accepted_at is not null) as accepted
  from public.team_invites i
  join public.teams t on t.id = i.team_id
  left join public.profiles p on p.id = i.invited_by
  where i.token = _token;
$$;

revoke all on function public.get_team_invite(text) from public;
grant execute on function public.get_team_invite(text) to anon, authenticated;

-- ---------- invite acceptance ----------
-- The RLS gotcha: team_members_insert requires is_team_owner, so an invitee
-- cannot insert their own membership row. This definer function performs that
-- privileged insert after validating the token server-side: it must exist, be
-- unexpired, unaccepted, and the caller's auth email must match the invited
-- email (case-insensitive). Insert is idempotent (re-accept is a no-op) and the
-- invite is stamped accepted. Returns the joined team id.
create or replace function public.accept_team_invite(_token text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _invite public.team_invites;
  _uid uuid := auth.uid();
  _email text;
begin
  if _uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into _invite from public.team_invites where token = _token;
  if not found then
    raise exception 'invite_not_found';
  end if;
  if _invite.accepted_at is not null then
    raise exception 'invite_already_accepted';
  end if;
  if _invite.expires_at < now() then
    raise exception 'invite_expired';
  end if;

  select email into _email from auth.users where id = _uid;
  if _email is null or lower(_email) <> lower(_invite.email) then
    raise exception 'invite_email_mismatch';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (_invite.team_id, _uid, _invite.role)
  on conflict (team_id, user_id) do nothing;

  update public.team_invites set accepted_at = now() where id = _invite.id;

  return _invite.team_id;
end;
$$;

revoke all on function public.accept_team_invite(text) from public;
grant execute on function public.accept_team_invite(text) to authenticated;
