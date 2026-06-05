import NewProjectForm from "@/components/project/NewProjectForm";

// Static, no-auth project creation. NewProjectForm is a client component that
// writes the new project to IndexedDB and navigates into the editor.
export default function NewProjectPage() {
  return <NewProjectForm />;
}
