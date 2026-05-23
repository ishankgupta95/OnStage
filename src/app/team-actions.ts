"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { ACTIVE_TEAM_COOKIE, getTeamRole } from "@/lib/workspace";
import { sendInviteEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_TTL_DAYS = 7;

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "team";
}

function randSuffix(): string {
  return globalThis.crypto.randomUUID().slice(0, 6);
}

function inviteToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

function setActiveCookie(cookieStore: Awaited<ReturnType<typeof cookies>>, teamId: string) {
  cookieStore.set(ACTIVE_TEAM_COOKIE, teamId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
}

function clearActiveCookie(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  cookieStore.set(ACTIVE_TEAM_COOKIE, "", { path: "/", maxAge: 0 });
}

// ---------- active workspace ----------

// Switch the active workspace. Validates membership before trusting the id, so
// the cookie can never be set to a team the caller isn't in.
export async function setActiveTeam(teamId: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const supabase = await createClient();
  const role = await getTeamRole(supabase, teamId, user.id);
  if (!role) return { ok: false };
  const cookieStore = await cookies();
  setActiveCookie(cookieStore, teamId);
  revalidatePath("/dashboard");
  revalidatePath("/settings/team");
  return { ok: true };
}

// ---------- team lifecycle ----------

export async function createTeam(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const name = ((formData.get("name") as string) || "").trim() || "New team";

  const teamId = globalThis.crypto.randomUUID();
  const slug = `${slugify(name)}-${randSuffix()}`;
  const { error } = await supabase
    .from("teams")
    .insert({ id: teamId, name, slug, owner_id: user.id, plan: "free", personal: false });
  if (error) throw new Error(error.message);

  const { error: memberError } = await supabase
    .from("team_members")
    .insert({ team_id: teamId, user_id: user.id, role: "owner" });
  if (memberError) throw new Error(memberError.message);

  const cookieStore = await cookies();
  setActiveCookie(cookieStore, teamId);
  revalidatePath("/dashboard");
  // Land in settings so the next natural step — inviting teammates — is right there.
  redirect("/settings/team");
}

export async function renameTeam(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const teamId = formData.get("teamId") as string;
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return;
  if ((await getTeamRole(supabase, teamId, user.id)) !== "owner") {
    throw new Error("Only the owner can rename this team.");
  }
  await supabase.from("teams").update({ name }).eq("id", teamId);
  revalidatePath("/settings/team");
  revalidatePath("/dashboard");
}

export async function deleteTeam(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const teamId = formData.get("teamId") as string;

  const { data: team } = await supabase.from("teams").select("personal, owner_id").eq("id", teamId).maybeSingle();
  if (!team) return;
  if (team.owner_id !== user.id) throw new Error("Only the owner can delete this team.");
  if (team.personal) throw new Error("Your personal workspace can't be deleted.");

  // Cascades to members, invites, projects, and screenshots (FK on delete cascade).
  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) throw new Error(error.message);

  const cookieStore = await cookies();
  clearActiveCookie(cookieStore);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// ---------- membership ----------

export async function leaveTeam(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const teamId = formData.get("teamId") as string;

  const role = await getTeamRole(supabase, teamId, user.id);
  if (!role) return;
  if (role === "owner") {
    throw new Error("Owners can't leave — transfer ownership or delete the team instead.");
  }
  const { error } = await supabase.from("team_members").delete().eq("team_id", teamId).eq("user_id", user.id);
  if (error) throw new Error(error.message);

  const cookieStore = await cookies();
  clearActiveCookie(cookieStore);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function removeMember(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const teamId = formData.get("teamId") as string;
  const targetUserId = formData.get("userId") as string;
  if ((await getTeamRole(supabase, teamId, user.id)) !== "owner") {
    throw new Error("Only the owner can remove members.");
  }
  await supabase.from("team_members").delete().eq("team_id", teamId).eq("user_id", targetUserId);
  revalidatePath("/settings/team");
}

export async function changeMemberRole(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const teamId = formData.get("teamId") as string;
  const targetUserId = formData.get("userId") as string;
  const role = formData.get("role") as string;
  if (role !== "editor" && role !== "viewer") throw new Error("Invalid role.");
  if ((await getTeamRole(supabase, teamId, user.id)) !== "owner") {
    throw new Error("Only the owner can change roles.");
  }
  await supabase.from("team_members").update({ role }).eq("team_id", teamId).eq("user_id", targetUserId);
  revalidatePath("/settings/team");
}

// ---------- invites ----------

export type InviteResult =
  | { ok: true; link: string; emailSent: boolean; email: string }
  | { ok: false; error: string };

export async function inviteMember(formData: FormData): Promise<InviteResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const teamId = formData.get("teamId") as string;
  const email = ((formData.get("email") as string) || "").trim().toLowerCase();
  const role = (formData.get("role") as string) === "editor" ? "editor" : "viewer";

  if ((await getTeamRole(supabase, teamId, user.id)) !== "owner") {
    return { ok: false, error: "Only the owner can invite members." };
  }
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (email === (user.email ?? "").toLowerCase()) {
    return { ok: false, error: "You're already on this team." };
  }

  // Replace any prior un-accepted invite for the same address so links don't pile up.
  await supabase
    .from("team_invites")
    .delete()
    .eq("team_id", teamId)
    .eq("email", email)
    .is("accepted_at", null);

  const token = inviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("team_invites").insert({
    team_id: teamId,
    email,
    role,
    token,
    invited_by: user.id,
    expires_at: expiresAt,
  });
  if (error) return { ok: false, error: error.message };

  const { data: team } = await supabase.from("teams").select("name").eq("id", teamId).maybeSingle();
  const link = `${appUrl()}/invite/${token}`;
  const { sent } = await sendInviteEmail({
    to: email,
    teamName: (team?.name as string) ?? "a team",
    inviterEmail: user.email ?? "",
    role,
    link,
  });

  revalidatePath("/settings/team");
  return { ok: true, link, emailSent: sent, email };
}

export async function revokeInvite(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const inviteId = formData.get("inviteId") as string;
  const teamId = formData.get("teamId") as string;
  if ((await getTeamRole(supabase, teamId, user.id)) !== "owner") {
    throw new Error("Only the owner can revoke invites.");
  }
  await supabase.from("team_invites").delete().eq("id", inviteId);
  revalidatePath("/settings/team");
}

// ---------- accept ----------

const ACCEPT_ERRORS: Record<string, string> = {
  invite_not_found: "This invite link is invalid.",
  invite_expired: "This invite has expired. Ask the team owner to send a new one.",
  invite_already_accepted: "This invite has already been used.",
  invite_email_mismatch: "This invite was sent to a different email address than the one you're signed in with.",
  not_authenticated: "Please sign in to accept this invite.",
};

// Joins the caller to the invited team via the SECURITY DEFINER RPC (an invitee
// can't insert their own membership under RLS). On success, sets the joined team
// active and sends the user to their dashboard.
export async function acceptInvite(token: string): Promise<{ ok: false; error: string }> {
  // Ensures a session exists (redirects to /login otherwise); the RPC reads the
  // caller from auth.uid(), so we don't pass any identity in.
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("accept_team_invite", { _token: token });
  if (error) {
    const key = Object.keys(ACCEPT_ERRORS).find((k) => error.message.includes(k));
    return { ok: false, error: key ? ACCEPT_ERRORS[key] : "Couldn't accept this invite. Please try again." };
  }

  const cookieStore = await cookies();
  setActiveCookie(cookieStore, data as string);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
