import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams('user_type=private'),
}));

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: () => Promise.resolve({}),
}));

vi.mock('@stripe/react-stripe-js', () => ({
  EmbeddedCheckoutProvider: ({ children }: any) => <div data-testid="embedded-checkout-provider">{children}</div>,
  EmbeddedCheckout: () => <div data-testid="embedded-checkout" />,
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import RegisterPage from '../page';

describe('Register page embedded checkout', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('swaps the registration form for EmbeddedCheckout after account creation + session creation', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok_123' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ client_secret: 'cs_test_123', session_id: 'cs_test_123' }) });

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/First Name/), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/Last Name/), { target: { value: 'Seller' } });
    fireEvent.change(screen.getByLabelText(/Email Address/), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'testpass123' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/), { target: { value: 'testpass123' } });
    fireEvent.click(screen.getByLabelText(/I agree to the/));
    fireEvent.click(screen.getByLabelText(/I agree to receive/));

    fireEvent.click(screen.getByRole('button', { name: /Register Account/ }));

    await waitFor(() => {
      expect(screen.getByTestId('embedded-checkout')).toBeInTheDocument();
    });

    expect(screen.getByText('Complete Your Payment')).toBeInTheDocument();
    expect(screen.queryByLabelText(/First Name/)).not.toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [secondUrl, secondInit] = fetchMock.mock.calls[1];
    expect(secondUrl).toContain('/payments/create-private-setup-fee-session');
    const body = JSON.parse(secondInit.body);
    expect(body.embedded).toBe(true);
    expect(body.return_url).toContain('/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}');
  });
});
