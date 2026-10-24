import { describe, expect, it, vi } from 'vitest';

vi.mock('@/addons/addon-slots', () => ({
  getAddonSlotItems: () => [],
}));

describe('navbar routes', () => {
  it('does not exclude the client portal on self-hosted deployments', async () => {
    const { navRoutes } = await import('./navRoutes');
    const clientPortal = navRoutes.find(route => route.name === 'client-portal');

    expect(clientPortal).toBeDefined();
    expect(clientPortal?.selfHostedExcluded).not.toBe(true);
  });
});
