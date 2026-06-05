import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveTeam, canEdit } from "@/lib/workspace";
import NewProjectForm from "@/components/project/NewProjectForm";

// Dedicated template-gallery creation flow. Static `new` segment wins over the
// sibling dynamic `[id]`, so /project/new resolves here (not the project page).
export default async function NewProjectPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { role } = await resolveActiveTeam(supabase, user.id);
  // Viewers can't create projects — bounce them back to the dashboard.
  if (!canEdit(role)) redirect("/dashboard");
  return <NewProjectForm />;
}
