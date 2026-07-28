'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import * as Checkbox from '@radix-ui/react-checkbox';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Key, Plus, Trash2, Copy, Check, Loader2, AlertTriangle, X,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { listOrgApiKeys, createOrgApiKey, revokeOrgApiKey } from '@/lib/api';

const MONO = 'var(--font-mono)';
const SANS = 'var(--font-sans)';

const SCOPES = [
  { id: 'events:read',          desc: 'Read overnight events' },
  { id: 'incidents:read',       desc: 'Read incidents and evidence' },
  { id: 'briefings:read',       desc: 'Read morning briefings' },
  { id: 'investigations:read',  desc: 'Read investigation results' },
  { id: 'investigations:write', desc: 'Start new investigations' },
];

const EXPIRY_OPTIONS = [
  { label: 'No expiry', value: '' },
  { label: '30 days',   value: '30' },
  { label: '90 days',   value: '90' },
  { label: '1 year',    value: '365' },
];

const LABEL_STYLE = {
  display: 'block',
  fontFamily: MONO,
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'var(--fg-3)',
  marginBottom: '6px',
};

const INPUT_STYLE = {
  width: '100%',
  padding: '8px 10px',
  background: 'var(--bg-surface-2)',
  border: '1px solid var(--border-default)',
  borderRadius: '2px',
  color: 'var(--fg-1)',
  fontFamily: SANS,
  fontSize: '13px',
  outline: 'none',
};

const PRIMARY_BTN = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 14px',
  background: 'var(--accent)',
  color: 'var(--bg-base)',
  border: '1px solid var(--accent)',
  borderRadius: '2px',
  fontFamily: MONO,
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  cursor: 'pointer',
};

const SECONDARY_BTN = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 14px',
  background: 'transparent',
  color: 'var(--fg-2)',
  border: '1px solid var(--border-default)',
  borderRadius: '2px',
  fontFamily: MONO,
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  cursor: 'pointer',
};

/* ── helpers ── */

function ScopeBadges({ scopes }) {
  const visible = (scopes ?? []).slice(0, 3);
  const extra   = (scopes ?? []).slice(3);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {visible.map((s) => (
        <span
          key={s}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 6px',
            borderRadius: '2px',
            border: '1px solid var(--border-hairline)',
            background: 'var(--bg-surface-2)',
            color: 'var(--accent)',
            fontFamily: MONO,
            fontSize: '10px',
            letterSpacing: '0.04em',
          }}
        >
          {s}
        </span>
      ))}
      {extra.length > 0 && (
        <span
          title={extra.join(', ')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 6px',
            borderRadius: '2px',
            border: '1px solid var(--border-hairline)',
            background: 'var(--bg-surface-2)',
            color: 'var(--fg-3)',
            fontFamily: MONO,
            fontSize: '10px',
            cursor: 'default',
          }}
        >
          +{extra.length}
        </span>
      )}
    </div>
  );
}

/* ── main page ── */

export default function ApiKeysSettingsPage() {
  const role    = useAuthStore((s) => s.role);
  const isAdmin = role === 'org_admin' || role === 'super_admin';
  const queryClient = useQueryClient();

  /* modal */
  const [modalOpen,      setModalOpen]      = useState(false);
  const [modalState,     setModalState]     = useState('form'); // 'form' | 'reveal'
  const [keyName,        setKeyName]        = useState('');
  const [selectedScopes, setSelectedScopes] = useState([]);
  const [expiresIn,      setExpiresIn]      = useState('');
  const [createError,    setCreateError]    = useState('');
  const [newKey,         setNewKey]         = useState('');
  const [keyCopied,      setKeyCopied]      = useState(false);
  const [keyAcked,       setKeyAcked]       = useState(false);

  /* revoke confirm */
  const [revokeId, setRevokeId] = useState(null);

  /* queries */
  const { data: keys = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['org-api-keys'],
    queryFn: listOrgApiKeys,
  });

  /* mutations */
  const createMutation = useMutation({
    mutationFn: (payload) => createOrgApiKey(payload),
    onSuccess: (result) => {
      const plain = result?.key ?? result?.plainKey ?? result?.apiKey ?? result;
      setNewKey(typeof plain === 'string' ? plain : JSON.stringify(plain));
      setModalState('reveal');
    },
    onError: (err) => {
      setCreateError(err?.message ?? 'Failed to create API key');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId) => revokeOrgApiKey(keyId),
    onSuccess: () => {
      toast.success('API key revoked');
      setRevokeId(null);
      queryClient.invalidateQueries({ queryKey: ['org-api-keys'] });
    },
    onError: (err) => {
      toast.error(err?.message ?? 'Failed to revoke key');
      setRevokeId(null);
    },
  });

  /* handlers */
  function openModal() {
    setKeyName('');
    setSelectedScopes([]);
    setExpiresIn('');
    setCreateError('');
    setNewKey('');
    setKeyCopied(false);
    setKeyAcked(false);
    setModalState('form');
    setModalOpen(true);
  }

  function closeModal() {
    if (modalState === 'reveal') {
      queryClient.invalidateQueries({ queryKey: ['org-api-keys'] });
    }
    setModalOpen(false);
  }

  function toggleScope(id) {
    setSelectedScopes((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  function handleCreate(e) {
    e.preventDefault();
    setCreateError('');
    const payload = {
      name:      keyName.trim(),
      scopes:    selectedScopes,
      expiresIn: expiresIn ? Number(expiresIn) : null,
    };
    createMutation.mutate(payload);
  }

  function handleCopyKey() {
    navigator.clipboard.writeText(newKey).catch(() => {});
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  }

  const canCreate = keyName.trim() && selectedScopes.length > 0 && !createMutation.isPending;

  const thStyle = {
    padding: '10px 14px',
    textAlign: 'left',
    fontFamily: MONO,
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: 'var(--fg-3)',
    borderBottom: '1px solid var(--border-default)',
    background: 'var(--bg-surface-2)',
  };

  const tdStyle = {
    padding: '12px 14px',
    fontFamily: SANS,
    fontSize: '13px',
    color: 'var(--fg-2)',
    borderBottom: '1px solid var(--border-hairline)',
  };

  /* ── render ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: SANS,
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--fg-1)',
            margin: 0,
            letterSpacing: '-0.01em',
          }}>
            <Key size={16} style={{ color: 'var(--accent)' }} />
            API Keys
          </h1>
          <p style={{
            marginTop: '6px',
            marginBottom: 0,
            fontFamily: SANS,
            fontSize: '12px',
            color: 'var(--fg-3)',
          }}>
            Create keys to connect external applications and AI agents to your Sentinel data.
          </p>
        </div>
        {isAdmin && (
          <button onClick={openModal} style={{ ...PRIMARY_BTN, flexShrink: 0 }}>
            <Plus size={12} />
            Create API key
          </button>
        )}
      </div>

      {/* keys table */}
      <section style={{
        background: 'var(--bg-surface-1)',
        border: '1px solid var(--border-default)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-hairline)',
          background: 'var(--bg-surface-2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <Key size={12} style={{ color: 'var(--fg-3)' }} />
          <h2 style={{
            margin: 0,
            fontFamily: MONO,
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--fg-2)',
          }}>
            Active Keys
          </h2>
        </div>

        {isLoading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 0',
            color: 'var(--fg-3)',
            fontFamily: MONO,
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            <Loader2 size={16} className="animate-spin" style={{ marginRight: '8px' }} />
            Loading keys…
          </div>
        ) : isError ? (
          <div style={{ padding: '24px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: '1px solid var(--sev-serious)',
              background: 'var(--bg-surface-2)',
              borderRadius: '2px',
              padding: '12px 14px',
              color: 'var(--sev-serious)',
              fontFamily: SANS,
              fontSize: '13px',
            }}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              Failed to load API keys.
              <button
                onClick={() => refetch()}
                style={{
                  marginLeft: 'auto',
                  background: 'none',
                  border: 'none',
                  color: 'var(--sev-serious)',
                  fontFamily: MONO,
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          </div>
        ) : keys.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 24px',
            textAlign: 'center',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '2px',
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border-hairline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
            }}>
              <Key size={18} style={{ color: 'var(--fg-4)' }} />
            </div>
            <p style={{
              margin: '0 0 4px 0',
              fontFamily: SANS,
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--fg-2)',
            }}>
              No API keys yet
            </p>
            <p style={{
              margin: '0 0 16px 0',
              fontFamily: SANS,
              fontSize: '12px',
              color: 'var(--fg-3)',
            }}>
              Create a key to connect external tools or AI agents.
            </p>
            {isAdmin && (
              <button onClick={openModal} style={PRIMARY_BTN}>
                <Plus size={12} />
                Create API key
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Key prefix</th>
                  <th style={thStyle}>Scopes</th>
                  <th style={thStyle}>Created</th>
                  <th style={thStyle}>Last used</th>
                  {isAdmin && <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k._id}>
                    <td style={{ ...tdStyle, color: 'var(--fg-1)', fontWeight: 500 }}>{k.name}</td>
                    <td style={tdStyle}>
                      <code style={{
                        fontFamily: MONO,
                        fontSize: '11px',
                        background: 'var(--bg-surface-2)',
                        color: 'var(--fg-1)',
                        padding: '2px 6px',
                        borderRadius: '2px',
                        border: '1px solid var(--border-hairline)',
                      }}>
                        {k.keyPrefix}
                      </code>
                    </td>
                    <td style={tdStyle}>
                      <ScopeBadges scopes={k.scopes} />
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                      {k.createdAt ? format(new Date(k.createdAt), 'MMM d, yyyy') : '—'}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                      {k.lastUsedAt
                        ? formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true })
                        : 'Never'}
                    </td>
                    {isAdmin && (
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            onClick={() => setRevokeId(revokeId === k._id ? null : k._id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 10px',
                              fontFamily: MONO,
                              fontSize: '10px',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.1em',
                              color: 'var(--sev-serious)',
                              background: 'transparent',
                              border: '1px solid var(--border-default)',
                              borderRadius: '2px',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={11} />
                            Revoke
                          </button>
                          {revokeId === k._id && (
                            <div style={{
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              marginTop: '4px',
                              zIndex: 10,
                              width: '256px',
                              background: 'var(--bg-surface-1)',
                              border: '1px solid var(--border-strong)',
                              borderRadius: '2px',
                              padding: '14px',
                              textAlign: 'left',
                            }}>
                              <p style={{
                                margin: '0 0 12px 0',
                                fontFamily: SANS,
                                fontSize: '12px',
                                color: 'var(--fg-2)',
                              }}>
                                Revoke this key? All requests using it will fail immediately.
                              </p>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button
                                  onClick={() => setRevokeId(null)}
                                  style={{
                                    ...SECONDARY_BTN,
                                    padding: '5px 10px',
                                    fontSize: '10px',
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => revokeMutation.mutate(k._id)}
                                  disabled={revokeMutation.isPending}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '5px 10px',
                                    fontFamily: MONO,
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    color: 'var(--bg-base)',
                                    background: 'var(--sev-serious)',
                                    border: '1px solid var(--sev-serious)',
                                    borderRadius: '2px',
                                    cursor: revokeMutation.isPending ? 'not-allowed' : 'pointer',
                                    opacity: revokeMutation.isPending ? 0.5 : 1,
                                  }}
                                >
                                  {revokeMutation.isPending && <Loader2 size={10} className="animate-spin" />}
                                  Revoke
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* create key modal */}
      <Dialog.Root
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) {
            if (modalState === 'reveal' && !keyAcked) return;
            closeModal();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 40,
          }} />
          <Dialog.Content style={{
            position: 'fixed',
            zIndex: 50,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100%',
            maxWidth: '520px',
            background: 'var(--bg-surface-1)',
            border: '1px solid var(--border-strong)',
            borderRadius: '2px',
            outline: 'none',
          }}>

            {/* modal header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-default)',
            }}>
              <Dialog.Title style={{
                margin: 0,
                fontFamily: MONO,
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--fg-1)',
              }}>
                {modalState === 'form' ? 'Create API Key' : 'Your New API Key'}
              </Dialog.Title>
              {modalState === 'form' ? (
                <Dialog.Close asChild>
                  <button style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--fg-3)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                  }}>
                    <X size={16} />
                  </button>
                </Dialog.Close>
              ) : (
                <button
                  onClick={closeModal}
                  disabled={!keyAcked}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--fg-3)',
                    cursor: keyAcked ? 'pointer' : 'not-allowed',
                    opacity: keyAcked ? 1 : 0.3,
                    padding: 0,
                    display: 'flex',
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* form state */}
            {modalState === 'form' && (
              <form onSubmit={handleCreate}>
                <div style={{
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px',
                  maxHeight: '70vh',
                  overflowY: 'auto',
                }}>

                  {/* name */}
                  <div>
                    <label style={LABEL_STYLE}>Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Claude.ai integration"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      style={INPUT_STYLE}
                    />
                  </div>

                  {/* scopes */}
                  <div>
                    <label style={LABEL_STYLE}>Scopes</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {SCOPES.map((scope) => (
                        <label key={scope.id} style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          cursor: 'pointer',
                        }}>
                          <Checkbox.Root
                            checked={selectedScopes.includes(scope.id)}
                            onCheckedChange={() => toggleScope(scope.id)}
                            style={{
                              marginTop: '2px',
                              width: '14px',
                              height: '14px',
                              flexShrink: 0,
                              border: '1px solid var(--border-strong)',
                              borderRadius: '2px',
                              background: 'var(--bg-surface-2)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0,
                            }}
                          >
                            <Checkbox.Indicator>
                              <Check size={10} style={{ color: 'var(--accent)' }} />
                            </Checkbox.Indicator>
                          </Checkbox.Root>
                          <div>
                            <span style={{
                              fontFamily: MONO,
                              fontSize: '12px',
                              fontWeight: 600,
                              color: 'var(--fg-1)',
                            }}>
                              {scope.id}
                            </span>
                            <span style={{
                              fontFamily: SANS,
                              fontSize: '12px',
                              color: 'var(--fg-3)',
                              marginLeft: '8px',
                            }}>
                              {scope.desc}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                    {selectedScopes.length === 0 && (
                      <p style={{
                        marginTop: '8px',
                        marginBottom: 0,
                        fontFamily: MONO,
                        fontSize: '10px',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--fg-4)',
                      }}>
                        Select at least one scope.
                      </p>
                    )}
                  </div>

                  {/* expiry */}
                  <div>
                    <label style={LABEL_STYLE}>Expiry</label>
                    <select
                      value={expiresIn}
                      onChange={(e) => setExpiresIn(e.target.value)}
                      style={INPUT_STYLE}
                    >
                      {EXPIRY_OPTIONS.map((opt) => (
                        <option key={opt.label} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {createError && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: '1px solid var(--sev-serious)',
                      background: 'var(--bg-surface-2)',
                      borderRadius: '2px',
                      padding: '10px 12px',
                      color: 'var(--sev-serious)',
                      fontFamily: SANS,
                      fontSize: '12px',
                    }}>
                      <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                      {createError}
                    </div>
                  )}
                </div>

                <div style={{
                  padding: '14px 18px',
                  background: 'var(--bg-surface-2)',
                  borderTop: '1px solid var(--border-hairline)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                }}>
                  <Dialog.Close asChild>
                    <button type="button" style={SECONDARY_BTN}>
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={!canCreate}
                    style={{
                      ...PRIMARY_BTN,
                      opacity: canCreate ? 1 : 0.4,
                      cursor: canCreate ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {createMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                    {createMutation.isPending ? 'Creating…' : 'Create Key'}
                  </button>
                </div>
              </form>
            )}

            {/* reveal state */}
            {modalState === 'reveal' && (
              <div style={{
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px 14px',
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--sev-warning)',
                  borderRadius: '2px',
                }}>
                  <AlertTriangle size={16} style={{ color: 'var(--sev-warning)', flexShrink: 0, marginTop: '1px' }} />
                  <p style={{
                    margin: 0,
                    fontFamily: SANS,
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--sev-warning)',
                  }}>
                    This key will never be shown again. Copy it now and store it securely.
                  </p>
                </div>

                <div style={{
                  borderRadius: '2px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-surface-2)',
                  padding: '12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <code style={{
                      flex: 1,
                      fontFamily: MONO,
                      fontSize: '12px',
                      color: 'var(--fg-1)',
                      wordBreak: 'break-all',
                    }}>
                      {newKey}
                    </code>
                    <button
                      onClick={handleCopyKey}
                      style={{
                        ...SECONDARY_BTN,
                        flexShrink: 0,
                        padding: '5px 10px',
                        fontSize: '10px',
                      }}
                    >
                      {keyCopied
                        ? <Check size={11} style={{ color: 'var(--sev-harmless)' }} />
                        : <Copy size={11} />}
                      {keyCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <Checkbox.Root
                    checked={keyAcked}
                    onCheckedChange={setKeyAcked}
                    style={{
                      width: '14px',
                      height: '14px',
                      flexShrink: 0,
                      border: '1px solid var(--border-strong)',
                      borderRadius: '2px',
                      background: 'var(--bg-surface-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    <Checkbox.Indicator>
                      <Check size={10} style={{ color: 'var(--accent)' }} />
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                  <span style={{
                    fontFamily: SANS,
                    fontSize: '13px',
                    color: 'var(--fg-2)',
                  }}>
                    I have copied my key
                  </span>
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
                  <button
                    onClick={closeModal}
                    disabled={!keyAcked}
                    style={{
                      ...PRIMARY_BTN,
                      opacity: keyAcked ? 1 : 0.4,
                      cursor: keyAcked ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </div>
  );
}
