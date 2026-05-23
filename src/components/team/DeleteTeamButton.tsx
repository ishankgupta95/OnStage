"use client";

import { Trash2Icon } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteTeam } from "@/app/team-actions";

export function DeleteTeamButton({ teamId, teamName }: { teamId: string; teamName: string }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive" size="sm" className="gap-1.5" />}>
        <Trash2Icon className="size-3.5" />
        Delete team
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {teamName}?</DialogTitle>
          <DialogDescription>
            This permanently deletes the team along with every project and screenshot in it. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <form action={deleteTeam}>
            <input type="hidden" name="teamId" value={teamId} />
            <Button type="submit" variant="destructive">
              Delete team
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
