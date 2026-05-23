"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  PlusIcon,
  SettingsIcon,
  UsersIcon,
  UserIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setActiveTeam, createTeam } from "@/app/team-actions";
import type { Workspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

function sublabel(w: Workspace): string {
  if (w.personal) return "Personal";
  return w.role.charAt(0).toUpperCase() + w.role.slice(1);
}

export function WorkspaceSwitcher({
  workspaces,
  activeId,
}: {
  workspaces: Workspace[];
  activeId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const active = workspaces.find((w) => w.teamId === activeId) ?? workspaces[0];

  function switchTo(teamId: string) {
    if (teamId === activeId) return;
    startTransition(async () => {
      await setActiveTeam(teamId);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex items-center gap-2 rounded-xl border border-transparent px-2 py-1 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted",
            pending && "opacity-60",
          )}
          aria-label="Switch workspace"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
            {active?.personal ? <UserIcon className="size-4" /> : <UsersIcon className="size-4" />}
          </span>
          <span className="min-w-0">
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Workspace
            </span>
            <span className="block max-w-[11rem] truncate text-sm font-semibold leading-tight">
              {active?.name ?? "Personal"}
            </span>
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.16em]">
              Workspaces
            </DropdownMenuLabel>
            {workspaces.map((w) => {
            const isActive = w.teamId === activeId;
            return (
              <DropdownMenuItem
                key={w.teamId}
                onClick={() => switchTo(w.teamId)}
                className="gap-2.5"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground ring-1 ring-border">
                  {w.personal ? <UserIcon className="size-3.5" /> : <UsersIcon className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{w.name}</span>
                  <span className="block text-[11px] text-muted-foreground">{sublabel(w)}</span>
                </span>
                {isActive && <CheckIcon className="size-4 shrink-0 text-primary" />}
              </DropdownMenuItem>
            );
          })}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/settings/team" />} className="gap-2.5">
            <SettingsIcon className="size-4 text-muted-foreground" />
            Team settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setCreateOpen(true)} className="gap-2.5">
            <PlusIcon className="size-4 text-muted-foreground" />
            Create team
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a team</DialogTitle>
            <DialogDescription>
              A team is a shared workspace. You&apos;ll be the owner and can invite people next.
            </DialogDescription>
          </DialogHeader>
          <form action={createTeam} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="team-name">Team name</Label>
              <Input id="team-name" name="name" placeholder="Acme Design" required autoFocus />
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button type="submit">Create team</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
