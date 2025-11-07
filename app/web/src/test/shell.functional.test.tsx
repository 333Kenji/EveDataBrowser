import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from '../components/Layout/Layout';
import type { NavigationItem } from '../components/Navigation/NavMenu';
vi.mock('../components/StatusIndicator/StatusIndicator', () => ({
  StatusIndicator: () => <div data-testid="status-indicator">API status stable</div>,
}));

describe('Shell layout', () => {
  let items: NavigationItem[];

  beforeEach(() => {
    items = [
      { path: '/market-browser', label: 'Market Browser', description: 'Ship + blueprint views' },
    ];
  });

  function renderShell(initialPath = '/') {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
        },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/" element={<Layout items={items} />}>
              <Route index element={<div>Market Browser content</div>} />
              <Route path="market-browser" element={<div>Market Browser content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('renders navigation and routes between shell sections', async () => {
    const user = userEvent.setup();
    renderShell();

    expect(screen.getByTestId('shell-layout')).not.toBeNull();
    expect(screen.getByText('EVE Data Viewer')).not.toBeNull();
  // Compact indicator now rendered; full verbose indicator mounted offscreen for reuse.
  expect(screen.getByTestId('status-indicator-compact')).toBeTruthy();

    const navLinks = screen.getAllByRole('link');
    expect(navLinks).toHaveLength(1);
    expect(navLinks[0].textContent).toContain('Market Browser');

    // Search now always visible in lean mode
    expect(screen.getByLabelText('Market navigation search')).not.toBeNull();

    expect(screen.getByText('Market Browser content')).not.toBeNull();

    await user.click(screen.getByRole('link', { name: /Market Browser/i }));

    await waitFor(() => {
      expect(screen.getByText('Market Browser content')).not.toBeNull();
    });
  });
});
