'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { loginUser } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminLoginPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({ email: 'admin@ridgeway.com', password: 'jsfj3#fkej_83' });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [serverError, setServerError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState(false);

  useEffect(() => {
    document.title = 'Admin Sign In | Sentinel';
  }, []);

  // Redirect already-authenticated super_admin
  useEffect(() => {
    if (user?.role === 'super_admin') {
      router.replace('/admin/users');
    }
  }, [user, router]);

  const mutation = useMutation({
    mutationFn: ({ email, password }) => loginUser(email, password),
    onSuccess: async (data) => {
      setServerError('');
      const role = data?.user?.role;

      if (role !== 'super_admin') {
        setServerError('This sign-in is for platform admins only. Use the customer sign-in at /login.');
        return;
      }

      setLoginSuccess(true);
      localStorage.setItem('ridgeway_token', data.accessToken);
      if (data.refreshToken) localStorage.setItem('ridgeway_refresh_token', data.refreshToken);
      if (data?.user) {
        localStorage.setItem('ridgeway_user', JSON.stringify(data.user));
        const { useAuthStore } = require('@/store/authStore');
        useAuthStore.getState().setUser(data.user);
      }
      document.cookie = 'ridgeway_auth=1; path=/; max-age=86400; SameSite=Lax';
      document.cookie = `ridgeway_role=${role}; path=/; max-age=86400; SameSite=Lax`;
      router.replace('/admin/users');
    },
    onError: (error) => {
      setLoginSuccess(false);
      setServerError(error?.message || 'Authentication failed. Check credentials and try again.');
    },
  });

  const validate = () => {
    const errors = { email: '', password: '' };
    if (!formData.email.trim()) errors.email = 'Email is required.';
    else if (!emailPattern.test(formData.email)) errors.email = 'Enter a valid email address.';
    if (!formData.password) errors.password = 'Password is required.';
    else if (formData.password.length < 8) errors.password = 'Min 8 characters required.';
    setFieldErrors(errors);
    return !errors.email && !errors.password;
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    if (serverError) setServerError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoginSuccess(false);
    mutation.mutate(formData);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex' }}>

      {/* LEFT PANEL */}
      <aside className="auth-side" style={{
        width: '360px', flexShrink: 0,
        background: 'var(--bg-surface-1)',
        borderRight: '1px solid var(--border-default)',
        display: 'flex', flexDirection: 'column',
        padding: '40px 32px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(35,43,56,0.7) 1px, transparent 1px)',
          backgroundSize: '24px 24px', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '120px',
          background: 'linear-gradient(to bottom, transparent, var(--bg-surface-1))',
          pointerEvents: 'none', zIndex: 2,
        }} />

        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
              <span style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: 'var(--sev-serious)', flexShrink: 0,
              }} />
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600,
                letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fg-1)',
              }}>Sentinel</span>
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--border-default)', marginBottom: '28px', marginTop: '28px' }} />

          {/* Elevated access warning */}
          <div style={{
            background: 'rgba(255,56,56,0.06)',
            border: '1px solid rgba(255,56,56,0.2)',
            padding: '14px 16px',
            marginBottom: '24px',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--sev-serious)', marginBottom: '6px',
            }}>⚠ Elevated access</div>
            <p style={{
              fontFamily: 'var(--font-sans)', fontSize: '12px',
              color: 'var(--fg-3)', lineHeight: 1.5, margin: 0,
            }}>
              This sign-in is for platform administrators only. Site operators and managers use the{' '}
              <Link href="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                customer sign-in
              </Link>.
            </p>
          </div>

          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--fg-4)', marginBottom: '10px',
          }}>Platform Admin Access</div>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: '12px',
            color: 'var(--fg-3)', lineHeight: 1.5,
          }}>
            Manage site users, monitor system health, and access audit logs.
          </p>

          <div style={{
            marginTop: 'auto', paddingTop: '32px',
            fontFamily: 'var(--font-mono)', fontSize: '10px',
            color: 'var(--fg-4)', letterSpacing: '0.06em',
          }}>v0.1 · restricted system · super_admin only</div>
        </div>
      </aside>

      {/* RIGHT FORM PANEL */}
      <section aria-label="Sign-in form" style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', minHeight: '100vh',
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>

          <div style={{ marginBottom: '36px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--sev-serious)',
              padding: '3px 8px',
              background: 'rgba(255,56,56,0.08)',
              border: '1px solid rgba(255,56,56,0.2)',
              marginBottom: '14px',
            }}>
              Platform Admin
            </div>
            <h1 style={{
              fontFamily: 'var(--font-sans)', fontSize: '30px', fontWeight: 500,
              lineHeight: 1.05, letterSpacing: '-0.02em',
              color: 'var(--fg-1)', margin: '0 0 8px',
            }}>Admin sign in</h1>
            <p style={{
              fontFamily: 'var(--font-sans)', fontSize: '13px',
              color: 'var(--fg-3)', lineHeight: 1.5, margin: 0,
            }}>Enter your platform administrator credentials.</p>
          </div>

          {serverError && !loginSuccess && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '8px',
              padding: '10px 14px', marginBottom: '20px',
              background: 'var(--sev-serious-bg)',
              border: '1px solid var(--sev-serious-dim)',
            }}>
              <span style={{
                width: '5px', height: '5px', borderRadius: '50%',
                background: 'var(--sev-serious)', flexShrink: 0, marginTop: '4px',
              }} />
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '11px',
                color: 'var(--sev-serious)',
              }}>{serverError}</span>
            </div>
          )}

          {loginSuccess && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', marginBottom: '20px',
              background: 'var(--sev-harmless-bg)',
              border: '1px solid var(--sev-harmless-dim)',
            }}>
              <span style={{
                width: '5px', height: '5px', borderRadius: '50%',
                background: 'var(--success)', flexShrink: 0,
              }} />
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '11px',
                color: 'var(--success-text)',
              }}>Authenticated — redirecting to admin panel…</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            <div>
              <label htmlFor="admin-email" style={{
                display: 'block',
                fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: fieldErrors.email ? 'var(--sev-serious)' : 'var(--fg-3)',
                marginBottom: '7px',
              }}>Email Address</label>
              <input
                id="admin-email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
                placeholder="admin@sentinel.io"
                className={`auth-field${fieldErrors.email ? ' auth-field-err' : ''}`}
              />
              {fieldErrors.email && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--sev-serious)', marginTop: '5px' }}>
                  {fieldErrors.email}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="admin-password" style={{
                display: 'block',
                fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: fieldErrors.password ? 'var(--sev-serious)' : 'var(--fg-3)',
                marginBottom: '7px',
              }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  required
                  className={`auth-field${fieldErrors.password ? ' auth-field-err' : ''}`}
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute', right: 0, top: 0, bottom: 0,
                    width: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-4)',
                  }}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 3l18 18m-3.5-3.5A10.5 10.5 0 0 1 12 19c-6 0-10-7-10-7a19.2 19.2 0 0 1 5.2-5.6M9.9 5.3A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a19 19 0 0 1-2.6 3.6M14.1 14.1a3 3 0 0 1-4.2-4.2" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                    </svg>
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--sev-serious)', marginTop: '5px' }}>
                  {fieldErrors.password}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              style={{
                marginTop: '4px',
                width: '100%', height: '46px',
                background: 'var(--sev-serious)', color: '#fff',
                border: 'none',
                fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                cursor: 'pointer', transition: 'opacity 150ms',
                opacity: mutation.isPending ? 0.5 : 1,
              }}
            >
              {mutation.isPending ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span className="auth-spinner" />
                  Authenticating…
                </span>
              ) : 'Admin Sign In →'}
            </button>
          </form>

          <div style={{
            marginTop: '28px', paddingTop: '20px',
            borderTop: '1px solid var(--border-hairline)',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '10px',
              color: 'var(--fg-4)', letterSpacing: '0.06em',
            }}>
              Not a platform admin?{' '}
              <Link href="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                Customer sign-in →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        .auth-field {
          width: 100%; box-sizing: border-box; height: 44px;
          padding: 0 14px;
          background: var(--bg-surface-2);
          border: 1px solid var(--border-default);
          color: var(--fg-1);
          font-family: var(--font-mono); font-size: 13px; letter-spacing: 0.02em;
          border-radius: 0;
          transition: border-color 120ms, box-shadow 120ms;
        }
        .auth-field::placeholder { color: var(--fg-4); font-size: 12px; }
        .auth-field:focus {
          border-color: var(--border-focus);
          box-shadow: 0 0 0 1px var(--border-focus), 0 0 14px rgba(184,212,232,0.07);
        }
        .auth-field-err { border-color: var(--sev-serious-dim) !important; }
        .auth-field-err:focus {
          border-color: var(--sev-serious) !important;
          box-shadow: 0 0 0 1px var(--sev-serious), 0 0 8px rgba(255,56,56,0.08) !important;
        }
        .auth-spinner {
          display: inline-block; width: 10px; height: 10px;
          border: 1.5px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: auth-spin 0.7s linear infinite;
        }
        @keyframes auth-spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .auth-side { display: none !important; }
        }
      `}</style>
    </div>
  );
}
