'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Settings, Key, Users, Webhook, Plug, BookOpen, Lock } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const ALL_NAV_ITEMS = [
  { name: 'General',      path: '/settings/general',      icon: Settings, adminOnly: false },
  { name: 'API Keys',     path: '/settings/api-keys',     icon: Key,      adminOnly: false },
  { name: 'Members',      path: '/settings/members',      icon: Users,    adminOnly: true  },
  { name: 'Documents',    path: '/settings/documents',    icon: BookOpen, adminOnly: false },
  { name: 'Webhooks',     path: '/settings/webhooks',     icon: Webhook,  adminOnly: true  },
  { name: 'Integrations', path: '/settings/integrations', icon: Plug,     adminOnly: false },
];

export default function SettingsLayout({ children }) {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.role);
  const isAdmin = role === 'org_admin' || role === 'super_admin';
  const navItems = ALL_NAV_ITEMS;

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      {/* Sidebar */}
      <div className="w-56 bg-slate-900 text-slate-100 flex flex-col shadow-xl flex-shrink-0">
        <div className="p-5 border-b border-slate-800">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Ridgeway</div>
          <div className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-400" />
            Settings
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
            const Icon = item.icon;
            const isDisabled = item.adminOnly && !isAdmin;
            return (
              <Link
                key={item.name}
                href={item.path}
                onClick={(e) => { if (isDisabled) e.preventDefault(); }}
                className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : isDisabled
                      ? 'text-slate-500 cursor-not-allowed'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`mr-3 h-4 w-4 flex-shrink-0 ${isActive ? 'text-indigo-400' : isDisabled ? 'text-slate-400' : 'text-slate-400'}`} />
                {item.name}
                {isDisabled && <Lock className="ml-2 h-3 w-3 text-slate-400" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <Link
            href="/investigate"
            className="flex items-center px-3 py-2 text-sm font-medium text-slate-300 rounded-md hover:bg-slate-800 hover:text-white transition-colors"
          >
            ← Back to Product
          </Link>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
        <div className="mx-auto max-w-4xl">
          {children}
        </div>
      </div>
    </div>
  );
}
