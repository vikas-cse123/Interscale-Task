import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import workloadReducer from '@/features/project-workload/projectWorkloadSlice';

const fixture = vi.hoisted(() => ({
  query: vi.fn(),
  refetch: vi.fn(),
  dispatch: vi.fn(),
  t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  data: {
    members: [
      {
        id: 'member',
        name: 'Test Member',
        email: 'member@example.test',
        dailyCapacity: 8,
        weeklyCapacity: 40,
        currentWorkload: 0,
        utilizationPercentage: 0,
        isOverallocated: false,
        isUnderutilized: true,
        expectedCapacity: 40,
        tasks: [],
      },
    ],
    allocations: [],
    availability: [],
  },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: fixture.t }) }));
vi.mock('@/i18n', () => ({ default: { t: fixture.t } }));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => fixture.dispatch }));
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (select: (state: unknown) => unknown) =>
    select({
      projectWorkload: workloadReducer(undefined, { type: 'init' }),
      projectReducer: {
        projectId: 'software-project',
        project: { id: 'software-project', project_type: 'software' },
      },
    }),
}));
vi.mock('@/socket/socketContext', () => ({
  useSocket: () => ({ socket: null, connected: false }),
}));
// Only canvas rendering is replaced; all Workload views, filters and calculations run.
vi.mock('react-chartjs-2', () => ({ Bar: () => <div data-testid="capacity-chart" /> }));
vi.mock('@/api/project-workload/project-workload.api.service', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/api/project-workload/project-workload.api.service')>();
  return {
    ...actual,
    useGetProjectWorkloadQuery: (args: unknown) => {
      fixture.query(args);
      return { data: fixture.data, isLoading: false, isFetching: false, refetch: fixture.refetch };
    },
    useGetWorkloadMembersQuery: () => ({
      isLoading: false,
      isFetching: false,
      refetch: fixture.refetch,
    }),
  };
});

import ProjectViewWorkload from './ProjectViewWorkload';

describe('Existing Workload implementation with a Software project', () => {
  it('renders the chart, calendar and table and requests data for the Software project', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/software-project']}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectViewWorkload />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByTestId('capacity-chart')).toBeInTheDocument();
    expect(fixture.query).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'software-project' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'calendarView' }));
    expect(document.querySelector('.ant-picker-calendar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'tableView' }));
    expect(document.querySelector('.ant-table')).toBeInTheDocument();
  });
});
