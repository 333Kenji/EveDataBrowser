import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, expect, it } from 'vitest';

import { DropdownSearchPage } from '../pages/DropdownSearchPage';

expect.extend(toHaveNoViolations);

describe('Dropdown search accessibility', () => {
  it('renders without axe violations', async () => {
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
        <DropdownSearchPage />
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
