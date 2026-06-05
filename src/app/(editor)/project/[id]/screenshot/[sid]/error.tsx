"use client";

import { usePathname } from "next/navigation";
import ErrorState from "@/components/ErrorState";

export default function EditorError(props: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  // URL is /project/<id>/screenshot/<sid> (the (editor) group isn't in the path).
  const pathname = usePathname();
  const projectId = pathname?.split("/")[2];
  return (
    <ErrorState
      {...props}
      fullScreen
      title="The editor hit an error"
      description="Something went wrong rendering this screenshot. Try again — your last autosaved version is safe."
      homeHref={projectId ? `/project/${projectId}` : "/dashboard"}
      homeLabel="Back to project"
    />
  );
}
