import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  dispatch: vi.fn(),
  state: {
    taskDrawerReducer: {
      showTaskDrawer: true,
      selectedTaskId: 'issue-1',
      targetDrawerTab: 'timeLog',
      timeLogEditing: { isEditing: false },
      taskAccessDenied: false,
      taskAccessFrom: null,
      taskFormViewModel: { task: { id: 'issue-1', name: 'Software issue' } },
    },
    projectReducer: {
      projectId: 'software-project',
      project: { id: 'software-project', project_type: 'software' },
    },
    priorityReducer: { priorities: [{}] },
    taskLabelsReducer: { labels: [{}] },
    teamMembersReducer: { teamMembers: { data: [{}] } },
  },
}));
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (select: (value: unknown) => unknown) => select(fixture.state),
}));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => fixture.dispatch }));
vi.mock('@/hooks/useAuth', () => ({
  useAuthService: () => ({
    getCurrentSession: () => ({ subscription_type: 'FREE', business_features_enabled: true }),
  }),
}));
vi.mock('@/hooks/useTaskDrawerUrlSync', () => ({ default: () => ({ clearTaskFromUrl: vi.fn() }) }));
vi.mock('@/hooks/useTaskDrawerNavigation', () => ({ default: () => undefined }));
vi.mock('@/hooks/useTaskCreationPermission', () => ({ default: () => ({ canCreateTask: true }) }));
vi.mock('./task-drawer-header/task-drawer-header', () => ({
  default: () => <div>Issue header</div>,
}));
vi.mock('./task-drawer-title-section/task-drawer-title-section', () => ({
  default: () => <div>Issue title</div>,
}));
vi.mock('./shared/info-tab/task-drawer-info-tab', () => ({
  default: () => <div>Issue details</div>,
}));
vi.mock('./shared/info-tab/info-tab-footer', () => ({ default: () => <div>Info footer</div> }));
vi.mock('./shared/time-log/task-drawer-time-log', () => ({
  default: () => <div>Issue time logs</div>,
}));
vi.mock('./shared/time-log/time-log-form', () => ({ default: () => <div>Time log form</div> }));
vi.mock('./shared/activity-log/task-drawer-activity-log', () => ({
  default: () => <div>Issue activity</div>,
}));
vi.mock(
  '@/pages/projects/projectView/taskList/task-list-table/custom-columns/custom-column-modal/custom-column-modal',
  () => ({ default: () => null })
);

import TaskDrawer from './task-drawer';

describe('Software issue drawer navigation', () => {
  it('opens a Time Log deep link, offers Activity Log, and uses the correct footer', async () => {
    render(
      <MemoryRouter>
        <TaskDrawer />
      </MemoryRouter>
    );
    const timeTab = await screen.findByRole('tab', { name: 'Time Log' });
    expect(timeTab).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('Issue time logs')).toBeVisible();
    expect(screen.queryByText('Info footer')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Activity Log' }));
    expect(await screen.findByText('Issue activity')).toBeVisible();
  });
});
