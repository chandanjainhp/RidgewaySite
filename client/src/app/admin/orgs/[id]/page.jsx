'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Activity,
  ShieldAlert,
  Search,
  Key,
  Users,
  Save,
  UserPlus,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import * as RadioGroup from '@radix-ui/react-radio-group';
import * as Collapsible from '@radix-ui/react-collapsible';
import {
  getAdminOrg,
  updateAdminOrg,
  updateAdminOrgStatus,
  updateAdminOrgConfig,
  inviteToOrg,
  updateUserRole,
  updateUserStatus,
  deleteUserSessions,
  revokeAdminApiKey,
} from '@/lib/api';

// ─── Badge helpers ───────────────────────────────────────────────────────────

function PlanBadge({ plan }) {
  const map = {
    trial: 'bg-gray-100 text-gray-700',
    standard: 'bg-blue-100 text-blue-700',
    enterprise: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${map[plan] ?? 'bg-gray-100 text-gray-700'}`}>
      {plan}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-amber-100 text-amber-700',
    suspended: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${map[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

function RoleBadge({ role }) {
  const map = {
    super_admin: 'bg-purple-100 text-purple-700',
    org_admin: 'bg-blue-100 text-blue-700',
    operator: 'bg-gray-100 text-gray-600',
  };
  const label = role?.replace('_', ' ') ?? role;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${map[role] ?? 'bg-gray-100 text-gray-700'}`}>
      {label}
    </span>
  );
}

// ─── Simple progress bar ─────────────────────────────────────────────────────

function UsageBar({ value, max }) {
  if (!max || max <= 0) return null;
  const pct = Math.min(100, Math.round((value / max) * 100));
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-indigo-500';
  return (
    <div className="mt-2">
      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-1">{value.toLocaleString()} / {max.toLocaleString()} ({pct}%)</p>
    </div>
  );
}

// ─── Edit Plan Dialog ────────────────────────────────────────────────────────

function EditPlanDialog({ org, orgId }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState(org.plan ?? 'trial');

  useEffect(() => {
    if (open) setPlan(org.plan ?? 'trial');
  }, [open, org.plan]);

  const mutation = useMutation({
    mutationFn: () => updateAdminOrg(orgId, { plan }),
    onSuccess: () => {
      toast.success('Plan updated');
      queryClient.invalidateQueries({ queryKey: ['admin-org', orgId] });
      setOpen(false);
    },
    onError: (err) => toast.error(err?.message ?? 'Failed to update plan'),
  });

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="text-sm px-3 py-1.5 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium">
          Edit Plan
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-xl shadow-2xl focus:outline-none">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <Dialog.Title className="text-base font-semibold text-gray-900">Change Plan</Dialog.Title>
            <Dialog.Close className="text-gray-400 hover:text-gray-600 p-1 rounded-md">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Dialog.Close>
          </div>
          <div className="p-6 space-y-4">
            <RadioGroup.Root value={plan} onValueChange={setPlan} className="flex gap-3">
              {['trial', 'standard', 'enterprise'].map((p) => (
                <RadioGroup.Item
                  key={p}
                  value={p}
                  className={`flex-1 flex items-center justify-center py-2 rounded-md border text-sm font-medium cursor-pointer capitalize transition-colors
                    ${plan === p
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                >
                  <RadioGroup.Indicator className="hidden" />
                  {p}
                </RadioGroup.Item>
              ))}
            </RadioGroup.Root>
            <div className="flex justify-end gap-3 pt-1">
              <Dialog.Close asChild>
                <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || plan === org.plan}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Invite User Dialog ──────────────────────────────────────────────────────

function InviteUserDialog({ orgId, orgName }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('operator');

  const reset = () => { setEmail(''); setRole('operator'); };

  const mutation = useMutation({
    mutationFn: () => inviteToOrg(orgId, { email: email.trim(), role }),
    onSuccess: () => {
      toast.success('Invite sent');
      queryClient.invalidateQueries({ queryKey: ['admin-org', orgId] });
      setOpen(false);
      reset();
    },
    onError: (err) => toast.error(err?.message ?? 'Failed to send invite'),
  });

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) reset(); setOpen(v); }}>
      <Dialog.Trigger asChild>
        <button className="inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 border border-indigo-200 text-indigo-600 rounded-md bg-white hover:bg-indigo-50 transition-colors">
          <UserPlus className="w-4 h-4" />
          Invite User
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-xl shadow-2xl focus:outline-none">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <Dialog.Title className="text-base font-semibold text-gray-900">Invite to {orgName}</Dialog.Title>
            <Dialog.Close className="text-gray-400 hover:text-gray-600 p-1 rounded-md">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Dialog.Close>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                autoFocus
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@company.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="org_admin">Org Admin</option>
                <option value="operator">Operator</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Dialog.Close asChild>
                <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !email.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Send Invite
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Revoke API Key Dialog ───────────────────────────────────────────────────

function RevokeKeyDialog({ keyId, keyName, orgId }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => revokeAdminApiKey(keyId),
    onSuccess: () => {
      toast.success('Key revoked');
      queryClient.invalidateQueries({ queryKey: ['admin-org', orgId] });
      setOpen(false);
    },
    onError: (err) => toast.error(err?.message ?? 'Failed to revoke key'),
  });

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="text-xs font-medium text-red-600 hover:text-red-800 transition-colors">
          Revoke
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-xl shadow-2xl focus:outline-none p-6 space-y-4">
          <Dialog.Title className="text-base font-semibold text-gray-900">Revoke API Key</Dialog.Title>
          <p className="text-sm text-gray-600">
            Are you sure you want to revoke <span className="font-medium">{keyName}</span>? This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Dialog.Close asChild>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Revoke Key
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Config Form ─────────────────────────────────────────────────────────────

function ConfigForm({ org, orgId }) {
  const queryClient = useQueryClient();
  const [smtpOpen, setSmtpOpen] = useState(false);

  const [form, setForm] = useState({
    webhookUrl: org.config?.webhookUrl ?? '',
    aiPromptOverride: org.config?.aiPromptOverride ?? '',
    eventsPerDay: org.config?.limits?.eventsPerDay ?? '',
    apiCallsPerMonth: org.config?.limits?.apiCallsPerMonth ?? '',
    smtpJson: org.config?.smtp ? JSON.stringify(org.config.smtp, null, 2) : '',
  });

  // Re-sync if org data changes (e.g. after refetch)
  useEffect(() => {
    setForm({
      webhookUrl: org.config?.webhookUrl ?? '',
      aiPromptOverride: org.config?.aiPromptOverride ?? '',
      eventsPerDay: org.config?.limits?.eventsPerDay ?? '',
      apiCallsPerMonth: org.config?.limits?.apiCallsPerMonth ?? '',
      smtpJson: org.config?.smtp ? JSON.stringify(org.config.smtp, null, 2) : '',
    });
  }, [org]);

  const mutation = useMutation({
    mutationFn: () => {
      let smtp;
      if (form.smtpJson.trim()) {
        try { smtp = JSON.parse(form.smtpJson); } catch { throw new Error('SMTP JSON is invalid'); }
      }
      const payload = {
        webhookUrl: form.webhookUrl || undefined,
        aiPromptOverride: form.aiPromptOverride || undefined,
        limits: {
          eventsPerDay: form.eventsPerDay !== '' ? Number(form.eventsPerDay) : undefined,
          apiCallsPerMonth: form.apiCallsPerMonth !== '' ? Number(form.apiCallsPerMonth) : undefined,
        },
        ...(smtp !== undefined ? { smtp } : {}),
      };
      return updateAdminOrgConfig(orgId, payload);
    },
    onSuccess: () => {
      toast.success('Config saved');
      queryClient.invalidateQueries({ queryKey: ['admin-org', orgId] });
    },
    onError: (err) => toast.error(err?.message ?? 'Failed to save config'),
  });

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-base font-semibold text-gray-900">Configuration</h2>
      </div>
      <div className="p-6 space-y-5">
        {/* Webhook URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
          <input
            type="url"
            value={form.webhookUrl}
            onChange={set('webhookUrl')}
            placeholder="https://your-api.com/webhooks"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* AI Prompt Override — enterprise only */}
        {org.plan === 'enterprise' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              AI Prompt Override
              <span className="ml-2 text-xs font-normal text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">Enterprise</span>
            </label>
            <textarea
              rows={4}
              value={form.aiPromptOverride}
              onChange={set('aiPromptOverride')}
              placeholder="Custom system prompt for AI briefings..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
        )}

        {/* Limits */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Events per day</label>
            <input
              type="number"
              min="0"
              value={form.eventsPerDay}
              onChange={set('eventsPerDay')}
              placeholder="Unlimited"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API calls per month</label>
            <input
              type="number"
              min="0"
              value={form.apiCallsPerMonth}
              onChange={set('apiCallsPerMonth')}
              placeholder="Unlimited"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* SMTP Override — Collapsible */}
        <Collapsible.Root open={smtpOpen} onOpenChange={setSmtpOpen}>
          <Collapsible.Trigger asChild>
            <button className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              {smtpOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              SMTP Override
              <span className="text-xs text-gray-400 font-normal">(JSON)</span>
            </button>
          </Collapsible.Trigger>
          <Collapsible.Content className="mt-3">
            <textarea
              rows={6}
              value={form.smtpJson}
              onChange={set('smtpJson')}
              placeholder={'{\n  "host": "smtp.example.com",\n  "port": 587\n}'}
              className="w-full font-mono text-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </Collapsible.Content>
        </Collapsible.Root>

        {/* Save */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div>
            {org.config?.updatedAt && (
              <p className="text-xs text-gray-400">
                Last updated: {format(new Date(org.config.updatedAt), 'd MMM yyyy HH:mm')}
              </p>
            )}
          </div>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {mutation.isPending ? 'Saving…' : 'Save Config'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Members Table ───────────────────────────────────────────────────────────

function MembersTable({ org, orgId }) {
  const queryClient = useQueryClient();
  const members = org.members ?? [];

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }) => updateUserRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-org', orgId] }),
    onError: (err) => toast.error(err?.message ?? 'Failed to update role'),
  });

  const sessionsMutation = useMutation({
    mutationFn: (userId) => deleteUserSessions(userId),
    onSuccess: () => {
      toast.success('Sessions ended');
      queryClient.invalidateQueries({ queryKey: ['admin-org', orgId] });
    },
    onError: (err) => toast.error(err?.message ?? 'Failed to end sessions'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId) => updateUserStatus(userId, false),
    onSuccess: () => {
      toast.success('User deactivated');
      queryClient.invalidateQueries({ queryKey: ['admin-org', orgId] });
    },
    onError: (err) => toast.error(err?.message ?? 'Failed to deactivate user'),
  });

  const [confirmDeactivate, setConfirmDeactivate] = useState(null); // userId

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-500" />
          Members
          <span className="text-xs font-normal text-gray-400">({members.length})</span>
        </h2>
        <InviteUserDialog orgId={orgId} orgName={org.name} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-600">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 font-semibold">User</th>
              <th className="px-6 py-3 font-semibold">Role</th>
              <th className="px-6 py-3 font-semibold">Status</th>
              <th className="px-6 py-3 font-semibold">Last Login</th>
              <th className="px-6 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                  No members yet.
                </td>
              </tr>
            ) : (
              members.map((u) => (
                <tr key={u._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{u.name ?? u.username}</div>
                    <div className="text-xs text-gray-400">{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={u.role}
                      onChange={(e) => roleMutation.mutate({ userId: u._id, role: e.target.value })}
                      className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="super_admin">Super Admin</option>
                      <option value="org_admin">Org Admin</option>
                      <option value="operator">Operator</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-xs">
                    {u.lastLoginAt
                      ? formatDistanceToNow(new Date(u.lastLoginAt), { addSuffix: true })
                      : 'Never'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => sessionsMutation.mutate(u._id)}
                        disabled={sessionsMutation.isPending}
                        className="text-xs text-amber-600 hover:text-amber-800 font-medium transition-colors disabled:opacity-50"
                      >
                        Force Logout
                      </button>
                      {u.isActive && (
                        <>
                          {confirmDeactivate === u._id ? (
                            <span className="flex items-center gap-1.5">
                              <button
                                onClick={() => { deactivateMutation.mutate(u._id); setConfirmDeactivate(null); }}
                                className="text-xs text-red-600 hover:text-red-800 font-semibold"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmDeactivate(null)}
                                className="text-xs text-gray-400 hover:text-gray-600"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmDeactivate(u._id)}
                              className="text-xs text-red-600 hover:text-red-800 font-medium transition-colors"
                            >
                              Deactivate
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── API Keys Table ──────────────────────────────────────────────────────────

function ApiKeysTable({ org, orgId }) {
  const apiKeys = org.apiKeys ?? [];

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
        <Key className="w-4 h-4 text-gray-500" />
        <h2 className="text-base font-semibold text-gray-900">
          API Keys
          <span className="ml-2 text-xs font-normal text-gray-400">({apiKeys.length})</span>
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-600">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 font-semibold">Name</th>
              <th className="px-6 py-3 font-semibold">Prefix</th>
              <th className="px-6 py-3 font-semibold">Scopes</th>
              <th className="px-6 py-3 font-semibold">Last Used</th>
              <th className="px-6 py-3 font-semibold">Status</th>
              <th className="px-6 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {apiKeys.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-400">
                  No API keys.
                </td>
              </tr>
            ) : (
              apiKeys.map((k) => (
                <tr key={k._id} className={`transition-colors ${k.isActive ? 'hover:bg-gray-50' : 'bg-gray-50/60 opacity-70'}`}>
                  <td className="px-6 py-4 font-medium text-gray-900">{k.name}</td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs text-gray-500">{k.prefix}…</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(k.scopes ?? []).map((s) => (
                        <span key={s} className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {k.lastUsedAt
                      ? formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true })
                      : 'Never'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${k.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {k.isActive ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {k.isActive && (
                      <RevokeKeyDialog keyId={k._id} keyName={k.name} orgId={orgId} />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function OrgDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.id;
  const queryClient = useQueryClient();

  const { data: org, isLoading, isError, error } = useQuery({
    queryKey: ['admin-org', orgId],
    queryFn: () => getAdminOrg(orgId),
    enabled: !!orgId,
  });

  const statusMutation = useMutation({
    mutationFn: (status) => updateAdminOrgStatus(orgId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-org', orgId] });
      queryClient.invalidateQueries({ queryKey: ['admin-orgs'] });
    },
    onError: (err) => toast.error(err?.message ?? 'Failed to update status'),
  });

  // ── Loading / Error states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (isError || !org) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-gray-600 text-sm">{error?.message ?? 'Organisation not found.'}</p>
        <Link href="/admin/orgs" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          Back to Organisations
        </Link>
      </div>
    );
  }

  const stats = org.usageStats ?? {};
  const limits = org.config?.limits ?? {};

  const statCards = [
    {
      label: 'Events this month',
      value: stats.eventsThisMonth ?? 0,
      limit: limits.eventsPerDay,
      icon: <Activity className="w-4 h-4 text-indigo-500" />,
    },
    {
      label: 'Incidents',
      value: stats.incidentsThisMonth ?? 0,
      limit: null,
      icon: <ShieldAlert className="w-4 h-4 text-amber-500" />,
    },
    {
      label: 'Investigations',
      value: stats.investigationsThisMonth ?? 0,
      limit: null,
      icon: <Search className="w-4 h-4 text-emerald-500" />,
    },
    {
      label: 'API calls this month',
      value: stats.apiCallsThisMonth ?? 0,
      limit: limits.apiCallsPerMonth,
      icon: <Key className="w-4 h-4 text-violet-500" />,
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <Link
          href="/admin/orgs"
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-5"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Organisations
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">{org.name}</h1>
            <div className="flex items-center flex-wrap gap-3">
              <span className="font-mono text-sm bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {org.slug}
              </span>
              <PlanBadge plan={org.plan} />
              <StatusBadge status={org.status} />
              {org.createdAt && (
                <span className="text-sm text-gray-400">
                  Created {format(new Date(org.createdAt), 'd MMM yyyy')}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <EditPlanDialog org={org} orgId={orgId} />
            {org.status !== 'suspended' ? (
              <button
                onClick={() => statusMutation.mutate('suspended')}
                disabled={statusMutation.isPending}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-700 border border-red-200 bg-white rounded-md hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {statusMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Suspend
              </button>
            ) : (
              <button
                onClick={() => statusMutation.mutate('active')}
                disabled={statusMutation.isPending}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-green-700 border border-green-200 bg-white rounded-md hover:bg-green-50 disabled:opacity-50 transition-colors"
              >
                {statusMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Reactivate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ label, value, limit, icon }) => (
          <div key={label} className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-gray-500">{label}</p>
              {icon}
            </div>
            <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
            <UsageBar value={value} max={limit} />
          </div>
        ))}
      </div>

      {/* ── Config ─────────────────────────────────────────────────────── */}
      <ConfigForm org={org} orgId={orgId} />

      {/* ── Members ────────────────────────────────────────────────────── */}
      <MembersTable org={org} orgId={orgId} />

      {/* ── API Keys ───────────────────────────────────────────────────── */}
      <ApiKeysTable org={org} orgId={orgId} />

      {/* ── Danger Zone ────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-red-200 bg-red-50/40 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h2 className="text-base font-semibold text-red-700">Danger Zone</h2>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm font-medium text-gray-800">Suspend Organisation</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Prevents all members from accessing the platform. Can be reversed.
            </p>
          </div>
          <SuspendConfirmButton orgId={orgId} currentStatus={org.status} />
        </div>
      </div>
    </div>
  );
}

// ─── Suspend confirm (inline) ─────────────────────────────────────────────

function SuspendConfirmButton({ orgId, currentStatus }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: () => updateAdminOrgStatus(orgId, 'suspended'),
    onSuccess: () => {
      toast.success('Organisation suspended');
      queryClient.invalidateQueries({ queryKey: ['admin-org', orgId] });
      queryClient.invalidateQueries({ queryKey: ['admin-orgs'] });
      setConfirming(false);
    },
    onError: (err) => {
      toast.error(err?.message ?? 'Failed to suspend');
      setConfirming(false);
    },
  });

  if (currentStatus === 'suspended') {
    return (
      <span className="text-xs text-gray-400 italic">Organisation is already suspended.</span>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-red-700 font-medium">Are you sure?</span>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Yes, Suspend
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="px-4 py-2 text-sm font-medium text-red-700 border border-red-300 bg-white rounded-md hover:bg-red-50 transition-colors"
    >
      Suspend Organisation
    </button>
  );
}
