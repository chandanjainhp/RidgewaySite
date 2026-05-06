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
  inviteToOrg,
} from '@/lib/api';

// ─── helpers ────────────────────────────────────────────────────────────────

function planBadge(plan) {
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

function statusBadge(status) {
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

  const btnColor =
    org.status === 'active'
      ? 'text-red-700 border-red-200 hover:bg-red-50'
      : 'text-green-700 border-green-200 hover:bg-green-50';

  const confirmColor =
    nextStatus === 'suspended'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-green-600 hover:bg-green-700 text-white';

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={`text-xs font-medium px-3 py-1.5 rounded border bg-white transition-colors ${btnColor}`}
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
          className="z-50 w-48 rounded-lg border border-gray-200 bg-white p-3 shadow-lg text-sm"
        >
          <p className="text-gray-700 mb-3 font-medium">
            {nextStatus === 'suspended'
              ? 'Suspend this organisation?'
              : 'Reactivate this organisation?'}
          </p>
          <button
            className={`w-full py-1.5 rounded text-xs font-semibold transition-colors ${confirmColor}`}
            onClick={() => {
              setOpen(false);
              onMutate(org._id, nextStatus);
            }}
          >
            Confirm {label}
          </button>
          <Popover.Arrow className="fill-gray-200" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ─── Create Org Modal ───────────────────────────────────────────────────────

function CreateOrgDialog({ open, onOpenChange, onCreated }) {
  const [name, setName] = useState('');
  const [plan, setPlan] = useState('trial');
  const [inviteEmail, setInviteEmail] = useState('');
  const [slugError, setSlugError] = useState('');
  const queryClient = useQueryClient();

  const reset = () => {
    setName('');
    setPlan('trial');
    setInviteEmail('');
    setSlugError('');
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const org = await createAdminOrg({ name: name.trim(), plan });
      const orgId = org._id ?? org.id;
      if (inviteEmail.trim()) {
        await inviteToOrg(orgId, { email: inviteEmail.trim() });
      }
      return org;
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
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-2xl focus:outline-none">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Create Organisation
            </Dialog.Title>
            <Dialog.Close className="text-gray-400 hover:text-gray-600 rounded-md p-1 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organisation Name <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                required
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSlugError('');
                }}
                placeholder="Acme Corp"
                className={`w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  slugError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'
                }`}
              />
              {slugError && (
                <p className="mt-1 text-xs text-red-600">{slugError}</p>
              )}
            </div>

            {/* Plan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Plan</label>
              <RadioGroup.Root
                value={plan}
                onValueChange={setPlan}
                className="flex gap-3"
              >
                {['trial', 'standard', 'enterprise'].map((p) => (
                  <RadioGroup.Item
                    key={p}
                    value={p}
                    className={`flex-1 flex items-center justify-center py-2 rounded-md border text-sm font-medium cursor-pointer transition-colors capitalize
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
            </div>

            {/* Invite email (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invite Email <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="admin@acme.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={mutation.isPending || !name.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
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
    <tr className="border-b border-gray-100">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: i === 0 ? '60%' : '50%' }} />
        </td>
      ))}
    </tr>
  );
}

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
    getNextPageParam: (last, all) =>
      Array.isArray(last) && last.length === 20 ? all.length + 1 : undefined,
    initialPageParam: 1,
  });

  const allOrgs = data?.pages.flatMap((page) => (Array.isArray(page) ? page : [])) ?? [];

  const statusMutation = useMutation({
    mutationFn: ({ orgId, status }) => updateAdminOrgStatus(orgId, status),
    onMutate: async ({ orgId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-orgs', statusFilter, planFilter] });
      const previous = queryClient.getQueryData(['admin-orgs', statusFilter, planFilter]);
      queryClient.setQueryData(['admin-orgs', statusFilter, planFilter], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            Array.isArray(page)
              ? page.map((org) => (org._id === orgId ? { ...org, status } : org))
              : page
          ),
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

  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-indigo-500" />
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Organisations</h1>
          {!isLoading && (
            <span className="text-sm text-gray-400">({allOrgs.length} loaded)</span>
          )}
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 transition-colors"
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
            onChange={handleFilterChange(setStatusFilter)}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>

        <div className="relative">
          <select
            value={planFilter}
            onChange={handleFilterChange(setPlanFilter)}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="">All Plans</option>
            <option value="trial">Trial</option>
            <option value="standard">Standard</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>

        {(statusFilter || planFilter) && (
          <button
            onClick={() => { setStatusFilter(''); setPlanFilter(''); }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 font-semibold">Name</th>
                <th className="px-6 py-3 font-semibold">Slug</th>
                <th className="px-6 py-3 font-semibold">Plan</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold text-center">Users</th>
                <th className="px-6 py-3 font-semibold">Created</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              ) : allOrgs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    No organisations found.
                  </td>
                </tr>
              ) : (
                allOrgs.map((org) => (
                  <tr key={org._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/orgs/${org._id}`}
                        className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
                      >
                        {org.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-gray-500">{org.slug}</span>
                    </td>
                    <td className="px-6 py-4">{planBadge(org.plan)}</td>
                    <td className="px-6 py-4">{statusBadge(org.status)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center bg-gray-100 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                        {org.userCount ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                      {org.createdAt
                        ? format(new Date(org.createdAt), 'd MMM yyyy')
                        : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <StatusPopover
                        org={org}
                        onMutate={(orgId, status) =>
                          statusMutation.mutate({ orgId, status })
                        }
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
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
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
