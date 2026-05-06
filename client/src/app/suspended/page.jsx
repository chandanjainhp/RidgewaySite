'use client';

import { ShieldAlert, LogOut } from 'lucide-react';
import { useAuthStore } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';

export default function SuspendedPage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.error(e);
    }
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <ShieldAlert className="h-8 w-8 text-red-600" />
        </div>
        <h2 className="mt-6 text-3xl font-extrabold text-gray-900 tracking-tight">Account Suspended</h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow sm:rounded-xl sm:px-10 border border-red-100 text-center space-y-6">
          <p className="text-gray-600">
            Access to the Ridgeway platform has been temporarily suspended for your organisation {user?.orgId?.name ? `(${user.orgId.name})` : ''}.
          </p>
          
          <div className="bg-red-50 p-4 rounded-md">
            <p className="text-sm text-red-800 font-medium">
              Please contact your platform administrator or account manager to restore access.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex justify-center py-2.5 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 items-center transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
