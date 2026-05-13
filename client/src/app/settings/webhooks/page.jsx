'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Switch from '@radix-ui/react-switch';
import * as Dialog from '@radix-ui/react-dialog';
import * as Collapsible from '@radix-ui/react-collapsible';
import * as Checkbox from '@radix-ui/react-checkbox';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Webhook,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Loader2,
  AlertTriangle,
  KeyRound,
  FlaskConical,
  ChevronRight,
  Code2,
  Clock,
} from 'lucide-react';
import {
  getOrgWebhooks,
  getWebhookDeliveries,
  updateOrgConfig,
  testWebhook,
  rotateWebhookSecret,
  retryWebhookDelivery,
} from '@/lib/api';

/* ─── helpers ─────────────────────────────────────────── */

function stripHttps(url = '') {
  return url.replace(/^https?:\/\//, '');
}

function statusColor(status) {
  if (status === 'delivered') return 'bg-green-100 text-green-800';
  if (status === 'pending') return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

function httpCodeColor(code) {
  if (!code) return 'text-gray-400';
  if (code >= 200 && code < 300) return 'text-green-600 font-mono';
  if (code >= 400) return 'text-red-600 font-mono';
  return 'text-amber-600 font-mono';
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {});
}

/* ─── sub-components ──────────────────────────────────── */

function SectionCard({ title, icon: Icon, children, className = '' }) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-gray-500" />}
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function EventTypeBadge({ type }) {
  const colors = {
    'incident.created': 'bg-red-100 text-red-800',
    'incident.classified': 'bg-orange-100 text-orange-800',
    'briefing.approved': 'bg-blue-100 text-blue-800',
    'investigation.completed': 'bg-purple-100 text-purple-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-mono ${colors[type] || 'bg-gray-100 text-gray-700'}`}>
      {type}
    </span>
  );
}

/* ─── Rotate Secret Dialog ────────────────────────────── */

function RotateSecretDialog({ onNewSecret }) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRotate = async () => {
    setLoading(true);
    try {
      const result = await rotateWebhookSecret();
      const secret = result?.secret ?? result;
      toast.success('Webhook secret rotated');
      setOpen(false);
      setConfirmed(false);
      onNewSecret(secret);
    } catch (err) {
      toast.error(err?.message || 'Failed to rotate secret');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmed(false); }}>
      <Dialog.Trigger asChild>
        <button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <RefreshCw className="w-3.5 h-3.5" />
          Rotate Secret
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-2xl p-6 focus:outline-none">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <Dialog.Title className="text-base font-semibold text-gray-900">Rotate HMAC Secret</Dialog.Title>
              <Dialog.Description className="text-sm text-gray-500 mt-1">
                A new secret will be generated. All existing webhook signatures will immediately become invalid.
              </Dialog.Description>
            </div>
          </div>

          <div
            className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-md cursor-pointer select-none mb-6"
            onClick={() => setConfirmed((v) => !v)}
          >
            <Checkbox.Root
              checked={confirmed}
              onCheckedChange={setConfirmed}
              className="w-4 h-4 mt-0.5 flex-shrink-0 border-2 border-amber-400 rounded bg-white data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox.Indicator>
                <Check className="w-3 h-3 text-white" />
              </Checkbox.Indicator>
            </Checkbox.Root>
            <span className="text-sm text-amber-800">
              I understand this will invalidate all existing signatures on every connected webhook consumer
            </span>
          </div>

          <div className="flex justify-end gap-3">
            <Dialog.Close asChild>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Cancel
              </button>
            </Dialog.Close>
            <button
              disabled={!confirmed || loading}
              onClick={handleRotate}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Rotate Secret
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ─── New Secret Reveal Modal ─────────────────────────── */

function NewSecretRevealModal({ secret, onClose }) {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const handleCopy = () => {
    copyToClipboard(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog.Root open={!!secret} onOpenChange={(open) => { if (!open && acknowledged) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-xl shadow-2xl p-6 focus:outline-none">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <KeyRound className="w-5 h-5 text-yellow-600" />
            </div>
            <Dialog.Title className="text-base font-semibold text-gray-900">New HMAC Secret</Dialog.Title>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Copy this secret now. It will not be shown again. Store it securely and update all webhook consumers.
          </p>

          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between gap-3">
              <code className="text-sm font-mono text-yellow-900 break-all flex-1">{secret}</code>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-yellow-800 bg-yellow-200 rounded hover:bg-yellow-300 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div
            className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-md cursor-pointer select-none mb-6"
            onClick={() => setAcknowledged((v) => !v)}
          >
            <Checkbox.Root
              checked={acknowledged}
              onCheckedChange={setAcknowledged}
              className="w-4 h-4 flex-shrink-0 border-2 border-gray-400 rounded bg-white data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox.Indicator>
                <Check className="w-3 h-3 text-white" />
              </Checkbox.Indicator>
            </Checkbox.Root>
            <span className="text-sm text-gray-700">I have copied the secret to a secure location</span>
          </div>

          <div className="flex justify-end">
            <button
              disabled={!acknowledged}
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Done
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ─── Delivery Row ────────────────────────────────────── */

function DeliveryRow({ delivery, onRetry }) {
  const [expanded, setExpanded] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry(delivery._id ?? delivery.id);
      toast.success('Queued for retry');
    } catch (err) {
      toast.error(err?.message || 'Failed to queue retry');
    } finally {
      setRetrying(false);
    }
  };

  const isFailed = delivery.status === 'failed';
  const ts = delivery.timestamp ?? delivery.createdAt ?? delivery.sentAt;

  return (
    <>
      <tr
        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3">
          <EventTypeBadge type={delivery.eventType} />
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${statusColor(delivery.status)}`}>
            {delivery.status}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{delivery.attempts ?? 1}</td>
        <td className={`px-4 py-3 text-sm ${httpCodeColor(delivery.responseStatus ?? delivery.httpStatus)}`}>
          {delivery.responseStatus ?? delivery.httpStatus ?? '—'}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
          {ts ? format(new Date(ts), 'MMM d, HH:mm:ss') : '—'}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            {isFailed && (
              <button
                onClick={(e) => { e.stopPropagation(); handleRetry(); }}
                disabled={retrying}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {retrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                Retry
              </button>
            )}
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50 border-b border-gray-100">
          <td colSpan={6} className="px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payload</div>
                <pre className="text-xs bg-gray-900 text-green-300 rounded-md p-3 overflow-x-auto max-h-48">
                  {JSON.stringify(delivery.payload ?? delivery.body ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Response Body</div>
                <pre className="text-xs bg-gray-900 text-green-300 rounded-md p-3 overflow-x-auto max-h-48">
                  {delivery.responseBody ?? delivery.response ?? '(empty)'}
                </pre>
              </div>
            </div>
            {Array.isArray(delivery.attemptsTimeline) && delivery.attemptsTimeline.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Attempt Timeline</div>
                <div className="space-y-1">
                  {delivery.attemptsTimeline.map((att, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs text-gray-600">
                      <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-400">{att.at ? format(new Date(att.at), 'HH:mm:ss') : `Attempt ${i + 1}`}</span>
                      <span className={httpCodeColor(att.status)}>{att.status}</span>
                      {att.error && <span className="text-red-500">{att.error}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── Event Reference Collapsible ─────────────────────── */

const EVENT_TYPES = [
  {
    type: 'incident.created',
    desc: 'A new incident was detected by the AI agent',
    payload: {
      event: 'incident.created',
      data: { id: 'inc_abc123', severity: 'high', nightDate: '2025-01-15', detectedAt: '2025-01-15T02:34:00Z' },
    },
  },
  {
    type: 'incident.classified',
    desc: 'An incident has been classified with a severity',
    payload: {
      event: 'incident.classified',
      data: { id: 'inc_abc123', severity: 'critical', previousSeverity: 'high', classifiedAt: '2025-01-15T02:35:00Z' },
    },
  },
  {
    type: 'briefing.approved',
    desc: 'A morning briefing has been approved by an operator',
    payload: {
      event: 'briefing.approved',
      data: { id: 'brf_xyz789', nightDate: '2025-01-15', approvedBy: 'user_op1', approvedAt: '2025-01-15T06:00:00Z' },
    },
  },
  {
    type: 'investigation.completed',
    desc: 'An overnight investigation run has completed',
    payload: {
      event: 'investigation.completed',
      data: { id: 'inv_qrs456', nightDate: '2025-01-15', incidentsFound: 3, completedAt: '2025-01-15T05:50:00Z' },
    },
  },
];

function EventReferenceSection() {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <Collapsible.Trigger asChild>
          <button className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-gray-500" />
              <span className="text-base font-semibold text-gray-900">Event Type Reference</span>
            </div>
            {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
        </Collapsible.Trigger>

        <Collapsible.Content>
          <div className="px-6 pb-6 space-y-6 border-t border-gray-100 pt-4">
            {EVENT_TYPES.map((evt) => (
              <div key={evt.type}>
                <div className="flex items-start gap-3 mb-2">
                  <EventTypeBadge type={evt.type} />
                  <span className="text-sm text-gray-600">{evt.desc}</span>
                </div>
                <pre className="text-xs bg-gray-900 text-green-300 rounded-md p-4 overflow-x-auto">
                  {JSON.stringify(evt.payload, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </Collapsible.Content>
      </div>
    </Collapsible.Root>
  );
}

/* ─── Main Page ───────────────────────────────────────── */

export default function WebhooksSettingsPage() {
  const queryClient = useQueryClient();

  // Config state
  const [urlSuffix, setUrlSuffix] = useState('');
  const [webhookActive, setWebhookActive] = useState(false);
  const [saving, setSaving] = useState(false);

  // HMAC secret state
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const revealTimerRef = useRef(null);
  const [newSecret, setNewSecret] = useState(null);

  // Test state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok: bool, status, body }
  const testClearTimerRef = useRef(null);

  // Delivery filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Load config
  const { data: webhookConfig, isLoading: configLoading } = useQuery({
    queryKey: ['org-webhooks'],
    queryFn: getOrgWebhooks,
  });

  useEffect(() => {
    if (webhookConfig) {
      setUrlSuffix(stripHttps(webhookConfig.webhookUrl ?? ''));
      setWebhookActive(!!webhookConfig.webhookActive);
      setSecret(webhookConfig.hmacSecret ?? '');
    }
  }, [webhookConfig]);

  // Load deliveries
  const { data: deliveriesData, isLoading: deliveriesLoading } = useQuery({
    queryKey: ['webhook-deliveries'],
    queryFn: () => getWebhookDeliveries({ limit: 20 }),
  });

  const rawDeliveries = Array.isArray(deliveriesData)
    ? deliveriesData
    : deliveriesData?.deliveries ?? deliveriesData?.data ?? [];

  const filteredDeliveries = rawDeliveries.filter((d) => {
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    const matchType = typeFilter === 'all' || d.eventType === typeFilter;
    return matchStatus && matchType;
  });

  // Save config
  const handleSave = async () => {
    setSaving(true);
    try {
      await updateOrgConfig({ webhookUrl: 'https://' + urlSuffix, webhookActive });
      toast.success('Webhook saved');
    } catch (err) {
      toast.error(err?.message || 'Failed to save webhook config');
    } finally {
      setSaving(false);
    }
  };

  // Test webhook
  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    clearTimeout(testClearTimerRef.current);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const result = await testWebhook();
      clearTimeout(timeoutId);
      const status = result?.status ?? result?.httpStatus ?? 200;
      const body = result?.body ?? result?.response ?? JSON.stringify(result);
      const ok = typeof status === 'number' ? status >= 200 && status < 300 : true;
      setTestResult({ ok, status, body: typeof body === 'string' ? body : JSON.stringify(body) });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err?.name === 'AbortError') {
        setTestResult({ ok: false, status: 'timeout', body: 'Request timed out after 10s' });
      } else {
        const status = err?.statusCode ?? err?.response?.status ?? 'error';
        const body = err?.message ?? 'Test webhook failed';
        setTestResult({ ok: false, status, body });
      }
    } finally {
      setTesting(false);
      testClearTimerRef.current = setTimeout(() => setTestResult(null), 30000);
    }
  };

  // Reveal secret
  const handleReveal = () => {
    clearTimeout(revealTimerRef.current);
    setShowSecret(true);
    revealTimerRef.current = setTimeout(() => setShowSecret(false), 30000);
  };

  const handleHide = () => {
    clearTimeout(revealTimerRef.current);
    setShowSecret(false);
  };

  // Copy secret without revealing
  const handleCopySecret = () => {
    if (secret) {
      copyToClipboard(secret);
      toast.success('Secret copied to clipboard');
    }
  };

  // Retry delivery
  const handleRetryDelivery = async (id) => {
    await retryWebhookDelivery(id);
    queryClient.invalidateQueries({ queryKey: ['webhook-deliveries'] });
  };

  // Unique event types for filter
  const uniqueEventTypes = [...new Set(rawDeliveries.map((d) => d.eventType).filter(Boolean))];

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(revealTimerRef.current);
      clearTimeout(testClearTimerRef.current);
    };
  }, []);

  return (
    <div className="space-y-8 py-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <Webhook className="w-6 h-6 text-indigo-500" />
          Webhooks
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Receive real-time HTTP POST notifications when events occur in Ridgeway.
        </p>
      </div>

      {/* Config Section */}
      <SectionCard title="Endpoint Configuration" icon={Webhook}>
        {configLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading configuration…
          </div>
        ) : (
          <div className="space-y-5">
            {/* URL Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Webhook URL
              </label>
              <div className="flex items-center border border-gray-300 rounded-md shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 overflow-hidden">
                <span className="px-3 py-2 bg-gray-50 border-r border-gray-300 text-sm text-gray-500 select-none whitespace-nowrap">
                  https://
                </span>
                <input
                  type="text"
                  className="flex-1 px-3 py-2 text-sm focus:outline-none bg-white"
                  placeholder="your-domain.com/api/webhooks/ridgeway"
                  value={urlSuffix}
                  onChange={(e) => setUrlSuffix(e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Must be a publicly accessible HTTPS endpoint.</p>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between py-3 border-t border-gray-100">
              <div>
                <div className="text-sm font-medium text-gray-700">Active</div>
                <div className="text-xs text-gray-500 mt-0.5">Enable or disable webhook delivery without deleting your configuration.</div>
              </div>
              <Switch.Root
                checked={webhookActive}
                onCheckedChange={setWebhookActive}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 data-[state=checked]:bg-indigo-600 data-[state=unchecked]:bg-gray-200"
              >
                <Switch.Thumb className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-1" />
              </Switch.Root>
            </div>

            {/* Actions Row */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Configuration
              </button>

              <button
                onClick={handleTest}
                disabled={testing}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {testing
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <FlaskConical className="w-3.5 h-3.5" />}
                {testing ? 'Testing…' : 'Test Webhook'}
              </button>

              {/* Inline test result */}
              {testResult && !testing && (
                <div
                  className={`flex items-start gap-2 px-3 py-2 rounded-md text-sm max-w-sm ${
                    testResult.ok
                      ? 'bg-green-50 border border-green-200 text-green-800'
                      : 'bg-red-50 border border-red-200 text-red-800'
                  }`}
                >
                  {testResult.ok
                    ? <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    : <X className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                  <span className="font-mono text-xs break-all">
                    {testResult.ok ? '✓' : '✗'} {testResult.status} — {testResult.body}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      {/* HMAC Secret Section */}
      <SectionCard title="HMAC Signing Secret" icon={KeyRound}>
        <p className="text-sm text-gray-600 mb-4">
          Ridgeway signs every webhook payload with this secret using HMAC-SHA256. Verify the{' '}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">X-Ridgeway-Signature</code> header on every request.
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Masked display */}
          <div className="flex items-center border border-gray-300 rounded-md shadow-sm overflow-hidden">
            <input
              type={showSecret ? 'text' : 'password'}
              readOnly
              value={showSecret ? secret : '•'.repeat(32)}
              className="px-3 py-2 text-sm font-mono bg-gray-50 text-gray-700 focus:outline-none w-64"
            />
          </div>

          {/* Show / Hide */}
          <button
            onClick={showSecret ? handleHide : handleReveal}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showSecret ? 'Hide' : 'Show'}
          </button>

          {/* Copy (without visually revealing) */}
          <button
            onClick={handleCopySecret}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy
          </button>

          {/* Rotate */}
          <RotateSecretDialog onNewSecret={(s) => setNewSecret(s)} />
        </div>

        {showSecret && (
          <p className="text-xs text-amber-600 mt-2">Secret will auto-hide after 30 seconds.</p>
        )}
      </SectionCard>

      {/* New secret reveal modal */}
      {newSecret && (
        <NewSecretRevealModal
          secret={newSecret}
          onClose={() => {
            setNewSecret(null);
            // Also refresh config to get updated masked secret
            queryClient.invalidateQueries({ queryKey: ['org-webhooks'] });
          }}
        />
      )}

      {/* Webhook value context */}
      <div style={{
        background: 'var(--bg-surface-1)',
        border: '1px solid var(--border-default)',
        borderRadius: '2px',
        padding: '16px',
        display: 'flex', flexDirection: 'column', gap: '12px',
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
          fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em',
          color: 'var(--fg-3)',
        }}>
          How webhooks work
        </div>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--fg-2)', margin: 0 }}>
          Ridgeway POSTs a signed JSON payload to your endpoint when an investigation completes, a briefing is approved, or a critical incident is detected. Use webhooks to trigger Slack alerts, PagerDuty incidents, or custom automations.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            ['X-Ridgeway-Event', 'Event type (e.g. investigation.completed)'],
            ['X-Ridgeway-Delivery', 'Unique delivery ID for idempotency'],
            ['X-Ridgeway-Signature', 'HMAC-SHA256 of the payload body'],
          ].map(([header, desc]) => (
            <div key={header} style={{
              padding: '6px 10px',
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '2px',
              display: 'flex', flexDirection: 'column', gap: '2px',
              flex: '1', minWidth: '200px',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>{header}</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--fg-3)' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Delivery Log */}
      <SectionCard title="Delivery Log" icon={Clock}>
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mr-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All</option>
              <option value="delivered">Delivered</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mr-2">Event Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All</option>
              {uniqueEventTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Event Type</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Attempts</th>
                <th className="px-4 py-3 font-semibold">HTTP Code</th>
                <th className="px-4 py-3 font-semibold">Timestamp</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deliveriesLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1" />
                    Loading deliveries…
                  </td>
                </tr>
              ) : filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No deliveries match the current filter.
                  </td>
                </tr>
              ) : (
                filteredDeliveries.map((d) => (
                  <DeliveryRow
                    key={d._id ?? d.id}
                    delivery={d}
                    onRetry={handleRetryDelivery}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Event Reference Collapsible */}
      <EventReferenceSection />
    </div>
  );
}
