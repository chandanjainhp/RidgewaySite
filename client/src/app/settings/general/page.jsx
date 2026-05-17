'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Settings, Globe, Sparkles, AlertTriangle, Loader2, Save } from 'lucide-react';
import { getOrgMe, updateOrgConfig } from '@/lib/api';

const MONO = 'var(--font-mono)';
const SANS = 'var(--font-sans)';

const LABEL_STYLE = {
  fontFamily: MONO,
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'var(--fg-3)',
};

const SECTION_HEADER_STYLE = {
  padding: '12px 20px',
  borderBottom: '1px solid var(--border-hairline)',
  background: 'var(--bg-surface-2)',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const SECTION_TITLE_STYLE = {
  fontFamily: MONO,
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'var(--fg-2)',
};

const CARD_STYLE = {
  background: 'var(--bg-surface-1)',
  border: '1px solid var(--border-default)',
  borderRadius: '2px',
  overflow: 'hidden',
};

const INPUT_BASE_STYLE = {
  width: '100%',
  padding: '8px 10px',
  background: 'var(--bg-base)',
  border: '1px solid var(--border-default)',
  borderRadius: '2px',
  fontFamily: SANS,
  fontSize: '13px',
  color: 'var(--fg-1)',
  outline: 'none',
  transition: 'border-color 120ms',
};

/* ── helpers ── */
function planBadgeStyle(plan) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '2px',
    fontFamily: MONO,
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    border: '1px solid var(--border-hairline)',
  };
  if (plan === 'enterprise') {
    return { ...base, background: 'var(--bg-surface-3)', color: 'var(--accent)' };
  }
  if (plan === 'standard') {
    return { ...base, background: 'var(--bg-surface-2)', color: 'var(--sev-info)' };
  }
  return { ...base, background: 'var(--bg-surface-2)', color: 'var(--fg-3)' };
}

function statusBadgeStyle(status) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '2px',
    fontFamily: MONO,
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    border: '1px solid var(--border-hairline)',
    background: 'var(--bg-surface-2)',
  };
  if (status === 'active') return { ...base, color: 'var(--sev-harmless)' };
  if (status === 'suspended') return { ...base, color: 'var(--sev-serious)' };
  return { ...base, color: 'var(--fg-3)' };
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
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '96px 0',
        color: 'var(--fg-3)',
        fontFamily: SANS,
        fontSize: '13px',
      }}>
        <Loader2 size={16} className="animate-spin" style={{ marginRight: '8px' }} />
        Loading organisation settings…
      </div>
    );
  }

  if (isError || !org) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        border: '1px solid var(--border-default)',
        borderLeft: '2px solid var(--sev-serious)',
        background: 'var(--bg-surface-1)',
        borderRadius: '2px',
        padding: '12px 16px',
        color: 'var(--sev-serious)',
        fontFamily: SANS,
        fontSize: '13px',
      }}>
        <AlertTriangle size={14} style={{ flexShrink: 0 }} />
        Failed to load organisation settings. Please refresh the page.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: SANS }}>
      {/* page header */}
      <div>
        <h1 style={{
          fontFamily: SANS,
          fontSize: '20px',
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: 'var(--fg-1)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          margin: 0,
        }}>
          <Settings size={16} style={{ color: 'var(--accent)' }} />
          General Settings
        </h1>
        <p style={{
          fontFamily: SANS,
          fontSize: '12px',
          color: 'var(--fg-3)',
          marginTop: '6px',
          margin: '6px 0 0 0',
        }}>
          Organisation-level configuration for your Sentinel workspace.
        </p>
      </div>

      {/* ── organisation info (read-only) ── */}
      <section style={CARD_STYLE}>
        <div style={SECTION_HEADER_STYLE}>
          <h2 style={SECTION_TITLE_STYLE}>Organisation</h2>
        </div>
        <dl style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          columnGap: '32px',
          rowGap: '20px',
          padding: '20px',
          margin: 0,
        }}>
          <div>
            <dt style={{ ...LABEL_STYLE, marginBottom: '6px' }}>Name</dt>
            <dd style={{ fontFamily: SANS, fontSize: '13px', color: 'var(--fg-1)', margin: 0 }}>
              {org.name}
            </dd>
          </div>
          <div>
            <dt style={{ ...LABEL_STYLE, marginBottom: '6px' }}>Slug</dt>
            <dd style={{ margin: 0 }}>
              <code style={{
                fontFamily: MONO,
                fontSize: '12px',
                background: 'var(--bg-surface-2)',
                color: 'var(--fg-2)',
                padding: '2px 8px',
                borderRadius: '2px',
                border: '1px solid var(--border-hairline)',
              }}>
                {org.slug}
              </code>
            </dd>
          </div>
          <div>
            <dt style={{ ...LABEL_STYLE, marginBottom: '6px' }}>Plan</dt>
            <dd style={{ margin: 0 }}>
              <span style={planBadgeStyle(org.plan)}>
                {capitalize(org.plan)}
              </span>
            </dd>
          </div>
          <div>
            <dt style={{ ...LABEL_STYLE, marginBottom: '6px' }}>Status</dt>
            <dd style={{ margin: 0 }}>
              <span style={statusBadgeStyle(org.status)}>
                {capitalize(org.status)}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {/* ── editable config ── */}
      <form onSubmit={handleSave}>
        <section style={CARD_STYLE}>
          <div style={SECTION_HEADER_STYLE}>
            <Globe size={13} style={{ color: 'var(--fg-3)' }} />
            <h2 style={SECTION_TITLE_STYLE}>Configuration</h2>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* webhook url */}
            <div>
              <label
                htmlFor="webhookUrl"
                style={{ ...LABEL_STYLE, display: 'block', marginBottom: '6px' }}
              >
                Webhook URL
              </label>
              <input
                id="webhookUrl"
                type="text"
                autoComplete="off"
                placeholder="https://your-server.com/webhooks/sentinel"
                value={webhookUrl}
                onChange={(e) => {
                  setWebhookUrl(e.target.value);
                  setWebhookError(validateWebhook(e.target.value));
                }}
                style={{
                  ...INPUT_BASE_STYLE,
                  borderColor: webhookError ? 'var(--sev-serious)' : 'var(--border-default)',
                  background: webhookError ? 'var(--bg-surface-2)' : 'var(--bg-base)',
                }}
              />
              {webhookError && (
                <p style={{
                  marginTop: '6px',
                  fontFamily: SANS,
                  fontSize: '11px',
                  color: 'var(--sev-serious)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  margin: '6px 0 0 0',
                }}>
                  <AlertTriangle size={11} />
                  {webhookError}
                </p>
              )}
              <p style={{
                marginTop: '6px',
                fontFamily: SANS,
                fontSize: '11px',
                color: 'var(--fg-3)',
                margin: '6px 0 0 0',
              }}>
                Sentinel will POST event payloads to this URL. Must use HTTPS.
              </p>
            </div>

            {/* enterprise-only prompt override */}
            {org.plan === 'enterprise' && (
              <div>
                <label
                  htmlFor="promptOverride"
                  style={{
                    ...LABEL_STYLE,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '6px',
                  }}
                >
                  <Sparkles size={11} style={{ color: 'var(--accent)' }} />
                  AI Prompt Override
                  <span style={{
                    marginLeft: '4px',
                    padding: '2px 6px',
                    borderRadius: '2px',
                    fontFamily: MONO,
                    fontSize: '9px',
                    fontWeight: 600,
                    background: 'var(--bg-surface-3)',
                    color: 'var(--accent)',
                    border: '1px solid var(--border-hairline)',
                    letterSpacing: '0.1em',
                  }}>
                    Enterprise
                  </span>
                </label>
                <textarea
                  id="promptOverride"
                  rows={5}
                  placeholder="Custom instructions prepended to all AI investigation prompts for this organisation"
                  value={promptOverride}
                  onChange={(e) => setPromptOverride(e.target.value)}
                  style={{
                    ...INPUT_BASE_STYLE,
                    resize: 'vertical',
                    fontFamily: SANS,
                  }}
                />
                <p style={{
                  marginTop: '6px',
                  fontFamily: SANS,
                  fontSize: '11px',
                  color: 'var(--fg-3)',
                  margin: '6px 0 0 0',
                }}>
                  These instructions are prepended to every AI investigation prompt. Use them to enforce site-specific
                  terminology, reporting standards, or escalation logic.
                </p>
              </div>
            )}
          </div>

          {/* footer / save */}
          <div style={{
            padding: '12px 20px',
            background: 'var(--bg-surface-2)',
            borderTop: '1px solid var(--border-hairline)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}>
            <button
              type="submit"
              disabled={!isDirty || saveMutation.isPending || !!webhookError}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '2px',
                fontFamily: MONO,
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--bg-base)',
                background: 'var(--accent)',
                border: '1px solid var(--accent)',
                cursor: (!isDirty || saveMutation.isPending || !!webhookError) ? 'not-allowed' : 'pointer',
                opacity: (!isDirty || saveMutation.isPending || !!webhookError) ? 0.4 : 1,
                transition: 'opacity 120ms',
              }}
            >
              {saveMutation.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Save size={13} />
              )}
              {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </section>
      </form>

      {/* ── danger zone ── */}
      <section style={{
        background: 'var(--bg-surface-1)',
        border: '1px solid var(--border-default)',
        borderLeft: '2px solid var(--sev-serious)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-hairline)',
          background: 'var(--bg-surface-2)',
        }}>
          <h2 style={{
            ...SECTION_TITLE_STYLE,
            color: 'var(--sev-serious)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            margin: 0,
          }}>
            <AlertTriangle size={13} />
            Danger Zone
          </h2>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <p style={{
            fontFamily: SANS,
            fontSize: '13px',
            color: 'var(--fg-2)',
            margin: 0,
          }}>
            For account closure requests, contact{' '}
            <a
              href="mailto:support@ridgeway.io"
              style={{
                fontFamily: MONO,
                fontSize: '12px',
                color: 'var(--accent)',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
              }}
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
