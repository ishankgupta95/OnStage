import Link from "next/link";
import { Trash2Icon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ensureWorkspace } from "@/lib/workspace";
import { createProject, deleteProject } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const teamId = await ensureWorkspace(supabase, user.id);
  const { data: projects } = await supabase
    .from("projects")
    .select("id,name,updated_at")
    .eq("team_id", teamId)
    .order("updated_at", { ascending: false });

  const list = projects ?? [];

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <header className="mb-12 flex items-center justify-between">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Workspace</span>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight">Onstage</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <Button variant="outline" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="text-sm font-semibold tracking-tight">
          Projects <span className="text-muted-foreground tabular-nums">{list.length}</span>
        </h2>
        <form action={createProject} className="flex gap-2">
          <Input name="name" placeholder="New app name…" className="h-8 w-44 sm:w-56" />
          <Button type="submit" size="sm">
            Create
          </Button>
        </form>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center">
          <p className="text-sm font-medium">No projects yet</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            A project is one app — it holds all of its store screenshots. Name one above to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((p) => (
            <div
              key={p.id}
              className="group relative rounded-2xl border border-border bg-card p-5 transition-colors hover:border-foreground/20 hover:bg-accent/40"
            >
              <Link href={`/project/${p.id}`} className="block after:absolute after:inset-0 after:rounded-2xl">
                <span className="font-medium tracking-tight">{p.name}</span>
                <span className="mt-1.5 block font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Edited {new Date(p.updated_at as string).toLocaleDateString()}
                </span>
              </Link>
              <form
                action={deleteProject}
                className="absolute right-3 top-3 z-10 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <input type="hidden" name="id" value={p.id} />
                <Button variant="ghost" size="icon-sm" type="submit" aria-label={`Delete ${p.name}`}>
                  <Trash2Icon />
                </Button>
              </form>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
