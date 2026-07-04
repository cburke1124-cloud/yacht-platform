import { describe, it, expect, beforeEach } from 'vitest';
import { markLoggedIn, markLoggedOut } from '@/app/lib/apiRoot';

describe('auth localStorage marker helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('markLoggedIn sets a truthy non-empty marker under "token"', () => {
    markLoggedIn();
    expect(localStorage.getItem('token')).toBeTruthy();
  });

  it('markLoggedOut clears both the marker and any cached user info', () => {
    localStorage.setItem('token', '1');
    localStorage.setItem('user', '{"id":1}');
    markLoggedOut();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});
