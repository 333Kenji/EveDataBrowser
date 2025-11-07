import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from '../components/Layout/Layout';
import type { NavigationItem } from '../components/Navigation/NavMenu';

expect.extend(toHaveNoViolations);

vi.mock('../components/StatusIndicator/StatusIndicator', () => ({
  StatusIndicator: () => <div>API status stable</div>,
}));

describe('Shell accessibility', () => {
  it('renders the layout without axe violations', async () => {
    const navigation: NavigationItem[] = [
      { path: '/market-browser', label: 'Market Browser', description: 'Ship + blueprint views' },
    ];

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
        },
      },
    });

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Routes>
            <Route path="/" element={<Layout items={navigation} />}>
              <Route index element={<div>Market Browser</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: false },
      },
    });

    expect(results).toHaveNoViolations();
  });
});
