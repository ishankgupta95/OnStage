"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { changeMemberRole } from "@/app/team-actions";

// Owner-only control to flip a member between editor and viewer.
export function MemberRoleSelect({
  teamId,
  userId,
  role,
}: {
  teamId: string;
  userId: string;
  role: "editor" | "viewer";
}) {
  const [pending, startTransition] = useTransition();

  function onChange(value: string | null) {
    if (!value || value === role) return;
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("userId", userId);
    fd.set("role", value);
    startTransition(async () => {
      await changeMemberRole(fd);
      toast.success("Role updated");
    });
  }

  return (
    <Select value={role} onValueChange={onChange} disabled={pending}>
      <SelectTrigger size="sm" className="w-[7.5rem]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="editor">Editor</SelectItem>
        <SelectItem value="viewer">Viewer</SelectItem>
      </SelectContent>
    </Select>
  );
}
