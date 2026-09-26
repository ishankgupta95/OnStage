import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectScreen } from "@/components/onstage/screens/ProjectScreen";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/project",
  title: "Project — Onstage",
  description:
    "One app's screenshot sets, the store sizes they cover and their languages.",
});

// ProjectScreen reads ?app= with useSearchParams, which a statically exported
// page must render under a Suspense boundary.
export default function ProjectPage() {
  return (
    <Suspense>
      <ProjectScreen />
    </Suspense>
  );
}
