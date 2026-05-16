import type { DashboardProject } from "../app/components/dashboard-session";

/** Persist active project to Clerk metadata when signed in (no-op if Clerk off). */
export async function persistActiveProjectToClerk(project: Pick<DashboardProject, "id" | "name">) {
  try {
    await fetch("/api/fluxy/active-project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, projectName: project.name }),
    });
  } catch {
    // Non-blocking — sessionStorage remains source of truth in-tab
  }
}
