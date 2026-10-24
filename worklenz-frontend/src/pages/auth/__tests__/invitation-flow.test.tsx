import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';

import LoginPage from '../LoginPage';
import SignupPage from '../SignupPage';
import { login, signUp } from '@/features/auth/authSlice';
import { authApiService } from '@/api/auth/auth.api.service';

// Mock dependencies (union of what LoginPage and SignupPage need)
vi.mock('@/features/auth/authSlice', () => ({
  login: vi.fn(),
  signUp: vi.fn(),
  verifyAuthentication: vi.fn(),
}));

vi.mock('@/features/user/userSlice', () => ({
  setUser: vi.fn(),
}));

vi.mock('@/api/auth/auth.api.service', () => ({
  authApiService: {
    signUpCheck: vi.fn(),
    verifyRecaptchaToken: vi.fn(),
  },
}));

vi.mock('@/utils/session-helper', () => ({
  setSession: vi.fn(),
  getUserSession: vi.fn().mockReturnValue(null),
}));

vi.mock('@/utils/errorLogger', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('@/hooks/useMixpanelTracking', () => ({
  useMixpanelTracking: () => ({
    trackMixpanelEvent: vi.fn(),
  }),
}));

vi.mock('@/hooks/useDoumentTItle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('@/services/alerts/alertService', () => ({
  default: {
    error: vi.fn(),
  },
}));

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock dispatch
const mockDispatch = vi.fn();
vi.mock('@/hooks/useAppDispatch', () => ({
  useAppDispatch: () => mockDispatch,
}));

// Setup i18n for testing (both auth namespaces)
i18n.init({
  lng: 'en',
  resources: {
    en: {
      'auth/login': {
        headline: 'Welcome back',
        headerDescription: 'Log in to your Worklenz workspace.',
        signInWithLabel: 'Sign in with',
        orText: 'or',
        emailLabel: 'Email',
        emailPlaceholder: 'you@company.com',
        emailRequired: 'Please enter your email!',
        nextButton: 'Next',
        changeEmailLink: 'Change',
        passwordLabel: 'Password',
        passwordPlaceholder: 'Enter your password',
        passwordRequired: 'Please enter your password!',
        loginButton: 'Log in',
        signupButton: 'Sign up',
        forgotPasswordButton: 'Forgot password?',
        signInWithGoogleButton: 'Google',
        signInWithAppleButton: 'Apple',
        dontHaveAccountText: "Don't have an account?",
        bySigningInText: 'By signing in, you understand and agree to our',
        andText: 'and',
        termsOfServiceLink: 'Terms of Service',
        privacyPolicyLink: 'Privacy Policy',
        successMessage: 'Login successful!',
        'validationMessages.email': 'Please enter a valid email!',
        'validationMessages.password': 'Password must be at least 8 characters!',
        'errorMessages.loginErrorTitle': 'Login Failed',
        'errorMessages.loginErrorMessage': 'Invalid email or password',
      },
      'auth/signup': {
        headline: 'Create your account',
        headerDescription: 'Sign up to get started',
        signUpWithLabel: 'Sign up with',
        orText: 'or',
        nameLabel: 'Full name',
        namePlaceholder: 'Jordan Lee',
        nameRequired: 'Please input your name!',
        nameMinCharacterRequired: 'Name must be at least 4 characters!',
        emailLabel: 'Email',
        emailPlaceholder: 'jordan@acme.com',
        emailRequired: 'Please input your email!',
        passwordLabel: 'Password',
        passwordPlaceholder: 'At least 8 characters',
        passwordRequired: 'Please input your password!',
        passwordMinCharacterRequired: 'Password must be at least 8 characters!',
        passwordMaxCharacterRequired: 'Password must be no more than 32 characters!',
        passwordPatternRequired:
          'Password must contain uppercase, lowercase, number and special character!',
        signupButton: 'Create account',
        signInWithGoogleButton: 'Google',
        signUpWithAppleButton: 'Apple',
        alreadyHaveAccountText: 'Already have an account?',
        loginButton: 'Log in',
        bySigningUpText: 'By creating an account, you agree to our',
        privacyPolicyLink: 'Privacy Policy',
        andText: 'and',
        termsOfUseLink: 'Terms of Service',
        reCAPTCHAVerificationError: 'reCAPTCHA Verification Failed',
        reCAPTCHAVerificationErrorMessage: 'Please try again',
        'passwordChecklist.minLength': 'At least 8 characters',
        'passwordChecklist.uppercase': 'One uppercase letter',
        'passwordChecklist.lowercase': 'One lowercase letter',
        'passwordChecklist.number': 'One number',
        'passwordChecklist.special': 'One special character',
      },
    },
  },
});

// Create test store
const createTestStore = () => {
  return configureStore({
    reducer: {
      auth: (state = { isLoading: false }) => state,
      user: (state = {}) => state,
      themeReducer: (state = { mode: 'light' }) => state,
    },
  });
};

const renderLogin = () => {
  const store = createTestStore();
  return render(
    <Provider store={store}>
      <BrowserRouter>
        <I18nextProvider i18n={i18n}>
          <LoginPage />
        </I18nextProvider>
      </BrowserRouter>
    </Provider>
  );
};

const renderSignup = () => {
  const store = createTestStore();
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>
          <SignupPage />
        </I18nextProvider>
      </MemoryRouter>
    </Provider>
  );
};

const setLocationSearch = (search: string) => {
  Object.defineProperty(window, 'location', {
    value: { search, href: '' },
    writable: true,
  });
};

describe('workspace invitation auth flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubEnv('VITE_ENABLE_GOOGLE_LOGIN', 'true');
    vi.stubEnv('VITE_ENABLE_APPLE_LOGIN', 'true');
    vi.stubEnv('VITE_ENABLE_RECAPTCHA', 'false');
    vi.stubEnv('VITE_API_URL', 'http://localhost:3000');

    // Unauthenticated by default so LoginPage stays put instead of redirecting.
    mockDispatch.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({ authenticated: false }),
    });
    setLocationSearch('');
  });

  it('preserves invitation query params on the login -> signup link', () => {
    setLocationSearch('?team=team-1&user=member-1&project=proj-1');
    renderLogin();

    const signupLink = screen.getByText('Sign up');
    expect(signupLink.closest('a')).toHaveAttribute(
      'href',
      '/auth/signup?team=team-1&user=member-1&project=proj-1'
    );
  });

  it('keeps the plain signup link when there are no invitation params', () => {
    renderLogin();

    const signupLink = screen.getByText('Sign up');
    expect(signupLink.closest('a')).toHaveAttribute('href', '/auth/signup');
  });

  it('preserves invitation query params on the signup -> login link', () => {
    setLocationSearch(
      '?email=vivek%40company.com&name=Vivek&team=team-1&user=member-1&project=proj-1'
    );
    renderSignup();

    const loginLink = screen.getByText('Log in');
    expect(loginLink.closest('a')).toHaveAttribute(
      'href',
      '/auth/login?email=vivek%40company.com&name=Vivek&team=team-1&user=member-1&project=proj-1'
    );
  });

  it('builds a Google OAuth signup URL with a single ? and invitation params', async () => {
    const user = userEvent.setup({ delay: null });
    setLocationSearch('?email=vivek%40company.com&name=Vivek&team=team-1&user=member-1');
    renderSignup();

    await user.click(screen.getByText('Google'));

    const href = (window.location as unknown as { href: string }).href;
    expect(href.startsWith('http://localhost:3000/secure/google?')).toBe(true);
    expect(href).not.toContain('??');
    expect(href).toContain('team=team-1');
    expect(href).toContain('teamMember=member-1');
  });

  it('builds an Apple OAuth signup URL with a single ? and invitation params', async () => {
    const user = userEvent.setup({ delay: null });
    setLocationSearch('?email=vivek%40company.com&name=Vivek&team=team-1&user=member-1');
    renderSignup();

    await user.click(screen.getByText('Apple'));

    const href = (window.location as unknown as { href: string }).href;
    expect(href.startsWith('http://localhost:3000/secure/apple?')).toBe(true);
    expect(href).not.toContain('??');
    expect(href).toContain('team=team-1');
    expect(href).toContain('teamMember=member-1');
  });

  it('blocks signup when the entered email differs from the invited email', async () => {
    const user = userEvent.setup({ delay: null });
    setLocationSearch('?email=vivek%40company.com&name=Vivek&team=team-1&user=member-1');
    renderSignup();

    await user.type(screen.getByPlaceholderText('Jordan Lee'), 'Someone Else');
    await user.type(screen.getByPlaceholderText('jordan@acme.com'), 'someone@else.com');
    await user.type(screen.getByPlaceholderText('At least 8 characters'), 'Password123!');

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(authApiService.signUpCheck).not.toHaveBeenCalled();
    });
    expect(signUp).not.toHaveBeenCalled();
  });

  it('submits the invitation context when the email matches the invite', async () => {
    const user = userEvent.setup({ delay: null });
    (authApiService.signUpCheck as any).mockResolvedValue({ done: true });
    mockDispatch.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({
        authenticated: true,
        user: { id: 'u-1', email: 'vivek@company.com' },
      }),
    });
    setLocationSearch(
      '?email=vivek%40company.com&name=Vivek&team=team-1&user=member-1&project=proj-1'
    );
    renderSignup();

    await user.type(screen.getByPlaceholderText('Jordan Lee'), 'Vivek Kumar');
    // Email is pre-filled from the invitation URL.
    expect(
      (screen.getByPlaceholderText('jordan@acme.com') as HTMLInputElement).value
    ).toBe('vivek@company.com');
    await user.type(screen.getByPlaceholderText('At least 8 characters'), 'Password123!');

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith({
        name: 'Vivek Kumar',
        email: 'vivek@company.com',
        password: 'Password123!',
        team_id: 'team-1',
        team_member_id: 'member-1',
        project_id: 'proj-1',
      });
    });
    expect(login).not.toHaveBeenCalled();
  });
});
