'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { registerUser } from '@/lib/api';
import { initTheme } from '@/lib/theme';
import { Alert, Button, Card, Input } from '@/components/ui';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernamePattern = /^[a-zA-Z0-9_]+$/;

function getPasswordScore(password) {
  if (!password) return 0;

  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  return score;
}

function getStrengthMeta(score) {
  if (score <= 1) {
    return {
      widthClass: 'w-1/4',
      barColor: 'bg-danger',
      labelColor: 'text-danger',
      label: 'Weak',
    };
  }
  if (score === 2) {
    return {
      widthClass: 'w-1/2',
      barColor: 'bg-orange-500',
      labelColor: 'text-orange-500',
      label: 'Fair',
    };
  }
  if (score === 3) {
    return {
      widthClass: 'w-3/4',
      barColor: 'bg-yellow-500',
      labelColor: 'text-yellow-500',
      label: 'Good',
    };
  }
  return {
    widthClass: 'w-full',
    barColor: 'bg-success',
    labelColor: 'text-success',
    label: 'Strong',
  };
}

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    terms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    terms: '',
  });
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    initTheme();
  }, []);

  useEffect(() => {
    if (!successMessage) return;

    const timer = setTimeout(() => {
      router.push('/login?message=Account%20created%2C%20please%20sign%20in');
    }, 1500);

    return () => clearTimeout(timer);
  }, [router, successMessage]);

  const mutation = useMutation({
    mutationFn: ({ username, email, password }) => registerUser({ username, email, password }),
    onSuccess: () => {
      setServerError('');
      setSuccessMessage('Account created successfully.');
    },
    onError: (error) => {
      setSuccessMessage('');
      setServerError(error?.message || 'Unable to create account. Please try again.');
    },
  });

  const validateForm = () => {
    const errors = {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      terms: '',
    };

    if (!formData.username.trim()) {
      errors.username = 'Username is required.';
    } else if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters.';
    } else if (formData.username.length > 20) {
      errors.username = 'Username must be at most 20 characters.';
    } else if (!usernamePattern.test(formData.username)) {
      errors.username = 'Only letters, numbers, and underscores are allowed.';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required.';
    } else if (!emailPattern.test(formData.email)) {
      errors.email = 'Enter a valid email address.';
    }

    if (!formData.password) {
      errors.password = 'Password is required.';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    } else if (!/[A-Z]/.test(formData.password)) {
      errors.password = 'Password must include at least one uppercase letter.';
    } else if (!/[0-9]/.test(formData.password)) {
      errors.password = 'Password must include at least one number.';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Confirm password is required.';
    } else if (formData.confirmPassword !== formData.password) {
      errors.confirmPassword = 'Passwords must match exactly.';
    }

    if (!formData.terms) {
      errors.terms = 'You must agree to the terms to continue.';
    }

    setFieldErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    if (serverError) setServerError('');
    if (successMessage) setSuccessMessage('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    mutation.mutate({
      username: formData.username,
      email: formData.email,
      password: formData.password,
    });
  };

  const strengthScore = getPasswordScore(formData.password);
  const strength = getStrengthMeta(strengthScore);

  return (
    <main className="min-h-screen bg-surface px-4 py-6 dark:bg-surface-3 sm:flex sm:items-center sm:justify-center sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-none sm:max-w-sm">
        <div className="mb-6 text-center sm:mb-7">
          <Link href="/" className="text-2xl font-bold text-primary">
            6:10 Assistant
          </Link>
          <p className="mt-3 text-lg font-semibold text-primary dark:text-primary">Create your account</p>
          <p className="mt-1 text-sm text-text-secondary dark:text-text-secondary">Join the Ridgeway Site operations team</p>
        </div>

        <Card className="min-h-[78vh] rounded-b-none rounded-t-2xl border-border bg-surface px-4 py-6 shadow-none dark:bg-surface-2 sm:min-h-0 sm:rounded-xl sm:shadow-md">
          {serverError ? <Alert type="danger" className="mb-4" message={serverError} /> : null}
          {successMessage ? <Alert type="success" className="mb-4" message={successMessage} /> : null}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              id="username"
              name="username"
              label="Username"
              type="text"
              autoComplete="username"
              value={formData.username}
              onChange={(e) => handleFieldChange('username', e.target.value)}
              required
              hint="3 to 20 characters, letters numbers and underscores only"
              error={fieldErrors.username}
              className="dark:bg-surface-3"
              leftIcon={
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.1 0-7 2.1-7 5v1h14v-1c0-2.9-2.9-5-7-5Z"
                    fill="currentColor"
                  />
                </svg>
              }
            />

            <Input
              id="email"
              name="email"
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
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
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

            <div className="space-y-1">
              <div className="flex items-center gap-4">
                <div className="h-1.5 w-full rounded bg-surface-3 dark:bg-surface">
                  <div
                    className={`h-1.5 rounded transition-all duration-150 ${strength.widthClass} ${strength.barColor}`}
                  />
                </div>
                <span className={`text-xs font-medium ${strength.labelColor}`}>{strength.label}</span>
              </div>
            </div>

            <Input
              id="confirmPassword"
              name="confirmPassword"
              label="Confirm password"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={(e) => handleFieldChange('confirmPassword', e.target.value)}
              required
              error={fieldErrors.confirmPassword}
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
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? (
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

            <div>
              <div className="flex items-start gap-2">
                <input
                  id="terms"
                  type="checkbox"
                  checked={formData.terms}
                  onChange={(e) => handleFieldChange('terms', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border bg-surface text-primary-600 focus:ring-2 focus:ring-primary-500/30 dark:bg-surface-3"
                />
                <label htmlFor="terms" className="text-sm text-text-secondary dark:text-text-secondary">
                  I agree to the{' '}
                  <Link href="#terms" className="text-primary hover:underline">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="#privacy" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                </label>
              </div>
              {fieldErrors.terms ? (
                <p className="mt-1.5 text-sm text-danger" role="alert">
                  {fieldErrors.terms}
                </p>
              ) : null}
            </div>

            <Button
              variant="primary"
              className="w-full"
              type="submit"
              isLoading={mutation.isPending}
              loadingText="Creating account"
              disabled={mutation.isPending}
              aria-busy={mutation.isPending}
            >
              Create account
            </Button>
          </form>

          <div className="mt-5 text-center text-sm text-text-secondary dark:text-text-secondary">
            <p>
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
