import Link from "next/link";
import { Building2Icon, TriangleAlertIcon } from "lucide-react";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AcceptInviteButton } from "@/components/team/AcceptInviteButton";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

type InvitePreview = {
  team_id: string;
  team_name: string;
  role: string;
  email: string;
  inviter_name: string;
  expired: boolean;
  accepted: boolean;
};

function Mark() {
  return (
    <span className="grid size-10 place-items-center rounded-[11px] bg-primary/12 text-primary ring-1 ring-primary/25">
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="7" y="2.5" width="10" height="19" rx="3" />
        <line x1="10.5" y1="5" x2="13.5" y2="5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-6">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-2 rounded-3xl border border-border bg-card p-8 shadow-lg shadow-black/5 duration-500">
        <Link href="/" className="inline-flex" aria-label="Onstage home">
          <Mark />
        </Link>
        <div className="mt-5">{children}</div>
      </div>
    </main>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <>
      <span className="mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-border">
        <TriangleAlertIcon className="size-5" />
      </span>
      <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-5")}>
        Go to dashboard
      </Link>
    </>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_team_invite", { _token: token });
  const invite = (Array.isArray(data) ? data[0] : data) as InvitePreview | undefined;
  const user = await getUser();

  if (!invite) {
    return (
      <Shell>
        <Notice title="Invite not found" body="This invite link is invalid or has been revoked. Ask the team owner to send a new one." />
      </Shell>
    );
  }
  if (invite.accepted) {
    return (
      <Shell>
        <Notice title="Invite already used" body={`This invitation to ${invite.team_name} has already been accepted.`} />
      </Shell>
    );
  }
  if (invite.expired) {
    return (
      <Shell>
        <Notice title="Invite expired" body={`This invitation to ${invite.team_name} has expired. Ask the team owner to send a new one.`} />
      </Shell>
    );
  }

  const roleLabel = invite.role === "editor" ? "an editor" : "a viewer";
  const invitedBy = invite.inviter_name?.trim();

  const Header = (
    <>
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Team invitation</span>
      <h1 className="mt-2 flex items-center gap-2 text-2xl font-extrabold tracking-tight">
        <Building2Icon className="size-5 text-primary" />
        {invite.team_name}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {invitedBy ? <strong className="text-foreground">{invitedBy}</strong> : "You've been"} invited you to join{" "}
        <strong className="text-foreground">{invite.team_name}</strong> as {roleLabel}.
      </p>
    </>
  );

  // Logged out → prompt sign-in, returning here afterwards.
  if (!user) {
    const next = encodeURIComponent(`/invite/${token}`);
    return (
      <Shell>
        {Header}
        <div className="mt-6 space-y-2">
          <Link href={`/login?next=${next}`} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
            Sign in to accept
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            Use <strong className="text-foreground">{invite.email}</strong> — the address this invite was sent to.
          </p>
        </div>
      </Shell>
    );
  }

  // Logged in but with a different email than the invite was sent to.
  if ((user.email ?? "").toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <Shell>
        {Header}
        <div className="mt-6 rounded-xl border border-border bg-muted/40 p-3.5 text-sm">
          <p className="text-muted-foreground">
            This invite was sent to <strong className="text-foreground">{invite.email}</strong>, but you&apos;re signed in
            as <strong className="text-foreground">{user.email}</strong>.
          </p>
        </div>
        <form action="/auth/signout" method="post" className="mt-4">
          <button type="submit" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}>
            Sign out and switch account
          </button>
        </form>
      </Shell>
    );
  }

  // Logged in with the matching email → can join.
  return (
    <Shell>
      {Header}
      <div className="mt-6">
        <AcceptInviteButton token={token} />
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Joining as <strong className="text-foreground">{user.email}</strong>
        </p>
      </div>
    </Shell>
  );
}
