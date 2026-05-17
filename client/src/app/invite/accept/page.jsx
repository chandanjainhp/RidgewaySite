'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '../../../lib/api';
import { ShieldCheck, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Suspense } from 'react';

function InviteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();
  const setUser = useAuthStore(state => state.setUser);

  const [status, setStatus] = useState('loading'); // loading, valid, invalid, expired
  const [inviteDetails, setInviteDetails] = useState(null);
  const [expiredEmail, setExpiredEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }

    const validateToken = async () => {
      try {
        const res = await api.get(`/auth/invite/${token}`);
        setInviteDetails(res);
        setStatus('valid');
      } catch (err) {
        const email = err.response?.data?.data?.email || '';
        setExpiredEmail(email);
        if (err.response?.data?.message?.includes('expired') || err.message?.includes('expired')) {
          setStatus('expired');
        } else {
          setStatus('invalid');
        }
      }
    };

    validateToken();
  }, [token]);

  const validatePassword = () => {
    if (password.length < 12) return false;
    if (!/[0-9]/.test(password)) return false;
    if (!/[!@#$%^&*.,_-]/.test(password)) return false;
    if (password !== confirmPassword) return false;
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validatePassword()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const data = await api.post('/auth/accept-invite', { token, password });
      if (data.accessToken) {
        localStorage.setItem('ridgeway_token', data.accessToken);
        if (data.refreshToken) localStorage.setItem('ridgeway_refresh_token', data.refreshToken);
        document.cookie = 'ridgeway_auth=1; path=/; max-age=86400; SameSite=Lax';
      }
      if (data.user) {
        localStorage.setItem('ridgeway_user', JSON.stringify(data.user));
        setUser(data.user);
        if (data.user.role) {
          document.cookie = `ridgeway_role=${data.user.role}; path=/; max-age=86400; SameSite=Lax`;
        }
      }
      document.cookie = 'ridgeway_setup=1; path=/; max-age=86400; SameSite=Lax';
      router.replace('/investigate');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept invite. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        <p className="text-sm font-medium text-gray-500">Verifying your invite…</p>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <AlertCircle className="h-6 w-6 text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Invite link expired</h2>
        {expiredEmail && <p className="text-sm font-medium text-gray-700">{expiredEmail}</p>}
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Your invitation link has expired. For security, links are only valid for 48 hours.
          Please contact your administrator to request a new invite.
        </p>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <AlertCircle className="h-6 w-6 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Invalid Invite Link</h2>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          This invitation link is not valid or has already been used. Please check that you copied the full link from your email.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Welcome to Sentinel</h2>
        <p className="mt-2 text-sm text-gray-500">
          You've been invited to join <span className="font-semibold text-gray-900">{inviteDetails?.orgName}</span> as <span className="font-medium text-gray-900">{inviteDetails?.email}</span>.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-50 text-red-800 text-sm p-3 rounded-md flex items-start">
            <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Set a password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <ul className="mt-2 text-xs text-gray-500 space-y-1">
            <li className={password.length >= 12 ? 'text-green-600' : ''}>• At least 12 characters</li>
            <li className={/[0-9]/.test(password) ? 'text-green-600' : ''}>• At least one number</li>
            <li className={/[!@#$%^&*.,_-]/.test(password) ? 'text-green-600' : ''}>• At least one special character</li>
          </ul>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
          <input
            type="password"
            required
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
              confirmPassword && password !== confirmPassword ? 'border-red-300' : 'border-gray-300'
            }`}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••••••"
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !validatePassword()}
          className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Setting up your account...' : 'Set up your account'}
        </button>
      </form>
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-indigo-600" />
        <h1 className="mt-2 text-3xl font-extrabold text-gray-900 tracking-tight">Sentinel</h1>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-gray-100">
          <Suspense fallback={<div className="text-center text-sm text-gray-500">Loading...</div>}>
            <InviteContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
