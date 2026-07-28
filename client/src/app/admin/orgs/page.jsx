'use client';

import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Plus, Building2, ChevronDown, Loader2 } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';
import * as RadioGroup from '@radix-ui/react-radio-group';
import {
  listAdminOrgs,
  createAdminOrg,
  updateAdminOrgStatus,
} from '@/lib/api';

// ─── helpers ────────────────────────────────────────────────────────────────

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
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize"
      style={s}
    >
      {plan}
    </span>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] ?? { background: 'rgba(107,118,134,0.2)', color: '#6b7686' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize"
      style={s}
    >
      {status}
    </span>
  );
}

// ─── Status action popover ──────────────────────────────────────────────────

function StatusPopover({ org, onMutate }) {
  const [open, setOpen] = useState(false);

  const label =
    org.status === 'active'
      ? 'Suspend'
      : org.status === 'suspended'
      ? 'Reactivate'
      : 'Activate';

  const nextStatus =
    org.status === 'active'
      ? 'suspended'
      : org.status === 'suspended'
      ? 'active'
      : 'active';

  const btnStyle =
    org.status === 'active'
      ? { color: '#ff3838', border: '1px solid rgba(255,56,56,0.35)', background: 'rgba(255,56,56,0.08)' }
      : { color: '#7d8a6a', border: '1px solid rgba(125,138,106,0.35)', background: 'rgba(125,138,106,0.08)' };

  const confirmStyle =
    nextStatus === 'suspended'
      ? { background: '#ff3838', color: '#fff' }
      : { background: '#7d8a6a', color: '#fff' };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="text-xs font-medium px-3 py-1.5 rounded transition-colors"
          style={btnStyle}
        >
          {label}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="left"
          align="center"
          sideOffset={6}
          onClick={(e) => e.stopPropagation()}
          className="z-50 w-52 rounded-lg p-3 text-sm"
          style={{
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            color: 'var(--fg-2)',
          }}
        >
          <p className="mb-3 font-medium" style={{ color: 'var(--fg-1)' }}>
            {nextStatus === 'suspended'
              ? 'Suspend this organisation?'
              : 'Reactivate this organisation?'}
          </p>
          <button
            className="w-full py-1.5 rounded text-xs font-semibold transition-opacity hover:opacity-80"
            style={confirmStyle}
            onClick={() => {
              setOpen(false);
              onMutate(org._id, nextStatus);
            }}
          >
            Confirm {label}
          </button>
          <Popover.Arrow style={{ fill: 'var(--border-default)' }} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ─── Create Org Modal ───────────────────────────────────────────────────────

const inputStyle = {
  background: 'var(--bg-base)',
  border: '1px solid var(--border-default)',
  color: 'var(--fg-1)',
  borderRadius: '6px',
  padding: '8px 12px',
  fontSize: 'var(--text-sm)',
  width: '100%',
  outline: 'none',
};

function CreateOrgDialog({ open, onOpenChange, onCreated }) {
  const [name, setName] = useState('');
  const [plan, setPlan] = useState('trial');
  const [slugError, setSlugError] = useState('');
  const queryClient = useQueryClient();

  const reset = () => {
    setName('');
    setPlan('trial');
    setSlugError('');
  };

  const mutation = useMutation({
    mutationFn: async () => {
      return createAdminOrg({ name: name.trim(), plan });
    },
    onSuccess: () => {
      toast.success('Organisation created');
      queryClient.invalidateQueries({ queryKey: ['admin-orgs'] });
      onOpenChange(false);
      onCreated?.();
      reset();
    },
    onError: (err) => {
      const msg = err?.message ?? '';
      if (msg.toLowerCase().includes('slug') || msg.toLowerCase().includes('already exists')) {
        setSlugError(msg);
      } else {
        toast.error(msg || 'Failed to create organisation');
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSlugError('');
    mutation.mutate();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl focus:outline-none"
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
              Create Organisation
            </Dialog.Title>
            <Dialog.Close
              className="p-1 rounded-md transition-colors"
              style={{ color: 'var(--fg-3)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--fg-2)' }}>
                Organisation Name <span style={{ color: 'var(--sev-serious)' }}>*</span>
              </label>
              <input
                autoFocus
                required
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setSlugError(''); }}
                placeholder="Acme Corp"
                style={{
                  ...inputStyle,
                  borderColor: slugError ? 'var(--sev-serious)' : 'var(--border-default)',
                }}
              />
              {slugError && (
                <p className="mt-1 text-xs" style={{ color: 'var(--sev-serious)' }}>{slugError}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--fg-2)' }}>Plan</label>
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
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium rounded-md transition-colors"
                  style={{
                    color: 'var(--fg-2)',
                    border: '1px solid var(--border-default)',
                    background: 'transparent',
                  }}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={mutation.isPending || !name.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-opacity disabled:opacity-40"
                style={{ background: 'var(--accent-dim)', color: 'var(--fg-1)' }}
              >
                {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {mutation.isPending ? 'Creating…' : 'Create Organisation'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Skeleton row ───────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: '1px solid var(--border-hairline)' }}>
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div
            className="h-3 rounded animate-pulse"
            style={{ width: i === 0 ? '60%' : '50%', background: 'var(--bg-surface-3)' }}
          />
        </td>
      ))}
    </tr>
  );
}

// ─── Select base style ────────────────────────────────────────────────────────

const selectStyle = {
  appearance: 'none',
  background: 'var(--bg-surface-1)',
  border: '1px solid var(--border-default)',
  color: 'var(--fg-2)',
  borderRadius: '6px',
  padding: '7px 32px 7px 12px',
  fontSize: 'var(--text-sm)',
  outline: 'none',
  cursor: 'pointer',
};

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function OrganisationsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['admin-orgs', statusFilter, planFilter],
    queryFn: ({ pageParam = 1 }) =>
      listAdminOrgs({
        page: pageParam,
        limit: 20,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(planFilter ? { plan: planFilter } : {}),
      }),
    getNextPageParam: (last, all) => {
      const loaded = all.length * 20;
      const total = last?.total ?? 0;
      return loaded < total ? all.length + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const allOrgs = data?.pages.flatMap((page) => page?.data ?? (Array.isArray(page) ? page : [])) ?? [];

  const statusMutation = useMutation({
    mutationFn: ({ orgId, status }) => updateAdminOrgStatus(orgId, status),
    onMutate: async ({ orgId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-orgs', statusFilter, planFilter] });
      const previous = queryClient.getQueryData(['admin-orgs', statusFilter, planFilter]);
      queryClient.setQueryData(['admin-orgs', statusFilter, planFilter], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: (page?.data ?? []).map((org) =>
              org._id === orgId ? { ...org, status } : org
            ),
          })),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['admin-orgs', statusFilter, planFilter], ctx.previous);
      }
      toast.error('Failed to update status');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orgs'] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--fg-1)' }}>
            Organisations
          </h1>
          {!isLoading && (
            <span
              className="text-sm"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}
            >
              ({allOrgs.length} loaded)
            </span>
          )}
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-opacity hover:opacity-80"
          style={{ background: 'var(--accent-dim)', color: 'var(--fg-1)' }}
        >
          <Plus className="w-4 h-4" />
          Create Organisation
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--fg-4)' }}
          />
        </div>

        <div className="relative">
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="">All Plans</option>
            <option value="trial">Trial</option>
            <option value="standard">Standard</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--fg-4)' }}
          />
        </div>

        {(statusFilter || planFilter) && (
          <button
            onClick={() => { setStatusFilter(''); setPlanFilter(''); }}
            className="text-xs underline transition-colors"
            style={{ color: 'var(--fg-3)' }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface-1)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr style={{ background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border-default)' }}>
                {['Name', 'Slug', 'Plan', 'Status', 'Users', 'Created', 'Actions'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-6 py-3 font-semibold text-xs uppercase tracking-wider ${i === 4 ? 'text-center' : i === 6 ? 'text-right' : ''}`}
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', letterSpacing: '0.08em' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              ) : allOrgs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center"
                    style={{ color: 'var(--fg-4)' }}
                  >
                    No organisations found.
                  </td>
                </tr>
              ) : (
                allOrgs.map((org) => (
                  <tr
                    key={org._id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid var(--border-hairline)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-2)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/orgs/${org._id}`}
                        className="font-semibold transition-colors"
                        style={{ color: 'var(--fg-1)' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--fg-1)'}
                      >
                        {org.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--fg-3)' }}
                      >
                        {org.slug}
                      </span>
                    </td>
                    <td className="px-6 py-4"><PlanBadge plan={org.plan} /></td>
                    <td className="px-6 py-4"><StatusBadge status={org.status} /></td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className="inline-flex items-center justify-center text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--bg-surface-3)', color: 'var(--fg-2)' }}
                      >
                        {org.userCount ?? 0}
                      </span>
                    </td>
                    <td
                      className="px-6 py-4 whitespace-nowrap"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--fg-3)' }}
                    >
                      {org.createdAt ? format(new Date(org.createdAt), 'd MMM yyyy') : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <StatusPopover
                        org={org}
                        onMutate={(orgId, status) => statusMutation.mutate({ orgId, status })}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Load More */}
      {(hasNextPage || isFetchingNextPage) && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => fetchNextPage()}
            disabled={!hasNextPage || isFetchingNextPage}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-40"
            style={{
              color: 'var(--fg-2)',
              border: '1px solid var(--border-default)',
              background: 'transparent',
            }}
          >
            {isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin" />}
            {isFetchingNextPage ? 'Loading…' : 'Load More'}
          </button>
        </div>
      )}

      {/* Create Modal */}
      <CreateOrgDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {}}
      />
    </div>
  );
}
