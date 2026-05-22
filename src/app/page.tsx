import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Onstage</h1>
      <p className="max-w-md text-muted-foreground">
        App Store &amp; Google Play screenshots that ship. Web-based,
        team-friendly, polished output.
      </p>
      <Link
        href="/project/demo/screenshot/1"
        className={buttonVariants({ size: "lg" })}
      >
        Open the editor →
      </Link>
      <p className="text-xs text-muted-foreground">
        Scaffold ready. See <code>../onstage-plan.md</code> for the build plan.
      </p>
    </main>
  );
}
