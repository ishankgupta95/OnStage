"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon, CopyIcon, SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { inviteMember, type InviteResult } from "@/app/team-actions";

export function InviteForm({ teamId }: { teamId: string }) {
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState<"editor" | "viewer">("viewer");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("teamId", teamId);
    fd.set("role", role);
    setError(null);
    startTransition(async () => {
      const res: InviteResult = await inviteMember(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLink(res.link);
      setCopied(false);
      form.reset();
      if (res.emailSent) toast.success(`Invite emailed to ${res.email}`);
      else toast("Email isn't set up yet — copy the link below to share the invite.");
    });
  }

  function copy() {
    if (!link) return;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopied(true);
        toast.success("Invite link copied");
      })
      .catch(() => toast.error("Couldn't copy the link"));
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="invite-email">Email</Label>
          <Input id="invite-email" name="email" type="email" required placeholder="teammate@company.com" className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-role">Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as "editor" | "viewer")}>
            <SelectTrigger id="invite-role" className="h-9 w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" size="sm" className="h-9 shrink-0 gap-1.5" disabled={pending}>
          <SendIcon className="size-3.5" />
          {pending ? "Inviting…" : "Send invite"}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {link && (
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Invite link</p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-background px-2 py-1.5 text-xs ring-1 ring-border">
              {link}
            </code>
            <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1.5" onClick={copy}>
              {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">Anyone with this link and the invited email can join. Expires in 7 days.</p>
        </div>
      )}
    </div>
  );
}
