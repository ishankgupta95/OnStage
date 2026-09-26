import type { Metadata } from "next";
import { Suspense } from "react";
import { EditorScreen } from "@/components/onstage/editor/EditorScreen";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/editor",
  title: "Canvas — Onstage",
  description:
    "The Onstage canvas: drop in your app's screens, write a headline for each frame, tilt the phone, pick a background and export every store size.",
});

export default function EditorPage() {
  return (
    <Suspense>
      <EditorScreen />
    </Suspense>
  );
}
