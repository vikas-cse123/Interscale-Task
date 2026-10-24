import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getFilteredTabItems, SOFTWARE_PRIMARY_TABS } from './project-view-constants';
import { resolveProjectViewNavigation } from './project-view-navigation';
import type { ILocalSession } from '@/types/auth/local-session.types';
import type { IProjectViewModel } from '@/types/project/projectViewModel.types';

vi.mock('@/i18n', () => ({ default: { t: (key: string) => key } }));
vi.mock('@/components/task-list-v2/TaskListV2', () => ({
  default: () => <div>Task list content</div>,
}));
vi.mock('@/pages/projects/projectView/enhancedBoard/project-view-enhanced-board', () => ({
  default: () => <div>Board content</div>,
}));
vi.mock('@/pages/projects/projectView/backlog/ProjectViewBacklog', () => ({
  default: () => <div>Backlog content</div>,
}));
vi.mock('@/pages/projects/projectView/finance/ProjectViewFinance', () => ({
  default: () => <div>Finance content</div>,
}));
vi.mock('@/pages/projects/projectView/workload/ProjectViewWorkload', () => ({
  default: () => <div>Workload content</div>,
}));

const selfHosted = {
  role_name: 'Owner',
  subscription_type: 'FREE',
  business_features_enabled: true,
} as ILocalSession;
const project = (overrides: Partial<IProjectViewModel> = {}) =>
  ({
    id: 'software-project',
    project_type: 'software',
    finance_access: true,
    ...overrides,
  }) as IProjectViewModel;
const keys = (value: IProjectViewModel) =>
  getFilteredTabItems(selfHosted, value, true).map(tab => tab.key);

describe('Software project feature availability', () => {
  it('offers every implemented general-project view alongside software views', () => {
    const softwareKeys = keys(project());
    const generalKeys = keys(project({ project_type: 'general' }));
    expect(softwareKeys).toEqual(expect.arrayContaining(generalKeys));
    expect(softwareKeys).toEqual(
      expect.arrayContaining(['backlog', 'releases', 'reports', 'docs', 'finance', 'workload'])
    );
    expect(generalKeys).not.toEqual(expect.arrayContaining(['backlog', 'releases', 'reports']));
    // Non-primary tabs remain available in the existing More menu.
    expect(softwareKeys.filter(key => !SOFTWARE_PRIMARY_TABS.includes(key))).toEqual(
      expect.arrayContaining(['finance', 'workload'])
    );
  });

  it.each(['finance', 'workload'])(
    'keeps a direct %s URL on initial load and refresh and mounts its component',
    async key => {
      const tabs = getFilteredTabItems(selfHosted, project(), true);
      expect(resolveProjectViewNavigation(key, tabs, false)).toEqual({
        tabKey: key,
        redirect: false,
        upgrade: false,
      });
      for (let load = 0; load < 2; load += 1) {
        expect(resolveProjectViewNavigation(key, tabs, true)).toEqual({
          tabKey: key,
          redirect: false,
          upgrade: false,
        });
      }
      const content = tabs.find(tab => tab.key === key)?.element;
      render(<>{content}</>);
      expect(
        await screen.findByText(key === 'finance' ? 'Finance content' : 'Workload content')
      ).toBeInTheDocument();
    }
  );

  it('keeps Finance unavailable without project-level Finance permission', () => {
    const tabs = getFilteredTabItems(selfHosted, project({ finance_access: false }), true);
    expect(tabs.some(tab => tab.key === 'finance')).toBe(false);
    expect(resolveProjectViewNavigation('finance', tabs, true).redirect).toBe(true);
  });

  it('keeps guest and explicit Docs restrictions', () => {
    const guest = project({ is_guest: true } as Partial<IProjectViewModel>);
    expect(keys(guest)).not.toContain('finance');
    expect(keys(guest)).not.toContain('docs');
    expect(keys(guest)).not.toContain('reports');
    const deniedDocs = project({
      permissions: { docs: false, finance: false },
    } as Partial<IProjectViewModel>);
    expect(keys(deniedDocs)).not.toContain('docs');
  });

  it('retains cloud Free-tier restrictions and waits for the matching project before redirecting', () => {
    const cloudFree = { subscription_type: 'FREE', role_name: 'Owner' } as ILocalSession;
    const tabs = getFilteredTabItems(cloudFree, project(), true);
    expect(resolveProjectViewNavigation('workload', tabs, true).upgrade).toBe(true);
    expect(resolveProjectViewNavigation('finance', [], false)).toEqual({
      tabKey: 'finance',
      redirect: false,
      upgrade: false,
    });
  });
});
