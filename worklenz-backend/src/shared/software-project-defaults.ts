import db from "../config/db";

/** Preserve imported sprints; seed the normal first sprint only when none exist. */
export async function ensureDefaultSoftwareSprint(projectId: string): Promise<void> {
  await db.query(
    `INSERT INTO project_phases (name, color_code, project_id, sort_index, sprint_status)
     SELECT $2, $3, $1, 1, 'planned'
     WHERE NOT EXISTS (SELECT 1 FROM project_phases WHERE project_id = $1)`,
    [projectId, "Sprint 1", "#fbc84c"],
  );
}
