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
  resendOrgInvite,
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
  MailIcon,
  ChevronDown,
} from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import * as Dialog from '@radix-ui/react-dialog';

// ─── helpers ────────────────────────────────────────────────────────────────

const ROLE_COLORS = {
  super_admin: '#7c3aed',
  org_admin: '#2563eb',
  operator: '#475569',
};


function getInitials(username = '') {
  const parts = username.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

function Avatar({ username, role }) {
  const bg = ROLE_COLORS[role] ?? '#475569';
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

// ─── sub-components ──────────────────────────────────────────────────────────

function ForceLogoutPopover({ user, onConfirm, isPending }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-800 text-xs font-medium px-2 py-1 rounded hover:bg-amber-50 transition-colors"
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
          className="z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-64 text-sm"
        >
          <Popover.Arrow className="fill-white" />
          <p className="font-semibold text-gray-900 mb-1">Force logout?</p>
          <p className="text-gray-500 text-xs mb-3">
            This will end all active sessions for{' '}
            <strong>{user.username}</strong> immediately.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-xs rounded border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              disabled={isPending}
              onClick={async () => {
                await onConfirm();
                setOpen(false);
              }}
              className="px-3 py-1.5 text-xs rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1"
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
        <button className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 text-xs font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors">
          <UserX className="w-3.5 h-3.5" />
          Deactivate
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border border-gray-200 focus:outline-none">
          <Dialog.Title className="text-base font-semibold text-gray-900 mb-1">
            Deactivate user?
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-500 mb-4">
            <span className="font-medium text-gray-800">{user.username}</span>{' '}
            ({user.email}) will no longer be able to log in. This can be
            reversed at any time.
          </Dialog.Description>
          <p className="text-xs text-red-600 bg-red-50 rounded-md px-3 py-2 mb-5">
            This user will no longer be able to log in.
          </p>
          <div className="flex justify-end gap-3">
            <Dialog.Close asChild>
              <button className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">
                Cancel
              </button>
            </Dialog.Close>
            <button
              disabled={isPending}
              onClick={async () => {
                await onConfirm();
                setOpen(false);
              }}
              className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
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

  // filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // per-row loading states
  const [loadingRole, setLoadingRole] = useState(null);   // userId
  const [loadingStatus, setLoadingStatus] = useState(null); // userId
  const [loadingLogout, setLoadingLogout] = useState(null); // userId

  // resend invite cooldown: { [userId]: timestamp }
  const [inviteSent, setInviteSent] = useState({});

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // org list for dropdown
  const { data: orgsData } = useQuery({
    queryKey: ['admin-orgs-list'],
    queryFn: () => listAdminOrgs({ limit: 100 }),
  });
  const orgs = orgsData?.orgs ?? orgsData?.data ?? [];

  // users query
  const { data: usersData, isLoading, isError } = useQuery({
    queryKey: ['admin-users', debouncedSearch, orgFilter, roleFilter, statusFilter],
    queryFn: () =>
      listAdminUsers({
        search: debouncedSearch || undefined,
        orgId: orgFilter || undefined,
        role: roleFilter || undefined,
        isActive:
          statusFilter === ''
            ? undefined
            : statusFilter === 'active',
        limit: 50,
      }),
    keepPreviousData: true,
  });
  const users = usersData?.users ?? usersData?.data ?? [];
  const superAdminCount = users.filter((u) => u.role === 'super_admin').length;

  // ── handlers ──

  async function handleRoleChange(userId, newRole) {
    setLoadingRole(userId);
    // optimistic update
    queryClient.setQueryData(
      ['admin-users', debouncedSearch, orgFilter, roleFilter, statusFilter],
      (old) => {
        if (!old) return old;
        const list = old?.users ?? old?.data ?? [];
        const updated = list.map((u) =>
          u._id === userId ? { ...u, role: newRole } : u
        );
        return old?.users ? { ...old, users: updated } : { ...old, data: updated };
      }
    );
    try {
      await updateUserRole(userId, newRole);
    } catch (err) {
      toast.error(err?.message ?? 'Failed to update role');
      queryClient.invalidateQueries({
        queryKey: ['admin-users', debouncedSearch, orgFilter, roleFilter, statusFilter],
      });
    } finally {
      setLoadingRole(null);
    }
  }

  async function handleStatusChange(userId, isActive) {
    setLoadingStatus(userId);
    // optimistic
    queryClient.setQueryData(
      ['admin-users', debouncedSearch, orgFilter, roleFilter, statusFilter],
      (old) => {
        if (!old) return old;
        const list = old?.users ?? old?.data ?? [];
        const updated = list.map((u) =>
          u._id === userId ? { ...u, isActive } : u
        );
        return old?.users ? { ...old, users: updated } : { ...old, data: updated };
      }
    );
    try {
      await updateUserStatus(userId, isActive);
      toast.success(isActive ? 'User activated' : 'User deactivated');
    } catch (err) {
      toast.error(err?.message ?? 'Failed to update status');
      queryClient.invalidateQueries({
        queryKey: ['admin-users', debouncedSearch, orgFilter, roleFilter, statusFilter],
      });
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

  async function handleResendInvite(user) {
    const orgId = user.orgId?._id ?? user.orgId;
    if (!orgId) {
      toast.error('User has no organisation — cannot resend invite');
      return;
    }
    try {
      await resendOrgInvite(orgId, user._id);
      toast.success(`Invite resent to ${user.email}`);
      setInviteSent((prev) => ({ ...prev, [user._id]: Date.now() }));
    } catch (err) {
      toast.error(err?.message ?? 'Failed to resend invite');
    }
  }

  function isInviteCoolingDown(userId) {
    const ts = inviteSent[userId];
    return ts && Date.now() - ts < 300_000;
  }

  // ── render ──

  const selectBase =
    'border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none';

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-indigo-500" />
          Platform Users
        </h1>
        {usersData && (
          <span className="text-sm text-gray-500">
            {users.length} user{users.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* filter bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-3">
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className={selectBase}
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
        >
          <option value="">All Organisations</option>
          {orgs.map((o) => (
            <option key={o._id} value={o._id}>
              {o.name}
            </option>
          ))}
        </select>

        <select
          className={selectBase}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All Roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="org_admin">Org Admin</option>
          <option value="operator">Operator</option>
        </select>

        <select
          className={selectBase}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs font-semibold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Organisation</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Last Login</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading users…
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-red-500">
                    Failed to load users.
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                    No users match your filters.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isRoleLoading = loadingRole === u._id;
                  const isStatusLoading = loadingStatus === u._id;
                  const isLogoutLoading = loadingLogout === u._id;
                  const inviteCooling = isInviteCoolingDown(u._id);
                  const isSelf = u._id === currentUserId;
                  const isLastAdmin = u.role === 'super_admin' && superAdminCount <= 1;

                  return (
                    <tr
                      key={u._id}
                      className={`transition-colors ${
                        !u.isActive
                          ? 'bg-gray-50 opacity-60'
                          : 'bg-white hover:bg-indigo-50/20'
                      }`}
                    >
                      {/* user */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar username={u.username} role={u.role} />
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate">
                              {u.username}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* org */}
                      <td className="px-5 py-3 text-gray-700 text-sm">
                        {u.orgId?.name ?? (
                          <span className="text-gray-400 italic">None</span>
                        )}
                      </td>

                      {/* role select */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="relative">
                            <select
                              className="text-xs border border-gray-300 rounded px-2 py-1 pr-6 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none disabled:opacity-50 cursor-pointer"
                              value={u.role}
                              disabled={isRoleLoading || isSelf || isLastAdmin}
                              title={
                                isSelf ? 'Cannot change your own role'
                                : isLastAdmin ? 'Cannot demote the last super admin'
                                : undefined
                              }
                              onChange={(e) =>
                                handleRoleChange(u._id, e.target.value)
                              }
                            >
                              <option value="super_admin">Super Admin</option>
                              <option value="org_admin">Org Admin</option>
                              <option value="operator">Operator</option>
                            </select>
                            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                          </div>
                          {isRoleLoading && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                          )}
                        </div>
                      </td>

                      {/* last login */}
                      <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {lastLoginLabel(u.lastLoginAt)}
                      </td>

                      {/* status */}
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* actions */}
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
                                onConfirm={() =>
                                  handleStatusChange(u._id, false)
                                }
                              />
                            </>
                          ) : (
                            <>
                              <button
                                disabled={isStatusLoading}
                                onClick={() => handleStatusChange(u._id, true)}
                                className="inline-flex items-center gap-1 text-green-600 hover:text-green-800 text-xs font-medium px-2 py-1 rounded hover:bg-green-50 transition-colors disabled:opacity-50"
                              >
                                {isStatusLoading ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserCheck className="w-3.5 h-3.5" />
                                )}
                                Activate
                              </button>
                              <button
                                disabled={inviteCooling}
                                onClick={() => handleResendInvite(u)}
                                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-medium px-2 py-1 rounded hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                title={
                                  inviteCooling
                                    ? 'Invite sent — wait 5 min before resending'
                                    : 'Resend invite'
                                }
                              >
                                <MailIcon className="w-3.5 h-3.5" />
                                {inviteCooling ? 'Sent' : 'Resend Invite'}
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
