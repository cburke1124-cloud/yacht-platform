import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })) as any);

import RegisterPage from '../page';

describe('Register page', () => {
  it('renders and every visible text input has a label wired via htmlFor/id', async () => {
    render(<RegisterPage />);

    // Regression guard for the htmlFor/id accessibility fix from the previous pass.
    const nameInputs = [
      'First Name',
      'Last Name',
      'Brokerage / Company Name',
      'Email Address',
      'Password',
      'Confirm Password',
    ];
    for (const label of nameInputs) {
      const matches = await screen.findAllByText(new RegExp(label));
      expect(matches.length).toBeGreaterThan(0);
    }

    // Spot check one label -> input association directly.
    const emailLabel = screen.getByText(/Email Address/);
    const forAttr = emailLabel.getAttribute('for');
    expect(forAttr).toBeTruthy();
    expect(document.getElementById(forAttr!)).not.toBeNull();
  });
});
