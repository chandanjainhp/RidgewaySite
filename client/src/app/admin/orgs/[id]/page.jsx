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
  updateUserRole,
  updateUserStatus,
  deleteUserSessions,
  revokeAdminApiKey,
} from '@/lib/api';

// ─── shared styles ────────────────────────────────────────────────────────────

const inputStyle = {
  background: 'var(--bg-base)',
  border: '1px solid var(--border-default)',
  color: 'var(--fg-1)',
  borderRadius: '6px',
  padding: '8px 12px',
  fontSize: 'var(--text-sm)',
  outline: 'none',
  width: '100%',
};

const selectStyle = {
  background: 'var(--bg-base)',
  border: '1px solid var(--border-default)',
  color: 'var(--fg-1)',
  borderRadius: '6px',
  padding: '8px 12px',
  fontSize: 'var(--text-sm)',
  outline: 'none',
  width: '100%',
  cursor: 'pointer',
};

// ─── Badge helpers ───────────────────────────────────────────────────────────

const PLAN_STYLE = {
  trial:      { background: 'rgba(107,118,134,0.2)',  color: '#aab4c2' },
  standard:   { background: 'rgba(90,135,168,0.2)',   color: '#b8d4e8' },
  enterprise: { background: 'rgba(184,212,232,0.15)', color: '#e6ecf3' },
};

const STATUS_STYLE = {
  active:    { background: 'rgba(125,138,106,0.2)', color: '#7d8a6a' },
  pending:   { background: 'rgba(232,154,43,0.15)', color: '#e89a2b' },
  suspended: { background: 'rgba(255,56,56,0.15)',  color: '#ff3838' },
};

function PlanBadge({ plan }) {
  const s = PLAN_STYLE[plan] ?? PLAN_STYLE.trial;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize" style={s}>
      {plan}
    </span>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] ?? { background: 'rgba(107,118,134,0.2)', color: '#6b7686' };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize" style={s}>
      {status}
    </span>
  );
}

// ─── Simple progress bar ─────────────────────────────────────────────────────

function UsageBar({ value, max }) {
  if (!max || max <= 0) return null;
  const pct = Math.min(100, Math.round((value / max) * 100));
  const barColor = pct >= 90 ? 'var(--sev-serious)' : pct >= 70 ? 'var(--sev-minor)' : 'var(--accent-dim)';
  return (
    <div className="mt-2">
      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--bg-surface-3)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <p className="text-xs mt-1" style={{ color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
        {value.toLocaleString()} / {max.toLocaleString()} ({pct}%)
      </p>
    </div>
  );
}

// ─── Dialog base ─────────────────────────────────────────────────────────────

function DialogShell({ open, onOpenChange, title, children }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl focus:outline-none"
          style={{
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          }}
        >
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: '1px solid var(--border-hairline)' }}
          >
            <Dialog.Title className="text-base font-semibold" style={{ color: 'var(--fg-1)' }}>
              {title}
            </Dialog.Title>
            <Dialog.Close className="p-1 rounded-md" style={{ color: 'var(--fg-3)' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Dialog.Close>
          </div>
          <div className="p-6 space-y-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm px-3 py-1.5 rounded-md font-medium transition-colors"
        style={{
          border: '1px solid var(--border-default)',
          color: 'var(--fg-2)',
          background: 'transparent',
        }}
      >
        Edit Plan
      </button>
      <DialogShell open={open} onOpenChange={setOpen} title="Change Plan">
        <RadioGroup.Root value={plan} onValueChange={setPlan} className="flex gap-2">
          {['trial', 'standard', 'enterprise'].map((p) => (
            <RadioGroup.Item
              key={p}
              value={p}
              className="flex-1 flex items-center justify-center py-2 rounded-md text-sm font-medium cursor-pointer capitalize transition-all"
              style={{
                border: plan === p ? '1px solid var(--accent)' : '1px solid var(--border-default)',
                background: plan === p ? 'rgba(184,212,232,0.08)' : 'transparent',
                color: plan === p ? 'var(--accent)' : 'var(--fg-3)',
              }}
            >
              <RadioGroup.Indicator className="hidden" />
              {p}
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
        <div className="flex justify-end gap-3 pt-1">
          <Dialog.Close asChild>
            <button
              className="px-4 py-2 text-sm font-medium rounded-md"
              style={{ border: '1px solid var(--border-default)', color: 'var(--fg-2)', background: 'transparent' }}
            >
              Cancel
            </button>
          </Dialog.Close>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || plan === org.plan}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md disabled:opacity-40"
            style={{ background: 'var(--accent-dim)', color: 'var(--fg-1)' }}
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </button>
        </div>
      </DialogShell>
    </>
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
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium transition-colors"
        style={{ color: '#ff3838' }}
      >
        Revoke
      </button>
      <DialogShell open={open} onOpenChange={setOpen} title="Revoke API Key">
        <p className="text-sm" style={{ color: 'var(--fg-3)' }}>
          Are you sure you want to revoke <span style={{ color: 'var(--fg-1)', fontWeight: 500 }}>{keyName}</span>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Dialog.Close asChild>
            <button
              className="px-4 py-2 text-sm font-medium rounded-md"
              style={{ border: '1px solid var(--border-default)', color: 'var(--fg-2)', background: 'transparent' }}
            >
              Cancel
            </button>
          </Dialog.Close>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50"
            style={{ background: '#ff3838', color: '#fff' }}
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Revoke Key
          </button>
        </div>
      </DialogShell>
    </>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, icon: Icon, action, children }) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-default)' }}
    >
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border-hairline)' }}
      >
        <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--fg-1)' }}>
          {Icon && <Icon className="w-4 h-4" style={{ color: 'var(--fg-3)' }} />}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
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
        try { smtp = JSON.parse(form.smtpJson); }
        catch { throw new Error('SMTP JSON is invalid'); }
      }
      return updateAdminOrgConfig(orgId, {
        webhookUrl: form.webhookUrl || undefined,
        aiPromptOverride: form.aiPromptOverride || undefined,
        limits: {
          eventsPerDay: form.eventsPerDay !== '' ? Number(form.eventsPerDay) : undefined,
          apiCallsPerMonth: form.apiCallsPerMonth !== '' ? Number(form.apiCallsPerMonth) : undefined,
        },
        ...(smtp !== undefined ? { smtp } : {}),
      });
    },
    onSuccess: () => {
      toast.success('Config saved');
      queryClient.invalidateQueries({ queryKey: ['admin-org', orgId] });
    },
    onError: (err) => toast.error(err?.message ?? 'Failed to save config'),
  });

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const labelStyle = { display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '6px', color: 'var(--fg-2)' };

  return (
    <Section title="Configuration">
      <div className="p-6 space-y-5">
        <div>
          <label style={labelStyle}>Webhook URL</label>
          <input type="url" value={form.webhookUrl} onChange={set('webhookUrl')} placeholder="https://your-api.com/webhooks" style={inputStyle} />
        </div>

        {org.plan === 'enterprise' && (
          <div>
            <label style={labelStyle}>
              AI Prompt Override
              <span
                className="ml-2 px-1.5 py-0.5 rounded"
                style={{ fontSize: '11px', fontWeight: 400, background: 'rgba(184,212,232,0.15)', color: '#b8d4e8' }}
              >
                Enterprise
              </span>
            </label>
            <textarea
              rows={4}
              value={form.aiPromptOverride}
              onChange={set('aiPromptOverride')}
              placeholder="Custom system prompt for AI briefings..."
              style={{ ...inputStyle, resize: 'none' }}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Events per day</label>
            <input type="number" min="0" value={form.eventsPerDay} onChange={set('eventsPerDay')} placeholder="Unlimited" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>API calls per month</label>
            <input type="number" min="0" value={form.apiCallsPerMonth} onChange={set('apiCallsPerMonth')} placeholder="Unlimited" style={inputStyle} />
          </div>
        </div>

        <Collapsible.Root open={smtpOpen} onOpenChange={setSmtpOpen}>
          <Collapsible.Trigger asChild>
            <button
              className="flex items-center gap-2 text-sm font-medium transition-colors"
              style={{ color: 'var(--fg-3)' }}
            >
              {smtpOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              SMTP Override
              <span style={{ fontSize: '11px', color: 'var(--fg-4)', fontWeight: 400 }}>(JSON)</span>
            </button>
          </Collapsible.Trigger>
          <Collapsible.Content className="mt-3">
            <textarea
              rows={6}
              value={form.smtpJson}
              onChange={set('smtpJson')}
              placeholder={'{\n  "host": "smtp.example.com",\n  "port": 587\n}'}
              style={{ ...inputStyle, resize: 'none', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}
            />
          </Collapsible.Content>
        </Collapsible.Root>

        <div
          className="flex items-center justify-between pt-2"
          style={{ borderTop: '1px solid var(--border-hairline)' }}
        >
          <div>
            {org.config?.updatedAt && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--fg-4)' }}>
                Last updated: {format(new Date(org.config.updatedAt), 'd MMM yyyy HH:mm')}
              </p>
            )}
          </div>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md disabled:opacity-40 transition-opacity"
            style={{ background: 'var(--accent-dim)', color: 'var(--fg-1)' }}
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {mutation.isPending ? 'Saving…' : 'Save Config'}
          </button>
        </div>
      </div>
    </Section>
  );
}

// ─── Members Table ───────────────────────────────────────────────────────────

function MembersTable({ org, orgId }) {
  const queryClient = useQueryClient();
  const members = org.members ?? [];
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }) => updateUserRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-org', orgId] }),
    onError: (err) => toast.error(err?.message ?? 'Failed to update role'),
  });

  const sessionsMutation = useMutation({
    mutationFn: (userId) => deleteUserSessions(userId),
    onSuccess: () => { toast.success('Sessions ended'); queryClient.invalidateQueries({ queryKey: ['admin-org', orgId] }); },
    onError: (err) => toast.error(err?.message ?? 'Failed to end sessions'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId) => updateUserStatus(userId, false),
    onSuccess: () => { toast.success('User deactivated'); queryClient.invalidateQueries({ queryKey: ['admin-org', orgId] }); },
    onError: (err) => toast.error(err?.message ?? 'Failed to deactivate user'),
  });

  return (
    <Section title="Members" icon={Users}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr style={{ background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border-default)' }}>
              {['User', 'Role', 'Status', 'Last Login', 'Actions'].map((h, i) => (
                <th
                  key={h}
                  className={`px-6 py-3 text-xs font-semibold uppercase tracking-wider ${i === 4 ? 'text-right' : ''}`}
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center" style={{ color: 'var(--fg-4)' }}>
                  No members yet.
                </td>
              </tr>
            ) : (
              members.map((u) => (
                <tr
                  key={u._id}
                  className="transition-colors"
                  style={{ borderBottom: '1px solid var(--border-hairline)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-2)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td className="px-6 py-4">
                    <div className="font-medium" style={{ color: 'var(--fg-1)' }}>{u.name ?? u.username}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-3)' }}>{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={u.role}
                      onChange={(e) => roleMutation.mutate({ userId: u._id, role: e.target.value })}
                      style={{ ...selectStyle, width: 'auto', fontSize: 'var(--text-xs)', padding: '4px 8px' }}
                    >
                      <option value="super_admin">Super Admin</option>
                      <option value="org_admin">Org Admin</option>
                      <option value="operator">Operator</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                      style={
                        u.isActive
                          ? { background: 'rgba(125,138,106,0.2)', color: '#7d8a6a' }
                          : { background: 'rgba(67,77,92,0.4)', color: '#6b7686' }
                      }
                    >
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td
                    className="px-6 py-4"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--fg-3)' }}
                  >
                    {u.lastLoginAt ? formatDistanceToNow(new Date(u.lastLoginAt), { addSuffix: true }) : 'Never'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => sessionsMutation.mutate(u._id)}
                        disabled={sessionsMutation.isPending}
                        className="text-xs font-medium transition-colors disabled:opacity-50"
                        style={{ color: '#e89a2b' }}
                      >
                        Force Logout
                      </button>
                      {u.isActive && (
                        <>
                          {confirmDeactivate === u._id ? (
                            <span className="flex items-center gap-1.5">
                              <button
                                onClick={() => { deactivateMutation.mutate(u._id); setConfirmDeactivate(null); }}
                                className="text-xs font-semibold"
                                style={{ color: '#ff3838' }}
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmDeactivate(null)}
                                className="text-xs"
                                style={{ color: 'var(--fg-4)' }}
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmDeactivate(u._id)}
                              className="text-xs font-medium transition-colors"
                              style={{ color: '#ff3838' }}
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
    </Section>
  );
}

// ─── API Keys Table ──────────────────────────────────────────────────────────

function ApiKeysTable({ org, orgId }) {
  const apiKeys = org.apiKeys ?? [];

  return (
    <Section title="API Keys" icon={Key}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr style={{ background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border-default)' }}>
              {['Name', 'Prefix', 'Scopes', 'Last Used', 'Status', 'Actions'].map((h, i) => (
                <th
                  key={h}
                  className={`px-6 py-3 text-xs font-semibold uppercase tracking-wider ${i === 5 ? 'text-right' : ''}`}
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {apiKeys.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center" style={{ color: 'var(--fg-4)' }}>
                  No API keys.
                </td>
              </tr>
            ) : (
              apiKeys.map((k) => (
                <tr
                  key={k._id}
                  className="transition-colors"
                  style={{ borderBottom: '1px solid var(--border-hairline)', opacity: k.isActive ? 1 : 0.5 }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-2)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td className="px-6 py-4 font-medium" style={{ color: 'var(--fg-1)' }}>{k.name}</td>
                  <td className="px-6 py-4">
                    <span
                      className="px-1.5 py-0.5 rounded"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', background: 'var(--bg-surface-3)', color: 'var(--fg-3)' }}
                    >
                      {k.prefix}…
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(k.scopes ?? []).map((s) => (
                        <span
                          key={s}
                          className="px-1.5 py-0.5 rounded"
                          style={{ fontSize: '10px', background: 'var(--bg-surface-3)', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td
                    className="px-6 py-4"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--fg-3)' }}
                  >
                    {k.lastUsedAt ? formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true }) : 'Never'}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                      style={
                        k.isActive
                          ? { background: 'rgba(125,138,106,0.2)', color: '#7d8a6a' }
                          : { background: 'rgba(255,56,56,0.15)', color: '#ff3838' }
                      }
                    >
                      {k.isActive ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {k.isActive && <RevokeKeyDialog keyId={k._id} keyName={k.name} orgId={orgId} />}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ─── Suspend confirm ─────────────────────────────────────────────────────────

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
    onError: (err) => { toast.error(err?.message ?? 'Failed to suspend'); setConfirming(false); },
  });

  if (currentStatus === 'suspended') {
    return <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-4)', fontStyle: 'italic' }}>Organisation is already suspended.</span>;
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium" style={{ color: '#ff3838' }}>Are you sure?</span>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md disabled:opacity-50"
          style={{ background: '#ff3838', color: '#fff' }}
        >
          {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Yes, Suspend
        </button>
        <button onClick={() => setConfirming(false)} className="text-sm" style={{ color: 'var(--fg-3)' }}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="px-4 py-2 text-sm font-medium rounded-md transition-colors"
      style={{
        color: '#ff3838',
        border: '1px solid rgba(255,56,56,0.3)',
        background: 'rgba(255,56,56,0.06)',
      }}
    >
      Suspend Organisation
    </button>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function OrgDetailPage() {
  const params = useParams();
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  if (isError || !org) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="w-10 h-10" style={{ color: 'var(--sev-serious)' }} />
        <p className="text-sm" style={{ color: 'var(--fg-3)' }}>{error?.message ?? 'Organisation not found.'}</p>
        <Link href="/admin/orgs" className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
          Back to Organisations
        </Link>
      </div>
    );
  }

  const stats = org.usageStats ?? {};
  const limits = org.config?.limits ?? {};

  const statCards = [
    { label: 'Events this month',     value: stats.eventsThisMonth ?? 0,       limit: limits.eventsPerDay,      icon: Activity    },
    { label: 'Incidents',             value: stats.incidentsThisMonth ?? 0,     limit: null,                     icon: ShieldAlert },
    { label: 'Investigations',        value: stats.investigationsThisMonth ?? 0, limit: null,                    icon: Search      },
    { label: 'API calls this month',  value: stats.apiCallsThisMonth ?? 0,      limit: limits.apiCallsPerMonth,  icon: Key         },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <Link
          href="/admin/orgs"
          className="inline-flex items-center gap-1 text-sm font-medium mb-5"
          style={{ color: 'var(--accent)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Organisations
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--fg-1)' }}>{org.name}</h1>
            <div className="flex items-center flex-wrap gap-3">
              <span
                className="px-2 py-0.5 rounded text-sm"
                style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-surface-2)', color: 'var(--fg-3)' }}
              >
                {org.slug}
              </span>
              <PlanBadge plan={org.plan} />
              <StatusBadge status={org.status} />
              {org.createdAt && (
                <span style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>
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
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md disabled:opacity-50 transition-colors"
                style={{ color: '#ff3838', border: '1px solid rgba(255,56,56,0.3)', background: 'rgba(255,56,56,0.06)' }}
              >
                {statusMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Suspend
              </button>
            ) : (
              <button
                onClick={() => statusMutation.mutate('active')}
                disabled={statusMutation.isPending}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md disabled:opacity-50 transition-colors"
                style={{ color: '#7d8a6a', border: '1px solid rgba(125,138,106,0.3)', background: 'rgba(125,138,106,0.06)' }}
              >
                {statusMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Reactivate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ label, value, limit, icon: Icon }) => (
          <div
            key={label}
            className="rounded-lg p-5"
            style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-default)' }}
          >
            <div className="flex items-center justify-between mb-1">
              <p style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {label}
              </p>
              <Icon className="w-4 h-4" style={{ color: 'var(--accent-dim)' }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--fg-1)' }}>{value.toLocaleString()}</p>
            <UsageBar value={value} max={limit} />
          </div>
        ))}
      </div>

      <ConfigForm org={org} orgId={orgId} />
      <MembersTable org={org} orgId={orgId} />
      <ApiKeysTable org={org} orgId={orgId} />

      {/* Danger Zone */}
      <div
        className="rounded-lg p-6 space-y-4"
        style={{ border: '1px solid rgba(255,56,56,0.25)', background: 'rgba(255,56,56,0.04)' }}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" style={{ color: '#ff3838' }} />
          <h2 className="text-base font-semibold" style={{ color: '#ff3838' }}>Danger Zone</h2>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--fg-1)' }}>Suspend Organisation</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--fg-3)' }}>
              Prevents all members from accessing the platform. Can be reversed.
            </p>
          </div>
          <SuspendConfirmButton orgId={orgId} currentStatus={org.status} />
        </div>
      </div>
    </div>
  );
}
