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
  try {
    return format(new Date(ts), 'd MMM yyyy HH:mm');
  } catch {
    return '—';
  }
}

function truncate(str, len = 80) {
  if (!str) return '—';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

/* ─── stat card ───────────────────────────────────────────── */

function StatCard({ label, value, color, loading, pulsing, redBorder }) {
  const colorMap = {
    gray: { label: 'text-gray-500', value: 'text-gray-900' },
    blue: { label: 'text-blue-500', value: 'text-blue-600' },
    green: { label: 'text-green-500', value: 'text-green-600' },
    red: { label: 'text-red-500', value: 'text-red-600' },
  };
  const c = colorMap[color] ?? colorMap.gray;

  return (
    <div
      className={`bg-white p-5 rounded-lg border shadow-sm flex flex-col items-center ${
        redBorder ? 'border-red-300' : 'border-gray-200'
      }`}
    >
      <div className={`text-sm font-medium mb-1 flex items-center ${c.label}`}>
        {pulsing && (
          <span className="inline-flex h-2 w-2 rounded-full bg-blue-400 animate-ping mr-1" />
        )}
        {label}
      </div>
      <div className={`text-3xl font-bold ${c.value}`}>
        {loading ? <span className="opacity-40">—</span> : value}
      </div>
    </div>
  );
}

/* ─── delete popover ──────────────────────────────────────── */

function DeletePopover({ onConfirm, onCancel, pending }) {
  return (
    <div className="absolute right-0 top-8 z-10 bg-white border border-gray-200 rounded shadow-lg p-3 w-48">
      <p className="text-xs text-gray-700 mb-3">Remove this job permanently?</p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={pending}
          className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium py-1.5 rounded transition-colors"
        >
          {pending ? 'Deleting…' : 'Confirm'}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 border border-gray-200 text-gray-600 text-xs font-medium py-1.5 rounded hover:bg-gray-50 transition-colors"
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
    // Don't toggle expansion if a button was clicked
    if (e.target.closest('button')) return;
    setExpanded((v) => !v);
  };

  return (
    <>
      <tr
        className="border-b bg-white hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={handleRowClick}
      >
        {/* Queue */}
        <td className="px-4 py-3 font-medium text-gray-800 capitalize whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            )}
            {queueName}
          </div>
        </td>

        {/* Job name */}
        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
          {job.name || <span className="text-gray-400 italic">unnamed</span>}
        </td>

        {/* Error */}
        <td className="px-4 py-3 max-w-xs">
          <span
            className="text-red-600 text-sm truncate block"
            title={errorMsg}
          >
            {truncate(errorMsg, 80)}
          </span>
        </td>

        {/* Attempts */}
        <td className="px-4 py-3 text-center">
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-medium">
            {job.attemptsMade ?? 0}
          </span>
        </td>

        {/* Last failed */}
        <td className="px-4 py-3 text-gray-500 text-sm whitespace-nowrap">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 flex-shrink-0" />
            {formatTs(ts)}
          </span>
        </td>

        {/* Actions */}
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => onRetry(queueName, jobId)}
              disabled={isRetrying || isDeleting}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-40 transition-colors"
              title="Retry job"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Retrying…' : 'Retry'}
            </button>

            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeletePopover((v) => !v);
                }}
                disabled={isDeleting || isRetrying}
                className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                title="Delete job"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>

              {showDeletePopover && (
                <DeletePopover
                  pending={isDeleting}
                  onConfirm={() => {
                    setShowDeletePopover(false);
                    onDelete(queueName, jobId);
                  }}
                  onCancel={() => setShowDeletePopover(false)}
                />
              )}
            </div>
          </div>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={6} className="px-6 py-4 border-b">
            <div className="space-y-4">
              {/* Full error */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Error message
                </p>
                <div className="bg-red-50 border border-red-200 rounded p-3 font-mono text-xs text-red-700 max-h-32 overflow-y-auto whitespace-pre-wrap break-words">
                  {errorMsg}
                </div>
              </div>

              {/* Stack trace */}
              {job.stacktrace?.[0] && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Stack trace
                  </p>
                  <pre className="bg-gray-900 text-red-300 text-xs p-3 rounded overflow-auto max-h-40 whitespace-pre-wrap break-words">
                    {job.stacktrace[0]}
                  </pre>
                </div>
              )}

              {/* Job data */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Job data
                </p>
                <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded overflow-auto max-h-48">
                  {JSON.stringify(job.data, null, 2)}
                </pre>
              </div>

              {/* Attempts timeline */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Attempts
                </p>
                <div className="flex items-center gap-2">
                  {Array.from({ length: job.opts?.attempts ?? job.attemptsMade }).map((_, i) => (
                    <span
                      key={i}
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        i < job.attemptsMade ? 'bg-red-400' : 'bg-gray-200'
                      }`}
                      title={i < job.attemptsMade ? `Attempt ${i + 1} failed` : `Attempt ${i + 1} not reached`}
                    />
                  ))}
                  <span className="text-xs text-gray-500">
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

  // Last-updated tracking
  const [lastUpdated, setLastUpdated] = useState(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  // Mutation tracking (per-job to avoid disabling unrelated rows)
  const [retryingId, setRetryingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  /* queries */
  const {
    data: statsData,
    isLoading: statsLoading,
    isFetching: statsFetching,
  } = useQuery({
    queryKey: ['admin-jobs-stats'],
    queryFn: async () => {
      const res = await getAdminJobStats();
      return res.data?.data ?? res.data ?? [];
    },
    refetchInterval: 30000,
    onSuccess: () => setLastUpdated(Date.now()),
  });

  // TanStack Query v5 uses `select` / meta for side-effects; use a derived state via useEffect instead
  useEffect(() => {
    if (statsData !== undefined) {
      setLastUpdated(Date.now());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsData]);

  const {
    data: failedData,
    isLoading: failedLoading,
  } = useQuery({
    queryKey: ['admin-jobs-failed'],
    queryFn: async () => {
      const res = await listFailedJobs();
      return res.data?.data ?? res.data ?? [];
    },
    refetchInterval: 30000,
  });

  /* seconds-ago ticker */
  useEffect(() => {
    setSecondsAgo(0);
    if (!lastUpdated) return;
    const id = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  /* derived data */
  const queues = Array.isArray(statsData) ? statsData : [];
  const totals = aggregate(queues);
  const failedJobs = Array.isArray(failedData) ? failedData : [];

  /* optimistic removal helper */
  const removeJobFromCache = useCallback(
    (jobId) => {
      queryClient.setQueryData(['admin-jobs-failed'], (old) => {
        if (!old) return old;
        // Handle both raw array and wrapped { data: [...] } shapes
        if (Array.isArray(old)) return old.filter((j) => j.id !== jobId);
        if (Array.isArray(old.data))
          return { ...old, data: old.data.filter((j) => j.id !== jobId) };
        return old;
      });
    },
    [queryClient],
  );

  /* handlers */
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

  /* ── render ── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <Activity className="w-6 h-6 text-indigo-500" />
          Job Queues
        </h1>

        {statsFetching && (
          <span className="text-sm text-gray-500 flex items-center gap-1.5">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Refreshing…
          </span>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Waiting"
          value={totals.waiting}
          color="gray"
          loading={statsLoading}
        />
        <StatCard
          label="Active"
          value={totals.active}
          color="blue"
          loading={statsLoading}
          pulsing
        />
        <StatCard
          label="Completed"
          value={totals.completed}
          color="green"
          loading={statsLoading}
        />
        <StatCard
          label="Failed"
          value={totals.failed}
          color="red"
          loading={statsLoading}
          redBorder={totals.failed > 0}
        />
      </div>

      {/* Last updated */}
      {lastUpdated && (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Last updated {secondsAgo} seconds ago
        </p>
      )}

      {/* Failed jobs section */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <h3 className="text-base font-semibold text-gray-900">Failed Jobs</h3>
          {!failedLoading && (
            <span className="ml-auto text-xs bg-red-100 text-red-700 font-medium px-2 py-0.5 rounded-full">
              {failedJobs.length}
            </span>
          )}
        </div>

        {failedLoading ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 opacity-40" />
            Loading failed jobs…
          </div>
        ) : failedJobs.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
            <p className="text-gray-600 font-medium">No failed jobs — all queues are healthy</p>
            <p className="text-gray-400 text-sm">Failed jobs will appear here for review and retry.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Queue</th>
                  <th className="px-4 py-3 font-semibold">Job name</th>
                  <th className="px-4 py-3 font-semibold">Error</th>
                  <th className="px-4 py-3 font-semibold text-center">Attempts</th>
                  <th className="px-4 py-3 font-semibold">Last failed</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
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
