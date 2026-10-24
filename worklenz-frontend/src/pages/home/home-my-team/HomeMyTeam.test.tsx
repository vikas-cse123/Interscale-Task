import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import memberReducer from '@/features/settings/member/memberSlice';
import { Modal } from '@/shared/antd-imports';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import HomeMyTeam from './HomeMyTeam';

// Resolve i18n keys to defaultValue like other home tests.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, string> = {}) =>
      (options.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => options[name] ?? ''),
  }),
}));

const session = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/hooks/useAuth', () => ({
  useAuthService: () => ({
    getCurrentSession: () => session.current,
    isOwnerOrAdmin: () => {
      const s = session.current as { owner?: boolean; role_name?: string };
      return !!s.owner || s.role_name === 'Owner' || s.role_name === 'Admin';
    },
  }),
}));

vi.mock('@/api/team-members/teamMembers.api.service', () => ({
  teamMembersApiService: {
    get: vi.fn(),
    delete: vi.fn(),
    toggleMemberActiveStatus: vi.fn(),
  },
}));

// Avoid network + heavy drawer rendering; the invite modal itself is mounted globally
// by Navbar in the real app, so tests focus on dispatch + delete wiring here.
vi.mock('@/features/admin-center/admin-center.slice', () => ({
  fetchBillingInfo: () => ({ type: 'billing/fetchBillingInfo-mock' }),
}));
vi.mock('@/components/settings/update-member-drawer', () => ({ default: () => null }));

const apiGet = vi.mocked(teamMembersApiService.get);
const apiDelete = vi.mocked(teamMembersApiService.delete);

const ownerRow = {
  id: 'm-owner',
  name: 'Olivia Owner',
  email: 'owner@example.com',
  role_name: 'Owner',
  active: true,
  projects_count: 1,
};
const memberRow = {
  id: 'm-member',
  name: 'Manny Member',
  email: 'member@example.com',
  role_name: 'Member',
  active: true,
  projects_count: 0,
};

const renderPage = () => {
  const store = configureStore({ reducer: { memberReducer } });
  render(
    <Provider store={store}>
      <MemoryRouter>
        <HomeMyTeam />
      </MemoryRouter>
    </Provider>
  );
  return { store };
};

beforeEach(() => {
  vi.clearAllMocks();
  session.current = { owner: true, role_name: 'Owner', team_member_id: 'm-owner' };
  apiGet.mockResolvedValue({ done: true, body: { data: [ownerRow, memberRow], total: 2 } } as never);
  apiDelete.mockResolvedValue({ done: true, body: {}, message: 'Team member deleted successfully.' } as never);
});

describe('HomeMyTeam invite', () => {
  it('shows Invite Member to Owner/Admin and dispatches the drawer toggle', async () => {
    const user = userEvent.setup();
    const { store } = renderPage();
    const buttons = await screen.findAllByRole('button', { name: 'Invite Member' });
    expect(buttons.length).toBeGreaterThan(0);
    expect(store.getState().memberReducer.isInviteMemberDrawerOpen).toBe(false);
    await user.click(buttons[0]);
    expect(store.getState().memberReducer.isInviteMemberDrawerOpen).toBe(true);
  });

  it('hides Invite Member from non-privileged roles', async () => {
    session.current = { role_name: 'Member', team_member_id: 'm-member' };
    renderPage();
    await screen.findByText('Manny Member');
    expect(screen.queryByRole('button', { name: 'Invite Member' })).toBeNull();
  });
});

describe('HomeMyTeam remove member', () => {
  it('confirms via Modal.confirm then deletes and refreshes (Owner target stays protected)', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(Modal, 'confirm').mockImplementation(((config: any) => {
      return { destroy: vi.fn() } as never;
    }) as never);
    try {
      renderPage();
      await screen.findByText('Manny Member');

      // Open the actions menu for the Member row and click Remove.
      const memberCell = screen.getByText('Manny Member').closest('tr') as HTMLElement;
      const menuButton = within(memberCell).getByRole('button');
      await user.click(menuButton);
      const removeItem = await screen.findByText('Remove');
      await user.click(removeItem);

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      const config = confirmSpy.mock.calls[0][0] as { onOk: () => Promise<unknown> };
      await act(async () => {
        await config.onOk();
      });

      expect(apiDelete).toHaveBeenCalledWith('m-member');
      await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2));

      // Owner row must stay protected: its actions trigger is disabled so no menu opens.
      await user.keyboard('{Escape}');
      const ownerCell = screen.getByText('Olivia Owner').closest('tr') as HTMLElement;
      const ownerMenuButton = within(ownerCell).getByRole('button') as HTMLButtonElement;
      expect(ownerMenuButton.disabled).toBe(true);
      // No second confirm for the protected Owner row.
      expect(confirmSpy).toHaveBeenCalledTimes(1);
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it('surfaces backend failures instead of silently swallowing them', async () => {
    const user = userEvent.setup();
    apiDelete.mockResolvedValue({ done: false, body: {}, message: 'Nope.' } as never);
    const confirmSpy = vi.spyOn(Modal, 'confirm').mockImplementation((((config: any) => {
      void (async () => {
        await config.onOk();
      })();
      return { destroy: vi.fn() } as never;
    }) as never));
    try {
      renderPage();
      await screen.findByText('Manny Member');
      const memberCell = screen.getByText('Manny Member').closest('tr') as HTMLElement;
      await user.click(within(memberCell).getByRole('button'));
      await user.click(await screen.findByText('Remove'));
      await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('m-member'));
      // List is NOT refetched on failure, so the rows stay put.
      expect(apiGet).toHaveBeenCalledTimes(1);
    } finally {
      confirmSpy.mockRestore();
    }
  });
});
