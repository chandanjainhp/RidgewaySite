'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { Building2, Users, Key, Activity, ShieldCheck, ArrowLeft, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api, { clearStoredToken } from '../../lib/api';

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const router = useRouter();

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
    router.push('/login');
  };

  const navItems = [
    { name: 'Organisations', path: '/admin/orgs', icon: Building2 },
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'API Keys', path: '/admin/apikeys', icon: Key },
    { name: 'Jobs', path: '/admin/jobs', icon: Activity },
    { name: 'Audit Log', path: '/admin/audit', icon: ShieldCheck },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-slate-100 flex flex-col shadow-xl">
        <div className="p-6 border-b border-slate-800">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Ridgeway</div>
          <div className="text-xl font-bold tracking-tight text-white flex items-center">
            <ShieldCheck className="w-5 h-5 mr-2 text-indigo-400" />
            Admin Panel
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-3">
            {navItems.map((item) => {
              const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.path}
                  className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-indigo-500/10 text-indigo-400'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className={`mr-3 h-5 w-5 flex-shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <Link
            href="/investigate"
            className="flex items-center px-3 py-2 text-sm font-medium text-slate-300 rounded-md hover:bg-slate-800 hover:text-white transition-colors"
          >
            <ArrowLeft className="mr-3 h-5 w-5 text-slate-400" />
            Back to Product
          </Link>
          
          <div className="pt-4 mt-4 border-t border-slate-800/50 flex items-center justify-between px-3">
            <div className="flex flex-col truncate">
              <span className="text-sm font-medium text-white truncate">{user?.username}</span>
              <span className="text-xs text-slate-400 truncate">Super Admin</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-colors"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
