import Link from "next/link";
import {
  ArrowLeftIcon,
  Building2Icon,
  ClockIcon,
  CrownIcon,
  EyeIcon,
  LogOutIcon,
  MailIcon,
  PencilIcon,
  Trash2Icon,
  UserIcon,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveActiveTeam, type TeamRole } from "@/lib/workspace";
import { renameTeam, removeMember, revokeInvite, leaveTeam } from "@/app/team-actions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InviteForm } from "@/components/team/InviteForm";
import { MemberRoleSelect } from "@/components/team/MemberRoleSelect";
import { DeleteTeamButton } from "@/components/team/DeleteTeamButton";

type MemberRow = {
  user_id: string;
  role: TeamRole;
  joined_at: string | null;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
};
type InviteRow = { id: string; email: string; role: string; expires_at: string; created_at: string | null };

function initials(s: string) {
  const parts = s.trim().split(/[@\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function fmtDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const ROLE_META: Record<TeamRole, { Icon: typeof CrownIcon; label: string }> = {
  owner: { Icon: CrownIcon, label: "Owner" },
  editor: { Icon: PencilIcon, label: "Editor" },
  viewer: { Icon: EyeIcon, label: "Viewer" },
};

function RoleBadge({ role }: { role: TeamRole }) {
  const { Icon, label } = ROLE_META[role];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      <Icon className="size-3" />
      {label}
    </span>
  );
}

// Member emails live in auth.users (kept out of profiles by RLS), so we resolve
// them here with the service role — a bounded read for a page the caller is
// already authorized to view. Degrades to display-name/“Member” if unavailable.
async function resolveEmails(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || userIds.length === 0) return map;
  try {
    const admin = createAdminClient();
    await Promise.all(
      userIds.map(async (id) => {
        const { data } = await admin.auth.admin.getUserById(id);
        if (data.user?.email) map.set(id, data.user.email);
      }),
    );
  } catch {
    // best effort — fall back to names
  }
  return map;
}

export default async function TeamSettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { teamId, name, role, personal } = await resolveActiveTeam(supabase, user.id);
  const isOwner = role === "owner";

  const { data: memberData } = await supabase
    .from("team_members")
    .select("user_id, role, joined_at, profiles(display_name, avatar_url)")
    .eq("team_id", teamId)
    .order("joined_at");
  const members = (memberData ?? []) as unknown as MemberRow[];
  members.sort((a, b) => {
    const ao = a.role === "owner";
    const bo = b.role === "owner";
    if (ao !== bo) return ao ? -1 : 1;
    return (a.joined_at ?? "").localeCompare(b.joined_at ?? "");
  });

  const emails = await resolveEmails(members.map((m) => m.user_id));

  let invites: InviteRow[] = [];
  if (isOwner) {
    const { data } = await supabase
      .from("team_invites")
      .select("id, email, role, expires_at, created_at")
      .eq("team_id", teamId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });
    invites = (data ?? []) as unknown as InviteRow[];
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10 sm:px-8">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Dashboard
        </Link>
        <ThemeToggle />
      </div>

      {/* header */}
      <header className="mt-5 flex flex-col gap-4 border-b border-border pb-7 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/25">
            {personal ? <UserIcon className="size-5" /> : <Building2Icon className="size-5" />}
          </span>
          <div className="min-w-0">
            <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              {personal ? "Personal workspace" : "Team"}
            </span>
            {isOwner ? (
              <form action={renameTeam} className="group/name relative mt-0.5 flex items-center gap-2">
                <input type="hidden" name="teamId" value={teamId} />
                <input
                  name="name"
                  defaultValue={name}
                  aria-label="Team name"
                  className="-ml-2 w-full max-w-xs rounded-lg border border-transparent bg-transparent px-2 py-0.5 text-2xl font-extrabold tracking-tight outline-none transition-colors hover:bg-muted/60 focus:border-border focus:bg-card sm:text-3xl"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-focus-within/name:opacity-100"
                >
                  Save
                </button>
              </form>
            ) : (
              <h1 className="mt-0.5 truncate text-2xl font-extrabold tracking-tight sm:text-3xl">{name}</h1>
            )}
          </div>
        </div>
        <div className="shrink-0">
          <RoleBadge role={role} />
        </div>
      </header>

      {/* members */}
      <section className="mt-8">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Members · <span className="tabular-nums text-foreground/80">{members.length}</span>
        </h2>
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {members.map((m) => {
            const email = emails.get(m.user_id) ?? null;
            const display = m.profiles?.display_name || email || "Member";
            const isSelf = m.user_id === user.id;
            return (
              <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground ring-1 ring-border">
                  {initials(display)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    {display}
                    {isSelf && <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">You</span>}
                  </p>
                  {email && email !== display && <p className="truncate text-xs text-muted-foreground">{email}</p>}
                </div>
                {isOwner && m.role !== "owner" ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <MemberRoleSelect teamId={teamId} userId={m.user_id} role={m.role as "editor" | "viewer"} />
                    <form action={removeMember}>
                      <input type="hidden" name="teamId" value={teamId} />
                      <input type="hidden" name="userId" value={m.user_id} />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        type="submit"
                        aria-label={`Remove ${display}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2Icon />
                      </Button>
                    </form>
                  </div>
                ) : (
                  <div className="shrink-0">
                    <RoleBadge role={m.role} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* invites (owner only) */}
      {isOwner && (
        <section className="mt-8 rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <MailIcon className="size-3.5" />
            Invite a teammate
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Editors can create and edit screenshots; viewers have read-only access.
          </p>
          <div className="mt-4">
            <InviteForm teamId={teamId} />
          </div>

          {invites.length > 0 && (
            <>
              <h3 className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Pending invites
              </h3>
              <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
                {invites.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-3 px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{inv.email}</p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="capitalize">{inv.role}</span>
                        <span className="text-border">·</span>
                        <ClockIcon className="size-3" />
                        Expires {fmtDate(inv.expires_at)}
                      </p>
                    </div>
                    <form action={revokeInvite}>
                      <input type="hidden" name="inviteId" value={inv.id} />
                      <input type="hidden" name="teamId" value={teamId} />
                      <Button variant="ghost" size="sm" type="submit" className="shrink-0 text-muted-foreground hover:text-destructive">
                        Revoke
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {/* danger zone / membership */}
      <section className="mt-8 rounded-2xl border border-border bg-card p-5">
        {personal ? (
          <p className="text-sm text-muted-foreground">
            This is your personal workspace. It stays with your account and can&apos;t be deleted or left.
          </p>
        ) : isOwner ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Delete this team</p>
              <p className="text-sm text-muted-foreground">Removes the team and all of its projects for everyone.</p>
            </div>
            <DeleteTeamButton teamId={teamId} teamName={name} />
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Leave this team</p>
              <p className="text-sm text-muted-foreground">You&apos;ll lose access until someone invites you again.</p>
            </div>
            <form action={leaveTeam}>
              <input type="hidden" name="teamId" value={teamId} />
              <Button variant="outline" size="sm" type="submit" className="gap-1.5">
                <LogOutIcon className="size-3.5" />
                Leave team
              </Button>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}
