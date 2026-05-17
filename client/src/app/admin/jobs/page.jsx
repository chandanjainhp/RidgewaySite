'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Activity,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import {
  getAdminJobStats,
  listFailedJobs,
  retryAdminJob,
  deleteAdminJob,
} from '@/lib/api';

/* ─── helpers ─────────────────────────────────────────────── */

function aggregate(queues = []) {
  return queues.reduce(
    (acc, q) => ({
      waiting: acc.waiting + (q.waiting ?? 0),
      active: acc.active + (q.active ?? 0),
      completed: acc.completed + (q.completed ?? 0),
      failed: acc.failed + (q.failed ?? 0),
      delayed: acc.delayed + (q.delayed ?? 0),
    }),
    { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
  );
}

function formatTs(ts) {
  if (!ts) return '—';
  try { return format(new Date(ts), 'd MMM yyyy HH:mm'); }
  catch { return '—'; }
}

function truncate(str, len = 80) {
  if (!str) return '—';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

/* ─── stat card ───────────────────────────────────────────── */

const STAT_COLOR = {
  gray:  { value: 'var(--fg-2)' },
  blue:  { value: 'var(--accent)' },
  green: { value: '#7d8a6a' },
  red:   { value: 'var(--sev-serious)' },
};

function StatCard({ label, value, color, loading, pulsing, redBorder }) {
  const c = STAT_COLOR[color] ?? STAT_COLOR.gray;
  return (
    <div
      className="p-5 rounded-lg flex flex-col items-center"
      style={{
        background: 'var(--bg-surface-1)',
        border: redBorder
          ? '1px solid rgba(255,56,56,0.4)'
          : '1px solid var(--border-default)',
      }}
    >
      <div
        className="text-sm font-medium mb-1 flex items-center gap-1"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.08em' }}
      >
        {pulsing && (
          <span className="inline-flex h-1.5 w-1.5 rounded-full animate-ping" style={{ background: 'var(--accent)' }} />
        )}
        {label}
      </div>
      <div
        className="text-3xl font-bold"
        style={{ color: loading ? 'var(--fg-4)' : c.value }}
      >
        {loading ? '—' : value}
      </div>
    </div>
  );
}

/* ─── delete popover ──────────────────────────────────────── */

function DeletePopover({ onConfirm, onCancel, pending }) {
  return (
    <div
      className="absolute right-0 top-8 z-10 rounded p-3 w-48"
      style={{
        background: 'var(--bg-surface-2)',
        border: '1px solid var(--border-default)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}
    >
      <p className="text-xs mb-3" style={{ color: 'var(--fg-2)' }}>Remove this job permanently?</p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={pending}
          className="flex-1 text-white text-xs font-medium py-1.5 rounded transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: 'var(--sev-serious)' }}
        >
          {pending ? 'Deleting…' : 'Confirm'}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 text-xs font-medium py-1.5 rounded transition-colors"
          style={{ border: '1px solid var(--border-default)', color: 'var(--fg-2)', background: 'transparent' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ─── failed job row ──────────────────────────────────────── */

function JobRow({ job, onRetry, onDelete, retryingId, deletingId }) {
  const [expanded, setExpanded] = useState(false);
  const [showDeletePopover, setShowDeletePopover] = useState(false);

  const jobId = job.id;
  const queueName = job.queue || job.queueName || '—';
  const errorMsg = job.failedReason || job.message || '—';
  const ts = job.finishedOn || job.processedOn;
  const isRetrying = retryingId === jobId;
  const isDeleting = deletingId === jobId;

  const handleRowClick = (e) => {
    if (e.target.closest('button')) return;
    setExpanded((v) => !v);
  };

  return (
    <>
      <tr
        className="cursor-pointer transition-colors"
        style={{ borderBottom: '1px solid var(--border-hairline)' }}
        onClick={handleRowClick}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-2)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <td className="px-4 py-3 font-medium capitalize whitespace-nowrap" style={{ color: 'var(--fg-1)' }}>
          <div className="flex items-center gap-1.5">
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
              : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--fg-4)' }} />
            }
            {queueName}
          </div>
        </td>

        <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--fg-2)' }}>
          {job.name || <span style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>unnamed</span>}
        </td>

        <td className="px-4 py-3 max-w-xs">
          <span className="text-sm truncate block" style={{ color: 'var(--sev-serious)' }} title={errorMsg}>
            {truncate(errorMsg, 80)}
          </span>
        </td>

        <td className="px-4 py-3 text-center">
          <span
            className="px-2 py-0.5 rounded text-xs font-medium"
            style={{ background: 'var(--bg-surface-3)', color: 'var(--fg-2)' }}
          >
            {job.attemptsMade ?? 0}
          </span>
        </td>

        <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: 'var(--fg-3)' }}>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 flex-shrink-0" />
            {formatTs(ts)}
          </span>
        </td>

        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => onRetry(queueName, jobId)}
              disabled={isRetrying || isDeleting}
              className="inline-flex items-center gap-1 text-xs font-medium disabled:opacity-40 transition-colors"
              style={{ color: 'var(--accent)' }}
              title="Retry job"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Retrying…' : 'Retry'}
            </button>

            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowDeletePopover((v) => !v); }}
                disabled={isDeleting || isRetrying}
                className="inline-flex items-center gap-1 text-xs font-medium disabled:opacity-40 transition-colors"
                style={{ color: 'var(--sev-serious)' }}
                title="Delete job"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>

              {showDeletePopover && (
                <DeletePopover
                  pending={isDeleting}
                  onConfirm={() => { setShowDeletePopover(false); onDelete(queueName, jobId); }}
                  onCancel={() => setShowDeletePopover(false)}
                />
              )}
            </div>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr style={{ background: 'var(--bg-surface-2)' }}>
          <td colSpan={6} className="px-6 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <div className="space-y-4">
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-wider mb-1"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', letterSpacing: '0.08em' }}
                >
                  Error message
                </p>
                <div
                  className="text-xs p-3 rounded max-h-32 overflow-y-auto whitespace-pre-wrap break-words"
                  style={{ background: 'rgba(255,56,56,0.08)', border: '1px solid rgba(255,56,56,0.2)', color: '#ff3838', fontFamily: 'var(--font-mono)' }}
                >
                  {errorMsg}
                </div>
              </div>

              {job.stacktrace?.[0] && (
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-wider mb-1"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', letterSpacing: '0.08em' }}
                  >
                    Stack trace
                  </p>
                  <pre
                    className="text-xs p-3 rounded overflow-auto max-h-40 whitespace-pre-wrap break-words"
                    style={{ background: 'var(--bg-base)', color: '#ff3838', fontFamily: 'var(--font-mono)' }}
                  >
                    {job.stacktrace[0]}
                  </pre>
                </div>
              )}

              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-wider mb-1"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', letterSpacing: '0.08em' }}
                >
                  Job data
                </p>
                <pre
                  className="text-xs p-3 rounded overflow-auto max-h-48"
                  style={{ background: 'var(--bg-base)', color: '#7d8a6a', fontFamily: 'var(--font-mono)' }}
                >
                  {JSON.stringify(job.data, null, 2)}
                </pre>
              </div>

              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-wider mb-1"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', letterSpacing: '0.08em' }}
                >
                  Attempts
                </p>
                <div className="flex items-center gap-2">
                  {Array.from({ length: job.opts?.attempts ?? job.attemptsMade }).map((_, i) => (
                    <span
                      key={i}
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{
                        background: i < job.attemptsMade ? 'var(--sev-serious)' : 'var(--bg-surface-3)',
                      }}
                      title={i < job.attemptsMade ? `Attempt ${i + 1} failed` : `Attempt ${i + 1} not reached`}
                    />
                  ))}
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-3)' }}>
                    {job.attemptsMade} of {job.opts?.attempts ?? job.attemptsMade} attempt
                    {(job.opts?.attempts ?? job.attemptsMade) !== 1 ? 's' : ''} made
                  </span>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── page ────────────────────────────────────────────────── */

export default function JobsPage() {
  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [retryingId, setRetryingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const { data: statsData, isLoading: statsLoading, isFetching: statsFetching } = useQuery({
    queryKey: ['admin-jobs-stats'],
    queryFn: async () => {
      const data = await getAdminJobStats();
      return Array.isArray(data) ? data : data?.data ?? [];
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (statsData !== undefined) setLastUpdated(Date.now());
  }, [statsData]);

  const { data: failedData, isLoading: failedLoading } = useQuery({
    queryKey: ['admin-jobs-failed'],
    queryFn: async () => {
      const data = await listFailedJobs();
      return Array.isArray(data) ? data : data?.data ?? [];
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    setSecondsAgo(0);
    if (!lastUpdated) return;
    const id = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  const queues = Array.isArray(statsData) ? statsData : [];
  const totals = aggregate(queues);
  const failedJobs = Array.isArray(failedData) ? failedData : [];

  const removeJobFromCache = useCallback(
    (jobId) => {
      queryClient.setQueryData(['admin-jobs-failed'], (old) => {
        if (!old) return old;
        if (Array.isArray(old)) return old.filter((j) => j.id !== jobId);
        if (Array.isArray(old.data)) return { ...old, data: old.data.filter((j) => j.id !== jobId) };
        return old;
      });
    },
    [queryClient],
  );

  const handleRetry = async (queueName, jobId) => {
    setRetryingId(jobId);
    try {
      await retryAdminJob(queueName, jobId);
      removeJobFromCache(jobId);
      toast.success('Job queued for retry');
      queryClient.invalidateQueries({ queryKey: ['admin-jobs-stats'] });
    } catch {
      toast.error('Failed to retry job');
    } finally {
      setRetryingId(null);
    }
  };

  const handleDelete = async (queueName, jobId) => {
    setDeletingId(jobId);
    try {
      await deleteAdminJob(queueName, jobId);
      removeJobFromCache(jobId);
      toast.success('Job deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-jobs-stats'] });
    } catch {
      toast.error('Failed to delete job');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--fg-1)' }}>
          <Activity className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          Job Queues
        </h1>
        {statsFetching && (
          <span className="text-sm flex items-center gap-1.5" style={{ color: 'var(--fg-3)' }}>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Refreshing…
          </span>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Waiting"   value={totals.waiting}   color="gray"  loading={statsLoading} />
        <StatCard label="Active"    value={totals.active}    color="blue"  loading={statsLoading} pulsing />
        <StatCard label="Completed" value={totals.completed} color="green" loading={statsLoading} />
        <StatCard label="Failed"    value={totals.failed}    color="red"   loading={statsLoading} redBorder={totals.failed > 0} />
      </div>

      {/* Last updated */}
      {lastUpdated && (
        <p className="flex items-center gap-1" style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>
          <Clock className="w-3 h-3" />
          Last updated {secondsAgo}s ago
        </p>
      )}

      {/* Failed jobs section */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-default)' }}
      >
        <div
          className="px-6 py-4 flex items-center gap-2"
          style={{ background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border-default)' }}
        >
          <AlertCircle className="w-5 h-5" style={{ color: 'var(--sev-serious)' }} />
          <h3 className="text-base font-semibold" style={{ color: 'var(--fg-1)' }}>Failed Jobs</h3>
          {!failedLoading && (
            <span
              className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,56,56,0.15)', color: '#ff3838' }}
            >
              {failedJobs.length}
            </span>
          )}
        </div>

        {failedLoading ? (
          <div className="px-6 py-12 text-center text-sm" style={{ color: 'var(--fg-4)' }}>
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 opacity-40" />
            Loading failed jobs…
          </div>
        ) : failedJobs.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="w-10 h-10" style={{ color: '#7d8a6a' }} />
            <p className="font-medium" style={{ color: 'var(--fg-2)' }}>No failed jobs — all queues are healthy</p>
            <p className="text-sm" style={{ color: 'var(--fg-4)' }}>Failed jobs will appear here for review and retry.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr style={{ background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border-default)' }}>
                  {['Queue', 'Job name', 'Error', 'Attempts', 'Last failed', 'Actions'].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${i === 3 ? 'text-center' : i === 5 ? 'text-right' : ''}`}
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {failedJobs.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    onRetry={handleRetry}
                    onDelete={handleDelete}
                    retryingId={retryingId}
                    deletingId={deletingId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
