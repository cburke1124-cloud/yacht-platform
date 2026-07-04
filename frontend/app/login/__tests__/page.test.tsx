import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import LoginPage from '../page';

describe('Login page', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('submits credentials to /auth/login and marks the user logged in on success', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/auth/login')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'server-issued-jwt', token_type: 'bearer' }),
        } as Response);
      }
      if (url.includes('/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ user_type: 'user', agreed_terms: true }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<LoginPage />);

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Email Address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/Password/i), 'TestPass123');
    await user.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    // The real JWT should never be persisted to localStorage — only the
    // non-secret "logged in" marker (see markLoggedIn in apiRoot.ts).
    await waitFor(() => {
      expect(localStorage.getItem('token')).toBe('1');
    });
  });
});
