import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams('user_type=private'),
}));

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: () => Promise.resolve({}),
}));

vi.mock('@stripe/react-stripe-js', () => ({
  EmbeddedCheckoutProvider: ({ children, options }: any) => (
    <div data-testid="embedded-checkout-provider">
      <button data-testid="simulate-complete" onClick={() => options.onComplete()}>
        simulate complete
      </button>
      {children}
    </div>
  ),
  EmbeddedCheckout: () => <div data-testid="embedded-checkout" />,
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import RegisterPage from '../page';

describe('Register page pay-first embedded checkout', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    pushMock.mockReset();
  });

  it('starts checkout without creating an account, then finalizes registration on payment completion', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ client_secret: 'cs_test_123_secret', session_id: 'cs_test_123' }),
    });

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

    // Exactly one call so far: start-registration-checkout. No /auth/register
    // call at all — no account should exist yet.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [firstUrl, firstInit] = fetchMock.mock.calls[0];
    expect(firstUrl).toContain('/payments/start-registration-checkout');
    expect(firstInit.headers.Authorization).toBeUndefined();
    const firstBody = JSON.parse(firstInit.body);
    expect(firstBody.email).toBe('test@example.com');
    expect(firstBody.user_type).toBe('private');
    expect(firstBody.return_url).toContain('payment=complete');

    // Now simulate Stripe's embedded Checkout finishing the payment.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'tok_abc', token_type: 'bearer', subscription_tier: 'private_active' }),
    });
    fireEvent.click(screen.getByTestId('simulate-complete'));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/dashboard');
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [secondUrl, secondInit] = fetchMock.mock.calls[1];
    expect(secondUrl).toContain('/payments/finalize-registration');
    expect(JSON.parse(secondInit.body)).toEqual({ session_id: 'cs_test_123' });
  });
});
