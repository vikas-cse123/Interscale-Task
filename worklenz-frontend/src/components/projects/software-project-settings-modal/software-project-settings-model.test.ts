import { describe, it, expect } from 'vitest';
import { buildFormValues, buildProjectModel } from './software-project-settings-model';
import type { IProjectViewModel } from '@/types/project/projectViewModel.types';

const project = {
  id: 'software-project',
  name: 'Software',
  key: 'SOFT',
  project_type: 'software',
  working_days: 12,
  man_days: 6,
  hours_per_day: 7,
  use_manual_progress: true,
  use_weighted_progress: false,
  use_time_progress: false,
  phase_assignees_enabled: true,
  auto_assign_subtask_phase: true,
  budget: 4500,
  currency: 'INR',
} as IProjectViewModel;

describe('Software settings persistence', () => {
  it('initializes existing budget, estimates and progress rather than overwriting with defaults', () => {
    expect(buildFormValues(project)).toMatchObject({
      budget: 4500,
      currency: 'INR',
      working_days: 12,
      man_days: 6,
      hours_per_day: 7,
      use_manual_progress: true,
      phase_assignees_enabled: true,
    });
  });
  it('submits changed advanced/estimate fields and preserves unexposed data', () => {
    const values = {
      ...buildFormValues(project),
      use_manual_progress: false,
      use_time_progress: true,
      phase_assignees_enabled: false,
      hours_per_day: 6,
    };
    const payload = buildProjectModel({
      project,
      values,
      projectLead: null,
      canAssignLead: false,
      canManageVisibility: false,
    });
    expect(payload).toMatchObject({
      use_manual_progress: false,
      use_time_progress: true,
      phase_assignees_enabled: false,
      hours_per_day: 6,
      working_days: 12,
      man_days: 6,
      auto_assign_subtask_phase: true,
    });
    expect(payload).not.toHaveProperty('finance_access');
    expect(payload).not.toHaveProperty('restrict_tasks_to_assignee');
  });
});
