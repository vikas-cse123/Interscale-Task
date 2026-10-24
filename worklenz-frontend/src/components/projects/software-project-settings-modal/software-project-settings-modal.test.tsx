import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, it, expect, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  permissions: {
    settings: true,
    finance: true,
    customColumns: true,
    assignPm: true,
    delete: true,
    phases: true,
  },
  update: vi.fn().mockResolvedValue({ data: { done: true, body: {} } }),
  budget: vi.fn().mockResolvedValue({ done: true }),
  currency: vi.fn().mockResolvedValue({ done: true }),
  dispatch: vi.fn(),
  t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  project: {
    id: 'software-project',
    name: 'Software project',
    key: 'SOFT',
    project_type: 'software',
    budget: 100,
    currency: 'USD',
  },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: fixture.t }) }));
vi.mock('@/i18n', () => ({ default: { t: fixture.t } }));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => fixture.dispatch }));
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (select: (state: unknown) => unknown) =>
    select({
      projectDrawerReducer: {
        projectId: fixture.project.id,
        project: fixture.project,
        projectLoading: false,
      },
      projectSettingsModalReducer: { isOpen: true, navigateToProjectOnUpdate: false },
      projectStatusesReducer: { projectStatuses: [{}] },
      projectHealthReducer: { projectHealths: [{}] },
      projectCategoriesReducer: { projectCategories: [{}] },
      projectPriorityReducer: { priorities: [{}] },
      clientReducer: { clients: { data: [{}] } },
    }),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuthService: () => ({
    role: 'Owner',
    isOwnerOrAdmin: () => true,
    getCurrentSession: () => ({
      role_name: 'Owner',
      subscription_type: 'FREE',
      business_features_enabled: true,
    }),
  }),
}));
vi.mock('@/hooks/useProjectPermissions', () => ({
  default: () => ({ permissions: fixture.permissions, isProjectManager: false }),
}));
vi.mock('@/api/projects/projects.v1.api.service', () => ({
  useUpdateProjectMutation: () => [fixture.update, { isLoading: false }],
  useDeleteProjectMutation: () => [vi.fn()],
}));
vi.mock('@/api/api-client', () => ({ ensureCsrfToken: async () => 'test-csrf' }));
vi.mock('@/api/project-finance-ratecard/project-finance.api.service', () => ({
  projectFinanceApiService: {
    updateProjectBudget: fixture.budget,
    updateProjectCurrency: fixture.currency,
  },
}));
vi.mock('../project-settings-modal/hooks/useDeliveryConfidence', () => ({
  useDeliveryConfidence: () => ({
    savedConfidenceRef: { current: { status: null, note: null } },
    confidenceLoadedRef: { current: true },
  }),
}));
vi.mock('./sections/software-details-section', () => ({ SoftwareDetailsSection: () => null }));
vi.mock('./sections/software-team-access-section', () => ({
  SoftwareTeamAccessSection: () => null,
}));
vi.mock('./sections/software-sprints-section', () => ({ SoftwareSprintsSection: () => null }));
vi.mock('./sections/software-estimation-section', () => ({
  SoftwareEstimationSection: () => null,
}));
vi.mock('@/components/task-management/ManageStatusContent', () => ({ default: () => null }));
vi.mock('../project-settings-modal/sections/integrations-settings-section', () => ({
  default: () => null,
}));
vi.mock('../project-settings-modal/sections/task-export-settings-section', () => ({
  default: () => null,
}));
vi.mock('../project-settings-modal/sections/danger-zone-section', () => ({ default: () => null }));
vi.mock('../project-settings-modal/sections/custom-columns-settings-section', () => ({
  default: ({ disabled }: { disabled: boolean }) => (
    <button disabled={disabled}>Manage custom columns</button>
  ),
}));

import { SoftwareProjectSettingsModal } from './software-project-settings-modal';

beforeEach(() => {
  vi.clearAllMocks();
  fixture.permissions.finance = true;
  fixture.permissions.customColumns = true;
});

describe('Software project settings feature chain', () => {
  it('shows Advanced, Custom Columns and Budget, and saves budget through the Finance API', async () => {
    render(
      <MemoryRouter>
        <SoftwareProjectSettingsModal onClose={vi.fn()} />
      </MemoryRouter>
    );
    await screen.findAllByText('Advanced Settings');
    fireEvent.click(screen.getAllByText('Budget Settings')[0]);
    const budget = await screen.findByPlaceholderText('Enter project budget');
    fireEvent.change(budget, { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(fixture.budget).toHaveBeenCalledWith('software-project', 250));
    expect(fixture.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'software-project' })
    );
    expect(fixture.currency).not.toHaveBeenCalled();
  });
  it('does not expose budget or enable custom-field editing without the corresponding permissions', async () => {
    fixture.permissions.finance = false;
    fixture.permissions.customColumns = false;
    render(
      <MemoryRouter>
        <SoftwareProjectSettingsModal onClose={vi.fn()} />
      </MemoryRouter>
    );
    await screen.findAllByText('Custom Columns');
    expect(screen.queryByText('Budget Settings')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByText('Custom Columns')[0]);
    expect(await screen.findByRole('button', { name: 'Manage custom columns' })).toBeDisabled();
    expect(fixture.budget).not.toHaveBeenCalled();
  });
});
