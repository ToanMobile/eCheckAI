import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, LoginResponse } from '@/types';

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  /** Called after a successful login API response. Persists tokens + user. */
  login: (data: LoginResponse) => void;

  /** Clear all auth state + storage and redirect to /login. */
  logout: () => void;

  /** Update access token (called after token refresh). */
  setAccessToken: (token: string) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: (data: LoginResponse) => {
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);

        set({
          user: data.employee as unknown as User,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          isAuthenticated: true,
        });
      },

      logout: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });

        window.location.href = '/login';
      },

      setAccessToken: (token: string) => {
        localStorage.setItem('access_token', token);
        set({ accessToken: token });
      },
    }),
    {
      name: 'echeck-ai-auth',
      storage: createJSONStorage(() => localStorage),
      // Restore user + tokens from storage on page reload.
      // We also validate isAuthenticated based on stored token existence.
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

/** Selector helpers */
export const selectUser = (state: AuthStore): User | null => state.user;
export const selectIsAuthenticated = (state: AuthStore): boolean =>
  state.isAuthenticated;
export const selectAccessToken = (state: AuthStore): string | null =>
  state.accessToken;
export const selectUserRole = (state: AuthStore): string | null =>
  state.user?.role ?? null;
