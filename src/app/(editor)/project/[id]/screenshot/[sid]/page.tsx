import TopBar from "@/components/editor/TopBar";
import LeftSidebar from "@/components/editor/LeftSidebar";
import RightSidebar from "@/components/editor/RightSidebar";
import EditorCanvas from "@/components/editor/EditorCanvas";

export default async function ScreenshotEditorPage({
  params,
}: {
  params: Promise<{ id: string; sid: string }>;
}) {
  const { id, sid } = await params;

  return (
    <div className="flex h-screen flex-col">
      <TopBar projectName={`Project ${id} · Screenshot ${sid}`} />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <main className="flex flex-1 items-center justify-center bg-muted/30 p-8">
          <EditorCanvas />
        </main>
        <RightSidebar />
      </div>
    </div>
  );
}
