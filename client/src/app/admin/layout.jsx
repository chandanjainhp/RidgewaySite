'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { Building2, Users, Key, Activity, ShieldCheck, ArrowLeft, LogOut, Sliders } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api, { clearStoredToken } from '../../lib/api';

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const router = useRouter();

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.error(e);
    }
    useAuthStore.getState().clearUser();
    clearStoredToken();
    document.cookie = 'ridgeway_auth=; path=/; max-age=0; SameSite=Lax';
    document.cookie = 'ridgeway_role=; path=/; max-age=0; SameSite=Lax';
    document.cookie = 'ridgeway_setup=; path=/; max-age=0; SameSite=Lax';
    router.replace('/');
  };

  const navItems = [
    { name: 'Organisations', path: '/admin/orgs', icon: Building2 },
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'API Keys', path: '/admin/apikeys', icon: Key },
    { name: 'Jobs', path: '/admin/jobs', icon: Activity },
    { name: 'Audit Log', path: '/admin/audit', icon: ShieldCheck },
    { name: 'Setup / Ingest', path: '/admin/setup', icon: Sliders },
  ];

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--fg-1)' }}>
      {/* Sidebar */}
      <div
        className="w-64 flex flex-col flex-shrink-0"
        style={{ background: 'var(--bg-surface-1)', borderRight: '1px solid var(--border-default)' }}
      >
        <div className="p-6" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <div
            className="text-xs font-bold uppercase tracking-wider mb-1"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', letterSpacing: '0.1em' }}
          >
            Sentinel
          </div>
          <div className="text-xl font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--fg-1)' }}>
            <ShieldCheck className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            Admin Panel
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-0.5 px-3">
            {navItems.map((item) => {
              const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.path}
                  className="flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-all"
                  style={{
                    background: isActive ? 'rgba(184,212,232,0.08)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--fg-2)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--bg-surface-3)';
                      e.currentTarget.style.color = 'var(--fg-1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--fg-2)';
                    }
                  }}
                >
                  <Icon
                    className="mr-3 h-4 w-4 flex-shrink-0"
                    style={{ color: isActive ? 'var(--accent)' : 'var(--fg-3)' }}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4" style={{ borderTop: '1px solid var(--border-default)' }}>
          <Link
            href="/investigate"
            className="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all"
            style={{ color: 'var(--fg-3)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-surface-3)';
              e.currentTarget.style.color = 'var(--fg-1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--fg-3)';
            }}
          >
            <ArrowLeft className="mr-3 h-4 w-4" style={{ color: 'var(--fg-4)' }} />
            Back to Product
          </Link>

          <div
            className="mt-3 pt-3 flex items-center justify-between px-3"
            style={{ borderTop: '1px solid var(--border-hairline)' }}
          >
            <div className="flex flex-col truncate">
              <span className="text-sm font-medium truncate" style={{ color: 'var(--fg-1)' }}>
                {user?.username}
              </span>
              <span
                className="text-xs truncate"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', fontSize: 'var(--text-xs)' }}
              >
                SUPER ADMIN
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md transition-colors"
              style={{ color: 'var(--fg-3)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-surface-3)';
                e.currentTarget.style.color = 'var(--sev-serious)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--fg-3)';
              }}
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-8" style={{ background: 'var(--bg-base)' }}>
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
