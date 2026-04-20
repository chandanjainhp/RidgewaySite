'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { loginUser } from '@/lib/api';
import { initTheme } from '@/lib/theme';
import { Alert, Button, Card, Input } from '@/components/ui';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [serverError, setServerError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState(false);

  useEffect(() => {
    initTheme();
  }, []);

  const mutation = useMutation({
    mutationFn: ({ email, password }) => loginUser(email, password),
    onSuccess: (data) => {
      setServerError('');
      setLoginSuccess(true);
      localStorage.setItem('ridgeway_token', data.accessToken);
      localStorage.setItem('ridgeway_refresh_token', data.refreshToken);
      if (data?.user) {
        localStorage.setItem('ridgeway_user', JSON.stringify(data.user));
      }
      document.cookie = 'ridgeway_auth=1; path=/; max-age=86400; SameSite=Lax';
      router.push('/investigate');
    },
    onError: (error) => {
      setLoginSuccess(false);
      setServerError(error?.message || 'Unable to sign in. Please try again.');
    },
  });

  const validateForm = () => {
    const errors = { email: '', password: '' };

    if (!formData.email.trim()) {
      errors.email = 'Email is required.';
    } else if (!emailPattern.test(formData.email)) {
      errors.email = 'Enter a valid email address.';
    }

    if (!formData.password) {
      errors.password = 'Password is required.';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }

    setFieldErrors(errors);
    return !errors.email && !errors.password;
  };

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    if (serverError) setServerError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoginSuccess(false);
    mutation.mutate(formData);
  };

  return (
    <main className="min-h-screen bg-surface px-4 py-6 dark:bg-surface-3 sm:flex sm:items-center sm:justify-center sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-none sm:max-w-sm">
        <div className="mb-6 text-center sm:mb-7">
          <Link href="/" className="text-2xl font-bold text-primary">
            6:10 Assistant
          </Link>
          <p className="mt-3 text-lg font-semibold text-primary dark:text-primary">Welcome back</p>
          <p className="mt-1 text-sm text-text-secondary dark:text-text-secondary">Sign in to your account</p>
        </div>

        <Card className="min-h-[78vh] rounded-b-none rounded-t-2xl border-border bg-surface px-4 py-6 shadow-none dark:bg-surface-2 sm:min-h-0 sm:rounded-xl sm:shadow-md">
          {serverError ? <Alert type="danger" className="mb-4" message={serverError} /> : null}
          {loginSuccess ? <Alert type="success" className="mb-4" message="Redirecting to dashboard." /> : null}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              id="email"
              label="Email address"
              type="email"
              autoComplete="email"
              value={formData.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              required
              error={fieldErrors.email}
              className="dark:bg-surface-3"
              leftIcon={
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm0 2 8 5 8-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            />

            <Input
              id="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={formData.password}
              onChange={(e) => handleFieldChange('password', e.target.value)}
              required
              error={fieldErrors.password}
              className="dark:bg-surface-3"
              leftIcon={
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M7 10V8a5 5 0 1 1 10 0v2m-9 0h8a2 2 0 0 1 2 2v7H6v-7a2 2 0 0 1 2-2Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
              rightIcon={
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded text-text-secondary hover:text-text-primary"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <path
                        d="M3 3l18 18m-3.5-3.5A10.5 10.5 0 0 1 12 19c-6 0-10-7-10-7a19.2 19.2 0 0 1 5.2-5.6M9.9 5.3A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a19 19 0 0 1-2.6 3.6M14.1 14.1a3 3 0 0 1-4.2-4.2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <path
                        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              }
            />

            <Button
              variant="primary"
              className="w-full"
              type="submit"
              isLoading={mutation.isPending}
              loadingText="Signing in"
              disabled={mutation.isPending}
              aria-busy={mutation.isPending}
            >
              Sign in
            </Button>
          </form>

          <div className="mt-5 space-y-2 text-center text-sm text-text-secondary dark:text-text-secondary">
            <button type="button" className="text-primary hover:underline">
              Forgot your password?
            </button>
            <p>
              Don't have an account?{' '}
              <Link href="/register" className="font-medium text-primary hover:underline">
                Register
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
