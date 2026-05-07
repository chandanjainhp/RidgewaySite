'use client';

import { useState, useEffect, useCallback } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import {
  ShieldCheck,
  Download,
  ChevronDown,
  ChevronRight,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import { getAuditLog, exportAuditLog, listAdminOrgs } from '@/lib/api';

// ─── constants ───────────────────────────────────────────────────────────────

const ACTION_GROUPS = [
  {
    label: 'User actions',
    actions: [
      'user.created',
      'user.invited',
      'user.role_changed',
      'user.deactivated',
      'user.activated',
      'user.force_logged_out',
      'user.invite_resent',
    ],
  },
  {
    label: 'Organisation actions',
    actions: [
      'org.created',
      'org.suspended',
      'org.activated',
      'org.config_updated',
      'org.webhook_secret_rotated',
    ],
  },
  {
    label: 'API Key actions',
    actions: ['apiKey.created', 'apiKey.revoked'],
  },
  {
    label: 'System actions',
    actions: ['mcp.tool_called', 'briefing.approved', 'investigation.started'],
  },
];

const CREATES = new Set([
  'user.created', 'org.created', 'apiKey.created', 'user.invited',
]);
const UPDATES = new Set([
  'org.config_updated', 'user.role_changed', 'org.activated', 'user.activated',
  'org.webhook_secret_rotated',
]);
const DESTRUCTIVE = new Set([
  'org.suspended', 'apiKey.revoked', 'user.force_logged_out', 'user.deactivated',
]);

function actionBadgeClass(action) {
  if (CREATES.has(action)) return 'bg-blue-100 text-blue-700';
  if (UPDATES.has(action)) return 'bg-amber-100 text-amber-700';
  if (DESTRUCTIVE.has(action)) return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-600';
}

const PAGE_LIMIT = 50;

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd');
}

function sevenDaysAgoStr() {
  return format(subDays(new Date(), 7), 'yyyy-MM-dd');
}

// ─── role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }) {
  const map = {
    super_admin: 'bg-purple-100 text-purple-700',
    org_admin: 'bg-blue-100 text-blue-700',
    operator: 'bg-gray-100 text-gray-600',
  };
  if (!role) return null;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${map[role] ?? 'bg-gray-100 text-gray-600'}`}>
      {role.replace('_', ' ')}
    </span>
  );
}

// ─── expanded row ─────────────────────────────────────────────────────────────

function AuditRow({ log }) {
  const [expanded, setExpanded] = useState(false);

  const handleClick = (e) => {
    if (e.target.closest('a')) return;
    setExpanded((v) => !v);
  };

  const targetLabel = log.target
    ? `${log.target.type}${log.target.id ? ': ' + String(log.target.id).slice(0, 12) + '…' : ''}`
    : '—';

  const orgName = log.orgId?.name ?? null;
  const orgId = log.orgId?._id ?? log.orgId ?? null;

  return (
    <>
      <tr
        className="border-b bg-white hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={handleClick}
      >
        {/* expand chevron + timestamp */}
        <td className="px-5 py-3 whitespace-nowrap text-xs text-gray-500 font-mono">
          <div className="flex items-center gap-1.5">
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            }
            {log.createdAt
              ? format(new Date(log.createdAt), 'd MMM yyyy, HH:mm:ss')
              : '—'}
          </div>
        </td>

        {/* actor */}
        <td className="px-5 py-3">
          {log.actor ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-gray-900">
                {log.actor.username ?? log.actor.email ?? 'Unknown'}
              </span>
              {log.actorRole && <RoleBadge role={log.actorRole} />}
            </div>
          ) : (
            <span className="text-gray-400 italic text-xs">System</span>
          )}
        </td>

        {/* action */}
        <td className="px-5 py-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${actionBadgeClass(log.action)}`}>
            {log.action}
          </span>
        </td>

        {/* target */}
        <td className="px-5 py-3 text-sm text-gray-700">
          {orgName && orgId ? (
            <Link href={`/admin/orgs/${orgId}`} className="text-indigo-600 hover:underline text-xs">
              {orgName}
            </Link>
          ) : (
            <span className="text-xs text-gray-500">{targetLabel}</span>
          )}
        </td>

        {/* ip */}
        <td className="px-5 py-3">
          {log.ip
            ? <span className="font-mono text-xs text-gray-400">{log.ip}</span>
            : <span className="text-gray-300 text-xs">—</span>
          }
        </td>
      </tr>

      {expanded && (
        <tr className="bg-gray-50 border-b">
          <td colSpan={5} className="px-8 py-4">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Metadata
              </p>
              <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded overflow-auto max-h-48 whitespace-pre-wrap break-words">
                {JSON.stringify(log.metadata ?? {}, null, 2)}
              </pre>
              {log.userAgent && (
                <p className="text-xs text-gray-400 font-mono truncate">
                  UA: {log.userAgent}
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const [dateFrom, setDateFrom] = useState(sevenDaysAgoStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [orgFilter, setOrgFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // orgs dropdown — loaded once
  const { data: orgsData } = useQuery({
    queryKey: ['admin-orgs-list'],
    queryFn: () => listAdminOrgs({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });
  const orgs = orgsData?.orgs ?? orgsData?.data ?? [];

  const queryParams = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    orgId: orgFilter || undefined,
    action: actionFilter || undefined,
    search: debouncedSearch || undefined,
    limit: PAGE_LIMIT,
  };

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['admin-audit', dateFrom, dateTo, orgFilter, actionFilter, debouncedSearch],
    queryFn: ({ pageParam = 1 }) =>
      getAuditLog({ ...queryParams, page: pageParam }),
    getNextPageParam: (last, allPages) => {
      const loaded = allPages.length * PAGE_LIMIT;
      const total = last?.total ?? 0;
      return loaded < total ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const allLogs = data?.pages.flatMap((page) => page?.data ?? []) ?? [];
  const total = data?.pages?.[0]?.total ?? 0;

  const hasActiveFilters =
    dateFrom !== sevenDaysAgoStr() ||
    dateTo !== todayStr() ||
    !!orgFilter ||
    !!actionFilter ||
    !!debouncedSearch;

  const clearFilters = useCallback(() => {
    setDateFrom(sevenDaysAgoStr());
    setDateTo(todayStr());
    setOrgFilter('');
    setActionFilter('');
    setSearch('');
    setDebouncedSearch('');
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await exportAuditLog(queryParams);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (err) {
      toast.error(err?.message ?? 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  const selectBase =
    'border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none';

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-indigo-500" />
          Audit Log
        </h1>
        <button
          onClick={handleExport}
          disabled={exporting || isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {exporting
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Download className="w-4 h-4" />
          }
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {/* filter bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-3">
          {/* date range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(e) => setDateFrom(e.target.value)}
              className={selectBase}
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={todayStr()}
              onChange={(e) => setDateTo(e.target.value)}
              className={selectBase}
            />
          </div>

          {/* org dropdown */}
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

          {/* action type */}
          <div className="relative">
            <select
              className={`${selectBase} appearance-none pr-8`}
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">All Actions</option>
              {ACTION_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.actions.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>

          {/* search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search actor name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Filters active</span>
            <button
              onClick={clearFilters}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs font-semibold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Target</th>
                <th className="px-5 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading audit records…
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-red-500">
                    Failed to load audit logs.
                  </td>
                </tr>
              ) : allLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <ShieldCheck className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 mb-2">No audit records match your filters.</p>
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                allLogs.map((log) => <AuditRow key={log._id} log={log} />)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* load more + count */}
      {!isLoading && allLogs.length > 0 && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <p className="text-sm text-gray-400">
            Showing {allLogs.length} of {total} records
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
