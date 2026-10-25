import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, it, expect, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  dispatch: vi.fn(),
  created: vi.fn(),
  createProject: vi.fn().mockResolvedValue({ data: { done: true, body: { id: 'new-software' } } }),
  createTemplate: vi.fn().mockResolvedValue({ done: true, body: { project_id: 'new-software' } }),
  t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: fixture.t }) }));
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (select: (value: unknown) => unknown) =>
    select({ projectStatusesReducer: { projectStatuses: [{ id: 'status', is_default: true }] } }),
}));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => fixture.dispatch }));
vi.mock('@/hooks/useAuth', () => ({ useAuthService: () => ({ isOwnerOrAdmin: () => true }) }));
vi.mock('@/hooks/useMixpanelTracking', () => ({
  useMixpanelTracking: () => ({ trackMixpanelEvent: vi.fn() }),
}));
vi.mock('@/api/api-client', () => ({
  ensureCsrfToken: async () => 'test-csrf',
  refreshCsrfToken: async () => 'test-csrf',
}));
vi.mock('@/api/projects/projects.v1.api.service', () => ({
  useCreateProjectMutation: () => [fixture.createProject, { isLoading: false }],
  projectsApi: { util: { invalidateTags: () => ({ type: 'invalidate' }) } },
}));
vi.mock('@/api/home-page/home-page.api.service', () => ({
  default: { util: { invalidateTags: () => ({ type: 'invalidate-home' }) } },
}));
vi.mock('@/api/project-templates/project-templates.api.service', () => ({
  projectTemplatesApiService: {
    getWorklenzTemplates: async () => ({
      done: true,
      body: [{ id: 'template', name: 'Existing template', task_count: 1, phase_count: 1 }],
    }),
    getCustomTemplates: async () => ({
      done: true,
      body: [{ id: 'custom', name: 'Custom template' }],
    }),
    createFromWorklenzTemplate: fixture.createTemplate,
    createFromCustomTemplate: fixture.createTemplate,
  },
}));
vi.mock('./template-preview-drawer', () => ({ TemplatePreviewDrawer: () => null }));
vi.mock('@/components/project-templates/project-template-preview-modal', () => ({
  default: ({
    visible,
    templateId,
    onImport,
  }: {
    visible: boolean;
    templateId: string;
    onImport: (id: string, payload: { projectName: string }) => void;
  }) =>
    visible ? (
      <button onClick={() => onImport(templateId, { projectName: 'Custom software' })}>
        Confirm custom template
      </button>
    ) : null,
}));
vi.mock('@/utils/project-template-import-result', () => ({
  presentCustomTemplateImportResult: vi.fn(),
}));
vi.mock('@/pages/settings/import-export/ImportSourceModal', () => ({
  default: ({
    open,
    createTargetProject,
    onImportStarted,
  }: {
    open: boolean;
    createTargetProject: () => Promise<string>;
    onImportStarted: (id: string) => void;
  }) =>
    open ? (
      <button onClick={async () => onImportStarted(await createTargetProject())}>
        Start test CSV import
      </button>
    ) : null,
}));

import { CreateProjectModal } from './create-project-modal';
beforeEach(() => vi.clearAllMocks());

describe('Software project creation sources', () => {
  it('creates a Software target through the existing CSV wizard', async () => {
    render(
      <MemoryRouter>
        <CreateProjectModal open onClose={vi.fn()} onProjectCreated={fixture.created} />
      </MemoryRouter>
    );
    await screen.findByText('Existing template');
    fireEvent.click(screen.getByText('Software'));
    expect(screen.queryByText(/Templates are not used for Software projects/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Project name' }), {
      target: { value: 'Software CSV' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import from CSV' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to CSV import' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Start test CSV import' }));
    await waitFor(() =>
      expect(fixture.createProject).toHaveBeenCalledWith(
        expect.objectContaining({ project_type: 'software', name: 'Software CSV' })
      )
    );
    await waitFor(() => expect(fixture.created).toHaveBeenCalledWith('new-software'));
  });

  it('keeps the Software type through custom-template configuration', async () => {
    render(
      <MemoryRouter>
        <CreateProjectModal open onClose={vi.fn()} onProjectCreated={fixture.created} />
      </MemoryRouter>
    );
    await screen.findByText('Existing template');
    fireEvent.click(screen.getByText('Software'));
    fireEvent.click(screen.getByRole('button', { name: 'Your Library' }));
    fireEvent.click(await screen.findByText('Custom template'));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm custom template' }));
    await waitFor(() =>
      expect(fixture.createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          project_type: 'software',
          template_id: 'custom',
          project_name: 'Custom software',
        })
      )
    );
    await waitFor(() => expect(fixture.created).toHaveBeenCalledWith('new-software'));
  });
  it('keeps templates, the custom library and CSV visible and sends the selected project type', async () => {
    render(
      <MemoryRouter>
        <CreateProjectModal open onClose={vi.fn()} onProjectCreated={fixture.created} />
      </MemoryRouter>
    );
    await screen.findByText('Existing template');
    fireEvent.click(screen.getByText('Software'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Your Library' })).toBeVisible());
    expect(screen.getByRole('button', { name: 'Import from CSV' })).toBeVisible();
    fireEvent.click(screen.getByText('Existing template'));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(fixture.createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ project_type: 'software', template_id: 'template' })
      )
    );
    expect(fixture.created).toHaveBeenCalledWith('new-software');
  });
});
