import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Cookie that holds the active workspace (team) id. Read in RSC/actions to scope
// the dashboard + new-project creation; written only by the setActiveTeam action.
// Deep routes (/project/[id], the editor) are addressed by UUID and scoped by
// RLS, so they need no workspace context — only the dashboard list does.
export const ACTIVE_TEAM_COOKIE = "onstage_active_team";

export type TeamRole = "owner" | "editor" | "viewer";

export type Workspace = {
  teamId: string;
  name: string;
  slug: string;
  role: TeamRole;
  personal: boolean;
};

export type ActiveWorkspace = {
  teamId: string;
  name: string;
  role: TeamRole;
  personal: boolean;
};

const RANK: Record<TeamRole, number> = { viewer: 0, editor: 1, owner: 2 };

export function roleAtLeast(role: TeamRole | null | undefined, min: TeamRole): boolean {
  return role != null && RANK[role] >= RANK[min];
}

// Editor+ may mutate projects/screenshots; viewers are read-only.
export function canEdit(role: TeamRole | null | undefined): boolean {
  return roleAtLeast(role, "editor");
}

// Only the owner manages the team itself (settings, members, invites, billing).
export function canManageTeam(role: TeamRole | null | undefined): boolean {
  return role === "owner";
}

// Ensures the user has a PERSONAL workspace (a team flagged personal=true that
// they own) and returns its id. Robust to the invite-first case: a brand-new
// user who joins a team before ever opening the dashboard still gets a personal
// workspace provisioned here rather than having their joined team mistaken for
// one. Inserts run as the user under RLS (teams_insert: owner_id = auth.uid();
// team_members_insert then passes because the user now owns that team).
export async function ensureWorkspace(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("teams")
    .select("id")
    .eq("owner_id", userId)
    .eq("personal", true)
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0].id as string;
  }

  // Generate the id client-side and insert WITHOUT RETURNING: teams_select
  // requires membership, which doesn't exist yet, so a .select() right after
  // insert would be filtered out and fail. (Verified against live RLS.)
  const teamId = globalThis.crypto.randomUUID();
  const slug = `u-${userId.slice(0, 8)}-${Date.now().toString(36)}`;
  const { error } = await supabase
    .from("teams")
    .insert({ id: teamId, name: "Personal", slug, owner_id: userId, plan: "free", personal: true });
  if (error) throw new Error(error.message);

  const { error: memberError } = await supabase
    .from("team_members")
    .insert({ team_id: teamId, user_id: userId, role: "owner" });
  if (memberError) throw new Error(memberError.message);

  return teamId;
}

type MembershipRow = {
  role: TeamRole;
  teams: { id: string; name: string; slug: string; personal: boolean } | null;
};

// Every workspace the user belongs to, personal first then alphabetical.
export async function getWorkspaces(supabase: SupabaseClient, userId: string): Promise<Workspace[]> {
  const { data } = await supabase
    .from("team_members")
    .select("role, teams!inner(id, name, slug, personal)")
    .eq("user_id", userId);

  const rows = (data ?? []) as unknown as MembershipRow[];
  return rows
    .filter((r): r is MembershipRow & { teams: NonNullable<MembershipRow["teams"]> } => r.teams != null)
    .map((r) => ({
      teamId: r.teams.id,
      name: r.teams.name,
      slug: r.teams.slug,
      role: r.role,
      personal: r.teams.personal,
    }))
    .sort((a, b) => {
      if (a.personal !== b.personal) return a.personal ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

// Resolves the active workspace for reads/scoping. Reads the active_team cookie
// and RE-VALIDATES membership every time (a stale or forged cookie can never
// grant access — and RLS is the real backstop). Falls back to the personal
// workspace when the cookie is missing or no longer valid.
export async function resolveActiveTeam(supabase: SupabaseClient, userId: string): Promise<ActiveWorkspace> {
  const cookieStore = await cookies();
  const cookieTeam = cookieStore.get(ACTIVE_TEAM_COOKIE)?.value;

  if (cookieTeam) {
    const { data } = await supabase
      .from("team_members")
      .select("role, teams!inner(id, name, personal)")
      .eq("user_id", userId)
      .eq("team_id", cookieTeam)
      .maybeSingle();
    const row = data as unknown as MembershipRow | null;
    if (row?.teams) {
      return { teamId: row.teams.id, name: row.teams.name, role: row.role, personal: row.teams.personal };
    }
  }

  const teamId = await ensureWorkspace(supabase, userId);
  const { data: team } = await supabase.from("teams").select("name, personal").eq("id", teamId).maybeSingle();
  return {
    teamId,
    name: (team?.name as string) ?? "Personal",
    role: "owner",
    personal: (team?.personal as boolean) ?? true,
  };
}

// The caller's role on a team (null if not a member). Used to gate server
// actions and UI; the DB enforces the same via RLS.
export async function getTeamRole(
  supabase: SupabaseClient,
  teamId: string,
  userId: string,
): Promise<TeamRole | null> {
  const { data } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.role as TeamRole | undefined) ?? null;
}

// The team a project belongs to (for resolving role on screenshot/project
// mutations that are addressed by id, not workspace).
export async function getProjectTeam(supabase: SupabaseClient, projectId: string): Promise<string | null> {
  const { data } = await supabase.from("projects").select("team_id").eq("id", projectId).maybeSingle();
  return (data?.team_id as string | undefined) ?? null;
}
