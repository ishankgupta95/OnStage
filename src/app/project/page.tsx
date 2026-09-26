import type { Metadata } from "next";
import { ProjectScreen } from "@/components/onstage/screens/ProjectScreen";

export const metadata: Metadata = { title: "Trailhead — Onstage" };

export default function ProjectPage() {
  return <ProjectScreen />;
}
