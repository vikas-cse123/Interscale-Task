import dayjs from 'dayjs';
import type { IProjectViewModel } from '@/types/project/projectViewModel.types';
import type { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { decodeHtmlEntities } from '@/utils/html-entities';

export const buildFormValues = (project: IProjectViewModel): SoftwareSettingsFormValues => ({
  name: decodeHtmlEntities(project.name ?? ''),
  key: project.key ?? '',
  notes: project.notes ? decodeHtmlEntities(project.notes.slice(0, 500)) : '',
  color_code: project.color_code,
  status_id: project.status_id,
  health_id: project.health_id ?? undefined,
  priority_id: project.priority_id ?? undefined,
  category_id: project.category_id ?? null,
  client_id: project.client_id ?? null,
  client_name: project.client_name ?? null,
  start_date: project.start_date ? dayjs(project.start_date) : null,
  end_date: project.end_date ? dayjs(project.end_date) : null,
  finance_access:
    typeof project.project_manager?.finance_access === 'boolean'
      ? project.project_manager.finance_access
      : true,
  auto_assign_task_creator: Boolean(project.auto_assign_task_creator),
  restrict_task_creation: Boolean(project.restrict_task_creation),
  restrict_tasks_to_assignee: Boolean(project.restrict_tasks_to_assignee),
  use_manual_progress: Boolean(project.use_manual_progress),
  use_weighted_progress: Boolean(project.use_weighted_progress),
  use_time_progress: Boolean(project.use_time_progress),
  phase_assignees_enabled: Boolean(project.phase_assignees_enabled),
  working_days: project.working_days ?? 0,
  man_days: project.man_days ?? 0,
  hours_per_day: project.hours_per_day ?? 8,
  budget: project.budget ?? 0,
  currency: project.currency || 'USD',
});

/**
 * update_project overwrites every column it receives, so settings this modal
 * does not expose are carried over from the loaded project unchanged.
 */
export const buildProjectModel = ({
  project,
  values,
  projectLead,
  canAssignLead,
  canManageVisibility,
}: BuildProjectModelArgs): IProjectViewModel => ({
  name: values.name,
  key: values.key?.toUpperCase(),
  notes: values.notes,
  color_code: values.color_code,
  status_id: values.status_id,
  health_id: values.health_id,
  priority_id: values.priority_id || null,
  category_id: values.category_id || null,
  client_id: values.client_id ?? undefined,
  client_name: values.client_name,
  start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : undefined,
  end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : undefined,
  project_manager: projectLead,
  ...(canAssignLead ? { finance_access: values.finance_access !== false } : {}),
  auto_assign_task_creator: Boolean(values.auto_assign_task_creator),
  restrict_task_creation: Boolean(values.restrict_task_creation),
  ...(canManageVisibility
    ? { restrict_tasks_to_assignee: Boolean(values.restrict_tasks_to_assignee) }
    : {}),
  working_days: Number(values.working_days ?? project.working_days ?? 0),
  man_days: Number(values.man_days ?? project.man_days ?? 0),
  hours_per_day: Number(values.hours_per_day ?? project.hours_per_day ?? 8),
  use_manual_progress: Boolean(values.use_manual_progress ?? project.use_manual_progress),
  use_weighted_progress: Boolean(values.use_weighted_progress ?? project.use_weighted_progress),
  use_time_progress: Boolean(values.use_time_progress ?? project.use_time_progress),
  phase_assignees_enabled: Boolean(
    values.phase_assignees_enabled ?? project.phase_assignees_enabled
  ),
  auto_assign_subtask_phase: Boolean(project.auto_assign_subtask_phase),
});

export interface SoftwareSettingsFormValues {
  name: string;
  key?: string;
  notes?: string;
  color_code?: string;
  status_id?: string;
  health_id?: string;
  priority_id?: string;
  category_id?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  start_date?: dayjs.Dayjs | null;
  end_date?: dayjs.Dayjs | null;
  finance_access?: boolean;
  auto_assign_task_creator?: boolean;
  restrict_task_creation?: boolean;
  restrict_tasks_to_assignee?: boolean;
  use_manual_progress?: boolean;
  use_weighted_progress?: boolean;
  use_time_progress?: boolean;
  phase_assignees_enabled?: boolean;
  working_days?: number;
  man_days?: number;
  hours_per_day?: number;
  budget?: number;
  currency?: string;
  delivery_confidence?: 'green' | 'amber' | 'red' | 'unset';
  delivery_confidence_note?: string;
}

interface BuildProjectModelArgs {
  project: IProjectViewModel;
  values: SoftwareSettingsFormValues;
  projectLead: ITeamMemberViewModel | null;
  canAssignLead: boolean;
  canManageVisibility: boolean;
}
