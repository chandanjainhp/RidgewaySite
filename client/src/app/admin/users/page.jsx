'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listAdminUsers,
  listAdminOrgs,
  updateUserRole,
  updateUserStatus,
  deleteUserSessions,
} from '@/lib/api';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  Users,
  Search,
  LogOut,
  UserX,
  UserCheck,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import * as Dialog from '@radix-ui/react-dialog';

// ─── helpers ────────────────────────────────────────────────────────────────

const ROLE_COLOR = {
  super_admin: { background: 'rgba(255,56,56,0.12)',  color: '#ff3838' },
  org_admin:   { background: 'rgba(90,135,168,0.2)',  color: '#b8d4e8' },
  operator:    { background: 'rgba(67,77,92,0.5)',    color: '#6b7686' },
};

const ROLE_AVATAR_BG = {
  super_admin: '#7c3aed',
  org_admin:   '#2563eb',
  operator:    '#334055',
};

function getInitials(username = '') {
  const parts = username.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

function Avatar({ username, role }) {
  const bg = ROLE_AVATAR_BG[role] ?? '#334055';
  return (
    <span
      className="inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-bold flex-shrink-0"
      style={{ backgroundColor: bg }}
    >
      {getInitials(username)}
    </span>
  );
}

function lastLoginLabel(lastLoginAt) {
  if (!lastLoginAt) return 'Never';
  try {
    return formatDistanceToNow(new Date(lastLoginAt), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

const inputStyle = {
  background: 'var(--bg-base)',
  border: '1px solid var(--border-default)',
  color: 'var(--fg-1)',
  borderRadius: '6px',
  padding: '8px 12px',
  fontSize: 'var(--text-sm)',
  outline: 'none',
};

const selectStyle = {
  appearance: 'none',
  background: 'var(--bg-surface-1)',
  border: '1px solid var(--border-default)',
  color: 'var(--fg-2)',
  borderRadius: '6px',
  padding: '7px 12px',
  fontSize: 'var(--text-sm)',
  outline: 'none',
  cursor: 'pointer',
};

// ─── sub-components ──────────────────────────────────────────────────────────

function ForceLogoutPopover({ user, onConfirm, isPending }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors"
          style={{ color: '#e89a2b' }}
          title="Force Logout"
        >
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={6}
          className="z-50 rounded-lg p-4 w-64 text-sm"
          style={{
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <Popover.Arrow style={{ fill: 'var(--border-default)' }} />
          <p className="font-semibold mb-1" style={{ color: 'var(--fg-1)' }}>Force logout?</p>
          <p className="text-xs mb-3" style={{ color: 'var(--fg-3)' }}>
            This will end all active sessions for{' '}
            <strong style={{ color: 'var(--fg-2)' }}>{user.username}</strong> immediately.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-xs rounded transition-colors"
              style={{ border: '1px solid var(--border-default)', color: 'var(--fg-2)', background: 'transparent' }}
            >
              Cancel
            </button>
            <button
              disabled={isPending}
              onClick={async () => { await onConfirm(); setOpen(false); }}
              className="px-3 py-1.5 text-xs rounded disabled:opacity-50 flex items-center gap-1"
              style={{ background: '#e89a2b', color: '#07090c' }}
            >
              {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              Confirm
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function DeactivateDialog({ user, onConfirm, isPending }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors"
          style={{ color: '#ff3838' }}
        >
          <UserX className="w-3.5 h-3.5" />
          Deactivate
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl p-6 w-full max-w-md focus:outline-none"
          style={{
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          }}
        >
          <Dialog.Title className="text-base font-semibold mb-1" style={{ color: 'var(--fg-1)' }}>
            Deactivate user?
          </Dialog.Title>
          <Dialog.Description className="text-sm mb-4" style={{ color: 'var(--fg-3)' }}>
            <span style={{ color: 'var(--fg-2)', fontWeight: 500 }}>{user.username}</span>{' '}
            ({user.email}) will no longer be able to log in.
          </Dialog.Description>
          <p
            className="text-xs rounded-md px-3 py-2 mb-5"
            style={{ color: '#ff3838', background: 'rgba(255,56,56,0.08)', border: '1px solid rgba(255,56,56,0.2)' }}
          >
            This user will no longer be able to log in.
          </p>
          <div className="flex justify-end gap-3">
            <Dialog.Close asChild>
              <button
                className="px-4 py-2 text-sm rounded-lg transition-colors"
                style={{ border: '1px solid var(--border-default)', color: 'var(--fg-2)', background: 'transparent' }}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              disabled={isPending}
              onClick={async () => { await onConfirm(); setOpen(false); }}
              className="px-4 py-2 text-sm rounded-lg disabled:opacity-50 flex items-center gap-2"
              style={{ background: '#ff3838', color: '#fff' }}
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Deactivate
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?._id;

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [listFilter, setListFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [loadingRole, setLoadingRole] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(null);
  const [loadingLogout, setLoadingLogout] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: orgsData } = useQuery({
    queryKey: ['admin-orgs-list'],
    queryFn: () => listAdminOrgs({ limit: 100 }),
  });
  const orgs = orgsData?.orgs ?? orgsData?.data ?? [];

  const { data: usersData, isLoading, isError } = useQuery({
    queryKey: ['admin-users', debouncedSearch, listFilter, roleFilter, statusFilter],
    queryFn: () =>
      listAdminUsers({
        search: debouncedSearch || undefined,
        
        role: roleFilter || undefined,
        isActive: statusFilter === '' ? undefined : statusFilter === 'active',
        limit: 50,
      }),
    keepPreviousData: true,
  });
  const users = usersData?.users ?? usersData?.data ?? [];
  const superAdminCount = users.filter((u) => u.role === 'super_admin').length;

  async function handleRoleChange(userId, newRole) {
    setLoadingRole(userId);
    queryClient.setQueryData(
      ['admin-users', debouncedSearch, listFilter, roleFilter, statusFilter],
      (old) => {
        if (!old) return old;
        const list = old?.users ?? old?.data ?? [];
        const updated = list.map((u) => u._id === userId ? { ...u, role: newRole } : u);
        return old?.users ? { ...old, users: updated } : { ...old, data: updated };
      }
    );
    try {
      await updateUserRole(userId, newRole);
    } catch (err) {
      toast.error(err?.message ?? 'Failed to update role');
      queryClient.invalidateQueries({ queryKey: ['admin-users', debouncedSearch, listFilter, roleFilter, statusFilter] });
    } finally {
      setLoadingRole(null);
    }
  }

  async function handleStatusChange(userId, isActive) {
    setLoadingStatus(userId);
    queryClient.setQueryData(
      ['admin-users', debouncedSearch, listFilter, roleFilter, statusFilter],
      (old) => {
        if (!old) return old;
        const list = old?.users ?? old?.data ?? [];
        const updated = list.map((u) => u._id === userId ? { ...u, isActive } : u);
        return old?.users ? { ...old, users: updated } : { ...old, data: updated };
      }
    );
    try {
      await updateUserStatus(userId, isActive);
      toast.success(isActive ? 'User activated' : 'User deactivated');
    } catch (err) {
      toast.error(err?.message ?? 'Failed to update status');
      queryClient.invalidateQueries({ queryKey: ['admin-users', debouncedSearch, listFilter, roleFilter, statusFilter] });
    } finally {
      setLoadingStatus(null);
    }
  }

  async function handleForceLogout(userId) {
    setLoadingLogout(userId);
    try {
      await deleteUserSessions(userId);
      toast.success('User sessions ended');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err) {
      toast.error(err?.message ?? 'Failed to end sessions');
    } finally {
      setLoadingLogout(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--fg-1)' }}>
          <Users className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          Platform Users
        </h1>
        {usersData && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--fg-4)' }}>
            {users.length} user{users.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* filter bar */}
      <div
        className="p-4 rounded-xl flex flex-wrap gap-3"
        style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-default)' }}
      >
        <div className="flex-1 min-w-48 relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: 'var(--fg-4)' }}
          />
          <input
            type="text"
            placeholder="Search by name or email…"
            style={{ ...inputStyle, paddingLeft: '36px', width: '100%' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select style={selectStyle} value={listFilter} onChange={(e) => setListFilter(e.target.value)}>
          <option value="">All Sites</option>
          {orgs.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
        </select>

        <select style={selectStyle} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="org_admin">Org Admin</option>
          <option value="operator">Operator</option>
        </select>

        <select style={selectStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-default)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr style={{ background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border-default)' }}>
                {['User', 'Site', 'Role', 'Last Login', 'Status', 'Actions'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider ${i === 5 ? 'text-right' : ''}`}
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center" style={{ color: 'var(--fg-4)' }}>
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading users…
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center" style={{ color: 'var(--sev-serious)' }}>
                    Failed to load users.
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center" style={{ color: 'var(--fg-4)' }}>
                    No users match your filters.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isRoleLoading = loadingRole === u._id;
                  const isStatusLoading = loadingStatus === u._id;
                  const isLogoutLoading = loadingLogout === u._id;
                  const isSelf = u._id === currentUserId;
                  const isLastAdmin = u.role === 'super_admin' && superAdminCount <= 1;

                  return (
                    <tr
                      key={u._id}
                      className="transition-colors"
                      style={{
                        borderBottom: '1px solid var(--border-hairline)',
                        opacity: !u.isActive ? 0.55 : 1,
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-2)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar username={u.username} role={u.role} />
                          <div className="min-w-0">
                            <div className="font-medium truncate" style={{ color: 'var(--fg-1)' }}>{u.username}</div>
                            <div className="text-xs truncate" style={{ color: 'var(--fg-3)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3 text-sm" style={{ color: 'var(--fg-2)' }}>
                        {null ?? <span style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>None</span>}
                      </td>

                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="relative">
                            <select
                              style={{
                                ...selectStyle,
                                fontSize: 'var(--text-xs)',
                                padding: '3px 20px 3px 8px',
                                opacity: (isRoleLoading || isSelf || isLastAdmin) ? 0.4 : 1,
                              }}
                              value={u.role}
                              disabled={isRoleLoading || isSelf || isLastAdmin}
                              title={
                                isSelf ? 'Cannot change your own role'
                                : isLastAdmin ? 'Cannot demote the last super admin'
                                : undefined
                              }
                              onChange={(e) => handleRoleChange(u._id, e.target.value)}
                            >
                              <option value="super_admin">Super Admin</option>
                              <option value="org_admin">Org Admin</option>
                              <option value="operator">Operator</option>
                            </select>
                            <ChevronDown
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
                              style={{ color: 'var(--fg-4)' }}
                            />
                          </div>
                          {isRoleLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent)' }} />}
                        </div>
                      </td>

                      <td
                        className="px-5 py-3 whitespace-nowrap"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--fg-3)' }}
                      >
                        {lastLoginLabel(u.lastLoginAt)}
                      </td>

                      <td className="px-5 py-3">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={
                            u.isActive
                              ? { background: 'rgba(125,138,106,0.2)', color: '#7d8a6a' }
                              : { background: 'rgba(67,77,92,0.4)', color: '#6b7686' }
                          }
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end flex-wrap gap-1">
                          {u.isActive ? (
                            <>
                              <ForceLogoutPopover
                                user={u}
                                isPending={isLogoutLoading}
                                onConfirm={() => handleForceLogout(u._id)}
                              />
                              <DeactivateDialog
                                user={u}
                                isPending={isStatusLoading}
                                onConfirm={() => handleStatusChange(u._id, false)}
                              />
                            </>
                          ) : (
                            <>
                              <button
                                disabled={isStatusLoading}
                                onClick={() => handleStatusChange(u._id, true)}
                                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors disabled:opacity-50"
                                style={{ color: '#7d8a6a' }}
                              >
                                {isStatusLoading
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <UserCheck className="w-3.5 h-3.5" />
                                }
                                Activate
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
