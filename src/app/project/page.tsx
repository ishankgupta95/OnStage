import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectScreen } from "@/components/onstage/screens/ProjectScreen";

export const metadata: Metadata = { title: "Project — Onstage" };

// ProjectScreen reads ?app= with useSearchParams, which a statically exported
// page must render under a Suspense boundary.
export default function ProjectPage() {
  return (
    <Suspense>
      <ProjectScreen />
    </Suspense>
  );
}
