"use client";

import { useState, useTransition } from "react";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/app/team-actions";

// acceptInvite redirects to /dashboard on success (handled by Next) and returns
// { ok: false, error } only on failure.
export function AcceptInviteButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function accept() {
    setError(null);
    startTransition(async () => {
      const res = await acceptInvite(token);
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-2">
      <Button onClick={accept} disabled={pending} className="w-full gap-1.5" size="lg">
        <CheckIcon className="size-4" />
        {pending ? "Joining…" : "Accept invitation"}
      </Button>
      {error && <p className="text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}
