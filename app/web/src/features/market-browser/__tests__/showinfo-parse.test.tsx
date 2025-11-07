import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';
import { useMarketBrowserStore } from '../marketBrowserStore';
import { useParsedShowInfo } from '../parseShowInfo';

function TestHarness({ raw }: { raw: string }) {
  const parts = useParsedShowInfo(raw);
  return <div>{parts}</div>;
}

describe('showinfo parsing', () => {
  it('converts showinfo links and strips scripts', () => {
    const raw = 'Hello <script>alert(1)</script><a href="showinfo:123">Type 123</a> <a href="http://evil">Evil</a>';
    render(<TestHarness raw={raw} />);
    // script content removed
    expect(screen.queryByText('alert(1)')).toBeNull();
    // showinfo link becomes button
    const btn = screen.getByRole('button', { name: 'Type 123' });
    fireEvent.click(btn);
    expect(useMarketBrowserStore.getState().activeTypeId).toBe('123');
    // http link not converted; text should remain but not interactive button
  expect(screen.getByText(/Evil/)).not.toBeNull();
  });
});
