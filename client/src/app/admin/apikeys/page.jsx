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
];

const PAGE_SIZE = 50;

function lastUsedLabel(lastUsedAt) {
  if (!lastUsedAt) return 'Never';
  try { return formatDistanceToNow(new Date(lastUsedAt), { addSuffix: true }); }
  catch { return 'Unknown'; }
}

function expiresLabel(expiresAt) {
  if (!expiresAt) return 'No expiry';
  try { return format(new Date(expiresAt), 'd MMM yyyy'); }
  catch { return 'Unknown'; }
}

function StatusBadge({ keyObj }) {
  const isActive = keyObj.isActive === true;
  if (isActive) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{ background: 'rgba(125,138,106,0.2)', color: '#7d8a6a' }}
      >
        Active
      </span>
    );
  }
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{ background: 'rgba(255,56,56,0.15)', color: '#ff3838' }}
      >
        Revoked
      </span>
      {keyObj.revokedAt && (
        <span
          style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--fg-4)' }}
        >
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
    try { await onRevoke(keyObj._id); setOpen(false); }
    finally { setPending(false); }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className="text-xs font-medium px-2 py-1 rounded transition-colors"
          style={{ color: '#ff3838' }}
        >
          Revoke
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl p-6 w-full max-w-md focus:outline-none space-y-4"
          style={{
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          }}
        >
          <Dialog.Title className="text-base font-semibold" style={{ color: 'var(--fg-1)' }}>
            Revoke API key?
          </Dialog.Title>
          <Dialog.Description className="text-sm" style={{ color: 'var(--fg-3)' }}>
            <span style={{ color: 'var(--fg-2)', fontWeight: 500 }}>{keyObj.name}</span>
            {keyObj.keyPrefix && (
              <span
                className="ml-2 px-1.5 py-0.5 rounded"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', background: 'var(--bg-surface-3)', color: 'var(--fg-3)' }}
              >
                {keyObj.keyPrefix}…
              </span>
            )}
          </Dialog.Description>
          <p
            className="text-xs rounded-md px-3 py-2"
            style={{ color: '#ff3838', background: 'rgba(255,56,56,0.08)', border: '1px solid rgba(255,56,56,0.2)' }}
          >
            This will immediately block all requests using this key. This cannot be undone.
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
              disabled={pending}
              onClick={handleRevoke}
              className="px-4 py-2 text-sm rounded-lg disabled:opacity-50 flex items-center gap-2"
              style={{ background: '#ff3838', color: '#fff' }}
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
        <span
          key={s}
          className="px-1.5 py-0.5 rounded"
          style={{ fontSize: '10px', background: 'var(--bg-surface-3)', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}
        >
          {s}
        </span>
      ))}
      {hidden.length > 0 && (
        <span
          className="px-1.5 py-0.5 rounded cursor-default"
          style={{ fontSize: '10px', background: 'rgba(90,135,168,0.2)', color: '#b8d4e8' }}
          title={hidden.join(', ')}
        >
          +{hidden.length} more
        </span>
      )}
    </div>
  );
}

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

// ─── main page ───────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [listFilter, setListFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');

  const { data: orgsData } = useQuery({
    queryKey: ['admin-orgs-list'],
    queryFn: () => listAdminOrgs({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });
  const orgs = Array.isArray(orgsData?.data) ? orgsData.data : Array.isArray(orgsData) ? orgsData : [];

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['admin-apikeys', listFilter, statusFilter, scopeFilter],
    queryFn: ({ pageParam = 1 }) =>
      listAdminApiKeys({
        
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
  const hasActiveFilters = !!(listFilter || statusFilter || scopeFilter);

  async function handleRevoke(keyId) {
    queryClient.setQueryData(['admin-apikeys', listFilter, statusFilter, scopeFilter], (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          data: (page?.data ?? []).map((k) =>
            k._id === keyId ? { ...k, isActive: false, revokedAt: new Date().toISOString() } : k
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

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--fg-1)' }}>
          <Key className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          Global API Keys
        </h1>
        {!isLoading && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--fg-4)' }}>
            {keys.length} key{keys.length !== 1 ? 's' : ''} loaded
            {totalAvailable > keys.length && ` of ${totalAvailable}`}
          </span>
        )}
      </div>

      {/* notice */}
      <div
        className="rounded-xl p-4 flex items-start gap-3"
        style={{ background: 'rgba(232,154,43,0.08)', border: '1px solid rgba(232,154,43,0.25)' }}
      >
        <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#e89a2b' }} />
        <p className="text-sm" style={{ color: '#e89a2b' }}>
          Global oversight view. Monitor and emergency-revoke any API key in the system.
          Keys are created by Org Admins within their site settings.
        </p>
      </div>

      {/* filters */}
      <div
        className="p-4 rounded-xl flex flex-wrap gap-3 items-center"
        style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-default)' }}
      >
        <div className="relative">
          <select style={selectStyle} value={listFilter} onChange={(e) => setListFilter(e.target.value)}>
            <option value="">All Sites</option>
            {orgs.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--fg-4)' }} />
        </div>

        <div className="relative">
          <select style={selectStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--fg-4)' }} />
        </div>

        <div className="relative">
          <select style={selectStyle} value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)}>
            <option value="">All Scopes</option>
            {ALL_SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--fg-4)' }} />
        </div>

        {hasActiveFilters && (
          <button
            onClick={() => { setListFilter(''); setStatusFilter(''); setScopeFilter(''); }}
            className="text-xs underline"
            style={{ color: 'var(--fg-3)' }}
          >
            Clear filters
          </button>
        )}
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
                {['Name', 'Prefix', 'Site', 'Scopes', 'Created by', 'Last used', 'Expires', 'Status', 'Actions'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider ${i === 8 ? 'text-right' : ''}`}
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
                  <td colSpan={9} className="px-5 py-10 text-center" style={{ color: 'var(--fg-4)' }}>
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading API keys…
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center" style={{ color: 'var(--sev-serious)' }}>
                    Failed to load API keys.
                  </td>
                </tr>
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center">
                    <p style={{ color: 'var(--fg-4)' }} className="mb-2">
                      {hasActiveFilters ? 'No keys match your filters.' : 'No API keys found.'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={() => { setListFilter(''); setStatusFilter(''); setScopeFilter(''); }}
                        className="text-sm font-medium"
                        style={{ color: 'var(--accent)' }}
                      >
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                keys.map((k) => {
                  const isActive = k.isActive === true;
                                    const orgName = null ?? null;

                  return (
                    <tr
                      key={k._id}
                      className="transition-colors"
                      style={{
                        borderBottom: '1px solid var(--border-hairline)',
                        opacity: isActive ? 1 : 0.5,
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-2)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td className="px-5 py-3 font-medium max-w-[160px] truncate" style={{ color: 'var(--fg-1)' }}>
                        {k.name}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="px-2 py-0.5 rounded"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', background: 'var(--bg-surface-3)', color: 'var(--fg-2)' }}
                        >
                          {String(k.keyPrefix ?? '').slice(0, 16)}…
                        </span>
                      </td>
                      <td className="px-5 py-3" style={{ color: 'var(--fg-2)' }}>
                        {false ? (
                          <Link
                            href="/admin/users"
                            style={{ color: 'var(--accent)' }}
                            className="hover:underline"
                          >
                            {orgName}
                          </Link>
                        ) : orgName ? (
                          orgName
                        ) : (
                          <span style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>Unknown</span>
                        )}
                      </td>
                      <td className="px-5 py-3"><ScopesCell scopes={k.scopes} /></td>
                      <td
                        className="px-5 py-3 text-xs"
                        style={{ color: 'var(--fg-3)' }}
                      >
                        {k.createdBy?.username ?? k.createdBy?.email ?? 'System'}
                      </td>
                      <td
                        className="px-5 py-3 whitespace-nowrap"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--fg-3)' }}
                      >
                        {lastUsedLabel(k.lastUsedAt)}
                      </td>
                      <td
                        className="px-5 py-3 whitespace-nowrap"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--fg-3)' }}
                      >
                        {expiresLabel(k.expiresAt)}
                      </td>
                      <td className="px-5 py-3"><StatusBadge keyObj={k} /></td>
                      <td className="px-5 py-3 text-right">
                        {isActive && <RevokeDialog keyObj={k} onRevoke={handleRevoke} />}
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
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--fg-4)' }}>
            Showing {keys.length} of {scopeFilter ? `${allKeys.length} loaded` : `${totalAvailable}`} records
          </p>
          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
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
          )}
        </div>
      )}
    </div>
  );
}
