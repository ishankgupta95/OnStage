import type { SupabaseClient } from "@supabase/supabase-js";

// Ensures the user has a personal team (workspace). Returns the team id.
// All inserts run as the user (RLS): teams_insert requires owner_id = auth.uid();
// team_members_insert then passes because the user now owns that team.
export async function ensureWorkspace(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId)
    .limit(1);

  if (memberships && memberships.length > 0) {
    return memberships[0].team_id as string;
  }

  // Generate the id client-side and insert WITHOUT RETURNING: teams_select requires
  // membership, which doesn't exist yet, so a .select() right after insert would be
  // filtered out and fail. (Verified against live RLS.)
  const teamId = globalThis.crypto.randomUUID();
  const slug = `u-${userId.slice(0, 8)}-${Date.now().toString(36)}`;
  const { error } = await supabase
    .from("teams")
    .insert({ id: teamId, name: "Personal", slug, owner_id: userId, plan: "free" });
  if (error) throw new Error(error.message);

  const { error: memberError } = await supabase
    .from("team_members")
    .insert({ team_id: teamId, user_id: userId, role: "owner" });
  if (memberError) throw new Error(memberError.message);

  return teamId;
}
