import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  dispatch: vi.fn(),
  state: {
    themeReducer: { mode: 'light' },
    projectFinancesReducer: {
      activeTab: 'finance',
      activeGroup: 'status',
      billableFilter: 'all',
      loading: false,
      taskGroups: [],
      project: { currency: 'USD' },
    },
    projectReducer: {
      projectId: 'software-project',
      refreshTimestamp: 0,
      project: {
        id: 'software-project',
        project_type: 'software',
        finance_access: true,
        budget: 1000,
        currency: 'USD',
      },
    },
    phaseReducer: { phaseList: [] },
  },
  t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: fixture.t }) }));
vi.mock('@/i18n', () => ({ default: { t: fixture.t } }));
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (select: (state: unknown) => unknown) => select(fixture.state),
}));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => fixture.dispatch }));
vi.mock('@/hooks/useAuth', () => ({
  useAuthService: () => ({
    getCurrentSession: () => ({
      role_name: 'Owner',
      subscription_type: 'FREE',
      business_features_enabled: true,
    }),
  }),
}));
vi.mock('@/socket/socketContext', () => ({ useSocket: () => ({ socket: null }) }));
vi.mock('@/components/projects/project-finance/finance-table-wrapper/FinanceTableWrapper', () => ({
  default: () => <div>Project cost table</div>,
}));
vi.mock('@/components/projects/project-finance/ratecard-table/RateCardTable', () => ({
  default: () => <div>Project rate card</div>,
}));
vi.mock('@/components/projects/import-ratecards-drawer/ImportRateCardsDrawer', () => ({
  default: () => null,
}));
vi.mock('@/components/projects/project-budget-settings-drawer/ProjectBudgetSettingsDrawer', () => ({
  default: () => null,
}));

import ProjectViewFinance from './ProjectViewFinance';

describe('Existing Finance implementation with a Software project', () => {
  it('renders Finance and permits rate-card navigation for a self-hosted authorized user', async () => {
    const page = (
      <MemoryRouter initialEntries={['/projects/software-project']}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectViewFinance />} />
        </Routes>
      </MemoryRouter>
    );
    const { rerender } = render(page);
    expect(await screen.findByText('Project cost table')).toBeInTheDocument();
    expect(screen.queryByText('Business Plan Required')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Rate Card'));
    expect(fixture.dispatch).toHaveBeenCalledWith(expect.objectContaining({ payload: 'ratecard' }));
    fixture.state.projectFinancesReducer.activeTab = 'ratecard';
    rerender(
      <MemoryRouter initialEntries={['/projects/software-project']}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectViewFinance />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText('Project rate card')).toBeInTheDocument();
  });
});
