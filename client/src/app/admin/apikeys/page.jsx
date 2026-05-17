'use client';

import { useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { listAdminOrgs, listAdminApiKeys, revokeAdminApiKey } from '@/lib/api';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { Key, ShieldAlert, Loader2, ChevronDown } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

// ─── helpers ────────────────────────────────────────────────────────────────

const ALL_SCOPES = [
  'events:read',
  'incidents:read',
  'briefings:read',
  'investigations:read',
  'investigations:write',
  'mcp',
];

const PAGE_SIZE = 50;

function lastUsedLabel(lastUsedAt) {
  if (!lastUsedAt) return 'Never';
  try {
    return formatDistanceToNow(new Date(lastUsedAt), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

function expiresLabel(expiresAt) {
  if (!expiresAt) return 'No expiry';
  try {
    return format(new Date(expiresAt), 'd MMM yyyy');
  } catch {
    return 'Unknown';
  }
}

function StatusBadge({ keyObj }) {
  const isActive = keyObj.isActive === true;
  if (isActive) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        Active
      </span>
    );
  }
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        Revoked
      </span>
      {keyObj.revokedAt && (
        <span className="text-[10px] text-gray-400">
          {format(new Date(keyObj.revokedAt), 'd MMM yyyy')}
        </span>
      )}
    </div>
  );
}

// ─── revoke dialog ───────────────────────────────────────────────────────────

function RevokeDialog({ keyObj, onRevoke }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleRevoke() {
    setPending(true);
    try {
      await onRevoke(keyObj._id);
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="text-xs font-medium text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition-colors">
          Revoke
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border border-gray-200 focus:outline-none">
          <Dialog.Title className="text-base font-semibold text-gray-900 mb-1">
            Revoke API key?
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-500 mb-1">
            <span className="font-medium text-gray-800">{keyObj.name}</span>
            {keyObj.keyPrefix && (
              <span className="ml-2 font-mono text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                {keyObj.keyPrefix}…
              </span>
            )}
          </Dialog.Description>
          <p className="text-xs text-red-600 bg-red-50 rounded-md px-3 py-2 mb-5">
            This will immediately block all requests using this key. This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Dialog.Close asChild>
              <button className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">
                Cancel
              </button>
            </Dialog.Close>
            <button
              disabled={pending}
              onClick={handleRevoke}
              className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {pending && <Loader2 className="w-4 h-4 animate-spin" />}
              Revoke Key
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── scopes cell ─────────────────────────────────────────────────────────────

function ScopesCell({ scopes = [] }) {
  const visible = scopes.slice(0, 3);
  const hidden = scopes.slice(3);
  return (
    <div className="flex flex-wrap gap-1 max-w-[200px]">
      {visible.map((s) => (
        <span key={s} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
          {s}
        </span>
      ))}
      {hidden.length > 0 && (
        <span
          className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded cursor-default"
          title={hidden.join(', ')}
        >
          +{hidden.length} more
        </span>
      )}
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [orgFilter, setOrgFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');

  // orgs for dropdown — loaded once
  const { data: orgsData } = useQuery({
    queryKey: ['admin-orgs-list'],
    queryFn: () => listAdminOrgs({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });
  const orgs = Array.isArray(orgsData?.data) ? orgsData.data : Array.isArray(orgsData) ? orgsData : [];

  // paginated api keys
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['admin-apikeys', orgFilter, statusFilter, scopeFilter],
    queryFn: ({ pageParam = 1 }) =>
      listAdminApiKeys({
        orgId: orgFilter || undefined,
        status: statusFilter || undefined,
        scope: scopeFilter || undefined,
        page: pageParam,
        limit: PAGE_SIZE,
      }),
    getNextPageParam: (last, allPages) => {
      const loaded = allPages.length * PAGE_SIZE;
      const total = last?.total ?? 0;
      return loaded < total ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const allKeys = data?.pages.flatMap((page) => page?.data ?? []) ?? [];
  const keys = allKeys;

  const totalLoaded = allKeys.length;
  const totalAvailable = data?.pages?.[0]?.total ?? 0;
  const hasActiveFilters = !!(orgFilter || statusFilter || scopeFilter);

  async function handleRevoke(keyId) {
    queryClient.setQueryData(['admin-apikeys', orgFilter, statusFilter, scopeFilter], (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          data: (page?.data ?? []).map((k) =>
            k._id === keyId
              ? { ...k, isActive: false, revokedAt: new Date().toISOString() }
              : k
          ),
        })),
      };
    });
    try {
      await revokeAdminApiKey(keyId);
      toast.success('Key revoked');
    } catch (err) {
      toast.error(err?.message ?? 'Failed to revoke key');
      queryClient.invalidateQueries({ queryKey: ['admin-apikeys'] });
    }
  }

  const selectBase =
    'border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none';

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <Key className="w-6 h-6 text-indigo-500" />
          Global API Keys
        </h1>
        {!isLoading && (
          <span className="text-sm text-gray-500">
            {keys.length} key{keys.length !== 1 ? 's' : ''} loaded
            {totalAvailable > keys.length && ` of ${totalAvailable}`}
          </span>
        )}
      </div>

      {/* notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          Global oversight view. Monitor and emergency-revoke any API key in the system.
          Keys are created by Org Admins within their organisation settings.
        </p>
      </div>

      {/* filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative">
          <select
            className={`${selectBase} appearance-none pr-8`}
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
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>

        <div className="relative">
          <select
            className={`${selectBase} appearance-none pr-8`}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>

        <div className="relative">
          <select
            className={`${selectBase} appearance-none pr-8`}
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
          >
            <option value="">All Scopes</option>
            {ALL_SCOPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>

        {hasActiveFilters && (
          <button
            onClick={() => { setOrgFilter(''); setStatusFilter(''); setScopeFilter(''); }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs font-semibold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Prefix</th>
                <th className="px-5 py-3">Organisation</th>
                <th className="px-5 py-3">Scopes</th>
                <th className="px-5 py-3">Created by</th>
                <th className="px-5 py-3">Last used</th>
                <th className="px-5 py-3">Expires</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading API keys…
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-red-500">
                    Failed to load API keys.
                  </td>
                </tr>
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center">
                    <p className="text-gray-400 mb-2">
                      {hasActiveFilters ? 'No keys match your filters.' : 'No API keys found.'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={() => { setOrgFilter(''); setStatusFilter(''); setScopeFilter(''); }}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                keys.map((k) => {
                  const isActive = k.isActive === true;
                  const orgId = k.orgId?._id ?? k.orgId;
                  const orgName = k.orgId?.name ?? null;

                  return (
                    <tr
                      key={k._id}
                      className={`transition-colors ${
                        isActive
                          ? 'bg-white hover:bg-indigo-50/20'
                          : 'bg-red-50/30 opacity-70'
                      }`}
                    >
                      <td className="px-5 py-3 font-medium text-gray-900 max-w-[160px] truncate">
                        {k.name}
                      </td>

                      <td className="px-5 py-3">
                        <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                          {String(k.keyPrefix ?? '').slice(0, 16)}…
                        </span>
                      </td>

                      <td className="px-5 py-3 text-gray-700">
                        {orgId && orgName ? (
                          <Link
                            href={`/admin/orgs/${orgId}`}
                            className="text-indigo-600 hover:underline"
                          >
                            {orgName}
                          </Link>
                        ) : orgName ? (
                          orgName
                        ) : (
                          <span className="text-gray-400 italic">Unknown</span>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        <ScopesCell scopes={k.scopes} />
                      </td>

                      <td className="px-5 py-3 text-gray-600 text-xs">
                        {k.createdBy?.username ?? k.createdBy?.email ?? 'System'}
                      </td>

                      <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {lastUsedLabel(k.lastUsedAt)}
                      </td>

                      <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {expiresLabel(k.expiresAt)}
                      </td>

                      <td className="px-5 py-3">
                        <StatusBadge keyObj={k} />
                      </td>

                      <td className="px-5 py-3 text-right">
                        {isActive && (
                          <RevokeDialog keyObj={k} onRevoke={handleRevoke} />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* pagination */}
      {!isLoading && allKeys.length > 0 && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <p className="text-sm text-gray-400">
            Showing {keys.length} of {scopeFilter ? `${allKeys.length} loaded` : `${totalAvailable}`} records
          </p>
          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin" />}
              {isFetchingNextPage ? 'Loading…' : 'Load More'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
