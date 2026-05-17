'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Settings, Key, Users, Webhook, Plug, BookOpen, Lock } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const MONO = 'var(--font-mono)';
const SANS = 'var(--font-sans)';

const ALL_NAV_ITEMS = [
  { name: 'General',      path: '/settings/general',      icon: Settings, adminOnly: false, helpAnchor: null },
  { name: 'API Keys',     path: '/settings/api-keys',     icon: Key,      adminOnly: false, helpAnchor: '#drones' },
  { name: 'Members',      path: '/settings/members',      icon: Users,    adminOnly: true,  helpAnchor: null },
  { name: 'Documents',    path: '/settings/documents',    icon: BookOpen, adminOnly: false, helpAnchor: '#security' },
  { name: 'Webhooks',     path: '/settings/webhooks',     icon: Webhook,  adminOnly: true,  helpAnchor: '#webhooks' },
  { name: 'Integrations', path: '/settings/integrations', icon: Plug,     adminOnly: false, helpAnchor: '#mcp' },
];

export default function SettingsLayout({ children }) {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  const orgName = useAuthStore((s) => s.orgName);
  const isAdmin = role === 'org_admin' || role === 'super_admin';

  function formatRole(r) {
    if (r === 'super_admin') return 'Super Admin';
    if (r === 'org_admin') return 'Org Admin';
    if (r === 'operator') return 'Operator';
    return r || '';
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Sidebar */}
      <div style={{
        width: '220px',
        flexShrink: 0,
        background: 'var(--bg-surface-1)',
        borderRight: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: '56px',
        height: 'calc(100vh - 56px)',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid var(--border-hairline)',
        }}>
          <div style={{
            fontFamily: MONO,
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--fg-3)',
          }}>
            Settings
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px' }}>
          {ALL_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
            const Icon = item.icon;
            const isDisabled = item.adminOnly && !isAdmin;
            return (
              <Link
                key={item.name}
                href={item.path}
                onClick={(e) => { if (isDisabled) e.preventDefault(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  marginBottom: '2px',
                  borderRadius: '2px',
                  borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  background: isActive ? 'var(--bg-surface-3)' : 'transparent',
                  color: isActive ? 'var(--fg-1)' : isDisabled ? 'var(--fg-4)' : 'var(--fg-3)',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  textDecoration: 'none',
                  fontFamily: SANS,
                  fontSize: '13px',
                  transition: 'background 120ms, color 120ms',
                }}
                onMouseEnter={(e) => {
                  if (!isActive && !isDisabled) {
                    e.currentTarget.style.color = 'var(--fg-2)';
                    e.currentTarget.style.background = 'var(--bg-surface-2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive && !isDisabled) {
                    e.currentTarget.style.color = 'var(--fg-3)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <Icon size={14} style={{ flexShrink: 0, opacity: isDisabled ? 0.4 : 0.7 }} />
                {item.name}
                {isDisabled && <Lock size={10} style={{ marginLeft: 'auto', opacity: 0.4 }} />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: back link + org/role info */}
        <div style={{
          padding: '12px',
          borderTop: '1px solid var(--border-hairline)',
        }}>
          <Link
            href="/overview"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 10px',
              fontFamily: MONO,
              fontSize: '10px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--fg-3)',
              textDecoration: 'none',
              transition: 'color 120ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg-1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-3)'; }}
          >
            ← Dashboard
          </Link>
          {(orgName || user?.email) && (
            <div style={{
              marginTop: '8px',
              padding: '8px 10px',
              background: 'var(--bg-surface-2)',
              borderRadius: '2px',
              border: '1px solid var(--border-hairline)',
            }}>
              {orgName && (
                <div style={{
                  fontFamily: SANS,
                  fontSize: '12px',
                  color: 'var(--fg-2)',
                  marginBottom: '2px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {orgName}
                </div>
              )}
              {role && (
                <div style={{
                  fontFamily: MONO,
                  fontSize: '9px',
                  color: 'var(--fg-4)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>
                  {formatRole(role)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        minWidth: 0,
        overflowY: 'auto',
        background: 'var(--bg-base)',
        padding: '32px 24px',
      }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          {/* Breadcrumb header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            marginBottom: '24px',
            fontFamily: MONO, fontSize: '10px',
            letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            <span style={{ color: 'var(--fg-3)' }}>Settings</span>
            {(() => {
              const current = ALL_NAV_ITEMS.find(
                (n) => pathname === n.path || pathname.startsWith(n.path + '/')
              );
              if (!current) return null;
              return (
                <>
                  <span style={{ color: 'var(--fg-4)' }}>/</span>
                  <span style={{ color: 'var(--fg-1)' }}>{current.name}</span>
                  {current.helpAnchor && (
                    <Link
                      href={`/docs${current.helpAnchor}`}
                      style={{
                        marginLeft: '12px',
                        color: 'var(--accent)',
                        textDecoration: 'none',
                        fontSize: '10px',
                      }}
                    >
                      ? Learn more
                    </Link>
                  )}
                </>
              );
            })()}
            {orgName && (
              <>
                <span style={{ flex: 1 }} />
                <span style={{ color: 'var(--fg-4)' }}>{orgName}</span>
              </>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
