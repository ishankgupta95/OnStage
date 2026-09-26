import type { Metadata } from "next";
import { Suspense } from "react";
import { EditorScreen } from "@/components/onstage/editor/EditorScreen";

export const metadata: Metadata = { title: "Canvas — Onstage" };

export default function EditorPage() {
  return (
    <Suspense>
      <EditorScreen />
    </Suspense>
  );
}
