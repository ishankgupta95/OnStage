import { Button } from "@/components/ui/button";

export default function TopBar({ projectName }: { projectName: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <div className="flex items-center gap-2">
        <span className="font-semibold tracking-tight">Onstage</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm">{projectName}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm">
          Share
        </Button>
        <Button size="sm">Export</Button>
      </div>
    </header>
  );
}
