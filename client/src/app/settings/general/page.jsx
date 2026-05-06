'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Settings, Globe, Sparkles, AlertTriangle, Loader2, Save } from 'lucide-react';
import { getOrgMe, updateOrgConfig } from '@/lib/api';

/* ── helpers ── */
function planBadge(plan) {
  const map = {
    trial:      'bg-gray-100 text-gray-700',
    standard:   'bg-blue-100 text-blue-700',
    enterprise: 'bg-purple-100 text-purple-700',
  };
  return map[plan] ?? 'bg-gray-100 text-gray-600';
}

function statusBadge(status) {
  if (status === 'active') return 'bg-green-100 text-green-700';
  if (status === 'suspended') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-600';
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ── component ── */
export default function GeneralSettingsPage() {
  const queryClient = useQueryClient();

  const { data: org, isLoading, isError } = useQuery({
    queryKey: ['org-me'],
    queryFn: getOrgMe,
  });

  /* form state */
  const [webhookUrl, setWebhookUrl]         = useState('');
  const [promptOverride, setPromptOverride] = useState('');
  const [webhookError, setWebhookError]     = useState('');

  /* seed form once org loads */
  useEffect(() => {
    if (org) {
      setWebhookUrl(org.config?.webhookUrl ?? '');
      setPromptOverride(org.config?.promptOverride ?? '');
    }
  }, [org]);

  /* dirty check */
  const initialWebhook = org?.config?.webhookUrl ?? '';
  const initialPrompt  = org?.config?.promptOverride ?? '';
  const isDirty =
    webhookUrl !== initialWebhook || promptOverride !== initialPrompt;

  /* client-side validation */
  function validateWebhook(val) {
    if (val && !val.startsWith('https://')) {
      return 'Webhook URL must start with https://';
    }
    return '';
  }

  const saveMutation = useMutation({
    mutationFn: (payload) => updateOrgConfig(payload),
    onSuccess: () => {
      toast.success('Settings saved');
      queryClient.invalidateQueries({ queryKey: ['org-me'] });
    },
    onError: (err) => {
      toast.error(err?.message ?? 'Failed to save settings');
    },
  });

  function handleSave(e) {
    e.preventDefault();

    const vErr = validateWebhook(webhookUrl);
    if (vErr) {
      setWebhookError(vErr);
      return;
    }
    setWebhookError('');

    /* build diff — only send changed fields */
    const diff = {};
    if (webhookUrl !== initialWebhook)     diff.webhookUrl     = webhookUrl;
    if (promptOverride !== initialPrompt)  diff.promptOverride = promptOverride;

    saveMutation.mutate(diff);
  }

  /* ── render ── */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading organisation settings…
      </div>
    );
  }

  if (isError || !org) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        Failed to load organisation settings. Please refresh the page.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-500" />
          General Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Organisation-level configuration for your Ridgeway workspace.
        </p>
      </div>

      {/* ── organisation info (read-only) ── */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-base font-semibold text-gray-900">Organisation</h2>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 px-6 py-6">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Name</dt>
            <dd className="text-sm font-medium text-gray-900">{org.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Slug</dt>
            <dd>
              <code className="font-mono text-sm bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                {org.slug}
              </code>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Plan</dt>
            <dd>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${planBadge(org.plan)}`}>
                {capitalize(org.plan)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Status</dt>
            <dd>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadge(org.status)}`}>
                {capitalize(org.status)}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {/* ── editable config ── */}
      <form onSubmit={handleSave}>
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <Globe className="w-4 h-4 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">Configuration</h2>
          </div>

          <div className="px-6 py-6 space-y-6">
            {/* webhook url */}
            <div>
              <label
                htmlFor="webhookUrl"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Webhook URL
              </label>
              <input
                id="webhookUrl"
                type="text"
                autoComplete="off"
                placeholder="https://your-server.com/webhooks/ridgeway"
                value={webhookUrl}
                onChange={(e) => {
                  setWebhookUrl(e.target.value);
                  setWebhookError(validateWebhook(e.target.value));
                }}
                className={`w-full px-3 py-2 border rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${
                  webhookError ? 'border-red-400 bg-red-50' : 'border-gray-300'
                }`}
              />
              {webhookError && (
                <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {webhookError}
                </p>
              )}
              <p className="mt-1.5 text-xs text-gray-500">
                Ridgeway will POST event payloads to this URL. Must use HTTPS.
              </p>
            </div>

            {/* enterprise-only prompt override */}
            {org.plan === 'enterprise' && (
              <div>
                <label
                  htmlFor="promptOverride"
                  className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  AI Prompt Override
                  <span className="ml-1 px-1.5 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-700">
                    Enterprise
                  </span>
                </label>
                <textarea
                  id="promptOverride"
                  rows={5}
                  placeholder="Custom instructions prepended to all AI investigation prompts for this organisation"
                  value={promptOverride}
                  onChange={(e) => setPromptOverride(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm shadow-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  These instructions are prepended to every AI investigation prompt. Use them to enforce site-specific
                  terminology, reporting standards, or escalation logic.
                </p>
              </div>
            )}
          </div>

          {/* footer / save */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={!isDirty || saveMutation.isPending || !!webhookError}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </section>
      </form>

      {/* ── danger zone ── */}
      <section className="rounded-xl border border-red-200 bg-red-50/40 overflow-hidden">
        <div className="px-6 py-4 border-b border-red-200">
          <h2 className="text-base font-semibold text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Danger Zone
          </h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-red-800">
            For account closure requests, contact{' '}
            <a
              href="mailto:support@ridgeway.io"
              className="font-medium underline underline-offset-2 hover:text-red-900"
            >
              support@ridgeway.io
            </a>
            . Our team will process your request within 5 business days.
          </p>
        </div>
      </section>
    </div>
  );
}
