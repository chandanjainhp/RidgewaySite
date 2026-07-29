'use client';

import { useState, useEffect, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
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
import { getAuditLog, exportAuditLog } from '@/lib/api';

// ─── constants ───────────────────────────────────────────────────────────────

const ACTION_GROUPS = [
  {
    label: 'User actions',
    actions: [
      'user.created', 'user.invited', 'user.role_changed', 'user.deactivated',
      'user.activated', 'user.force_logged_out', 'user.invite_resent',
    ],
  },
  {
    label: 'Site actions',
    actions: [
      'org.created', 'org.suspended', 'org.activated',
      'org.config_updated', 'org.webhook_secret_rotated',
      'site.config_updated', 'site.webhook_secret_rotated', 'site.ingestion_secret_rotated',
    ],
  },
  { label: 'System actions', actions: ['briefing.approved', 'investigation.started'] },
];

const CREATES = new Set(['user.created', 'org.created', 'user.invited']);
const UPDATES = new Set([
  'org.config_updated', 'user.role_changed', 'org.activated', 'user.activated', 'org.webhook_secret_rotated',
  'site.config_updated', 'site.webhook_secret_rotated', 'site.ingestion_secret_rotated',
]);
const DESTRUCTIVE = new Set([
  'org.suspended', 'user.force_logged_out', 'user.deactivated',
]);

function actionBadgeStyle(action) {
  if (CREATES.has(action))     return { background: 'rgba(90,135,168,0.2)',  color: '#b8d4e8' };
  if (UPDATES.has(action))     return { background: 'rgba(232,154,43,0.15)', color: '#e89a2b' };
  if (DESTRUCTIVE.has(action)) return { background: 'rgba(255,56,56,0.15)',  color: '#ff3838' };
  return { background: 'rgba(67,77,92,0.5)', color: '#6b7686' };
}

const PAGE_LIMIT = 50;

function todayStr() { return format(new Date(), 'yyyy-MM-dd'); }
function sevenDaysAgoStr() { return format(subDays(new Date(), 7), 'yyyy-MM-dd'); }

// ─── role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }) {
  const styles = {
    super_admin: { background: 'rgba(255,56,56,0.12)',  color: '#ff3838' },
    org_admin:   { background: 'rgba(90,135,168,0.2)',  color: '#b8d4e8' },
    operator:    { background: 'rgba(67,77,92,0.5)',    color: '#6b7686' },
  };
  if (!role) return null;
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded capitalize"
      style={{ fontSize: '10px', fontWeight: 500, ...styles[role] ?? styles.operator }}
    >
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

  const orgName = null ?? null;
  
  return (
    <>
      <tr
        className="cursor-pointer transition-colors"
        style={{ borderBottom: '1px solid var(--border-hairline)' }}
        onClick={handleClick}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-2)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <td
          className="px-5 py-3 whitespace-nowrap"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--fg-3)' }}
        >
          <div className="flex items-center gap-1.5">
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
              : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--fg-4)' }} />
            }
            {log.createdAt ? format(new Date(log.createdAt), 'd MMM yyyy, HH:mm:ss') : '—'}
          </div>
        </td>

        <td className="px-5 py-3">
          {log.actor ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium" style={{ color: 'var(--fg-1)' }}>
                {log.actor.username ?? log.actor.email ?? 'Unknown'}
              </span>
              {log.actorRole && <RoleBadge role={log.actorRole} />}
            </div>
          ) : (
            <span style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 'var(--text-xs)' }}>System</span>
          )}
        </td>

        <td className="px-5 py-3">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            style={{ fontFamily: 'var(--font-mono)', ...actionBadgeStyle(log.action) }}
          >
            {log.action}
          </span>
        </td>

        <td className="px-5 py-3 text-sm" style={{ color: 'var(--fg-2)' }}>
          {false ? (
            <Link
              href="/admin/users"
              className="hover:underline text-xs"
              style={{ color: 'var(--accent)' }}
            >
              {orgName}
            </Link>
          ) : (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-3)' }}>{targetLabel}</span>
          )}
        </td>

        <td className="px-5 py-3">
          {log.ip
            ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--fg-4)' }}>{log.ip}</span>
            : <span style={{ color: 'var(--fg-4)', fontSize: 'var(--text-xs)' }}>—</span>
          }
        </td>
      </tr>

      {expanded && (
        <tr style={{ background: 'var(--bg-surface-2)' }}>
          <td colSpan={5} className="px-8 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <div className="space-y-3">
              <p
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', letterSpacing: '0.08em' }}
              >
                Metadata
              </p>
              <pre
                className="text-xs p-3 rounded overflow-auto max-h-48 whitespace-pre-wrap break-words"
                style={{ background: 'var(--bg-base)', color: '#7d8a6a', fontFamily: 'var(--font-mono)' }}
              >
                {JSON.stringify(log.metadata ?? {}, null, 2)}
              </pre>
              {log.userAgent && (
                <p
                  className="text-xs truncate"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}
                >
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

const dateInputStyle = {
  background: 'var(--bg-base)',
  border: '1px solid var(--border-default)',
  color: 'var(--fg-2)',
  borderRadius: '6px',
  padding: '7px 12px',
  fontSize: 'var(--text-sm)',
  outline: 'none',
};

export default function AuditLogPage() {
  const [dateFrom, setDateFrom] = useState(sevenDaysAgoStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [actionFilter, setActionFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const queryParams = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    action: actionFilter || undefined,
    search: debouncedSearch || undefined,
    limit: PAGE_LIMIT,
  };

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['admin-audit', dateFrom, dateTo, actionFilter, debouncedSearch],
    queryFn: ({ pageParam = 1 }) => getAuditLog({ ...queryParams, page: pageParam }),
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
    !!actionFilter ||
    !!debouncedSearch;

  const clearFilters = useCallback(() => {
    setDateFrom(sevenDaysAgoStr());
    setDateTo(todayStr());
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

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--fg-1)' }}>
          <ShieldCheck className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          Audit Log
        </h1>
        <button
          onClick={handleExport}
          disabled={exporting || isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-40"
          style={{
            color: 'var(--fg-2)',
            border: '1px solid var(--border-default)',
            background: 'transparent',
          }}
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {/* filter bar */}
      <div
        className="p-4 rounded-xl space-y-3"
        style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-default)' }}
      >
        <div className="flex flex-wrap gap-3">
          {/* date range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(e) => setDateFrom(e.target.value)}
              style={dateInputStyle}
            />
            <span style={{ color: 'var(--fg-4)', fontSize: 'var(--text-sm)' }}>to</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={todayStr()}
              onChange={(e) => setDateTo(e.target.value)}
              style={dateInputStyle}
            />
          </div>

          {/* action type */}
          <div className="relative">
            <select style={selectStyle} value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
              <option value="">All Actions</option>
              {ACTION_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.actions.map((a) => <option key={a} value={a}>{a}</option>)}
                </optgroup>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--fg-4)' }} />
          </div>

          {/* search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: 'var(--fg-4)' }}
            />
            <input
              type="text"
              placeholder="Search actor name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border-default)',
                color: 'var(--fg-1)',
                borderRadius: '6px',
                padding: '7px 32px 7px 36px',
                fontSize: 'var(--text-sm)',
                outline: 'none',
                width: '100%',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--fg-4)' }}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-4)' }}>Filters active</span>
            <button
              onClick={clearFilters}
              className="text-xs font-medium underline"
              style={{ color: 'var(--accent)' }}
            >
              Clear all
            </button>
          </div>
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
                {['Timestamp', 'Actor', 'Action', 'Target', 'IP'].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-xs font-semibold uppercase tracking-wider"
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
                  <td colSpan={5} className="px-5 py-10 text-center" style={{ color: 'var(--fg-4)' }}>
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading audit records…
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center" style={{ color: 'var(--sev-serious)' }}>
                    Failed to load audit logs.
                  </td>
                </tr>
              ) : allLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <ShieldCheck className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--fg-4)' }} />
                    <p style={{ color: 'var(--fg-4)' }} className="mb-2">No audit records match your filters.</p>
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
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
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--fg-4)' }}>
            Showing {allLogs.length} of {total} records
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
