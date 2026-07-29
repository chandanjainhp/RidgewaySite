'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import * as Checkbox from '@radix-ui/react-checkbox';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  Key, Copy, Check, Loader2, AlertTriangle, X, RotateCw,
} from 'lucide-react';
import { getOrgMe, getIngestionStatus, rotateIngestionSecret } from '@/lib/api';

const MONO = 'var(--font-mono)';
const SANS = 'var(--font-sans)';

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

export default function IngestionSecretPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [newSecret, setNewSecret] = useState('');
  const [secretCopied, setSecretCopied] = useState(false);
  const [secretAcked, setSecretAcked] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: site, isLoading: siteLoading } = useQuery({
    queryKey: ['site-me'],
    queryFn: getOrgMe,
  });

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['ingestion-status'],
    queryFn: getIngestionStatus,
  });

  const rotateMutation = useMutation({
    mutationFn: rotateIngestionSecret,
    onSuccess: (result) => {
      const secret = result?.ingestionSecret;
      if (!secret) {
        toast.error('Rotation succeeded but secret was not returned');
        return;
      }
      setNewSecret(secret);
      setSecretCopied(false);
      setSecretAcked(false);
      setConfirmOpen(false);
      setModalOpen(true);
    },
    onError: (err) => {
      toast.error(err?.message ?? 'Failed to rotate ingestion secret');
      setConfirmOpen(false);
    },
  });

  function handleCopySecret() {
    navigator.clipboard.writeText(newSecret).catch(() => {});
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  }

  function closeRevealModal() {
    if (!secretAcked) return;
    setModalOpen(false);
    setNewSecret('');
  }

  const isLoading = siteLoading || statusLoading;
  const configured = site?.ingestionSecretConfigured === true;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
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
        }}>
          <Key size={16} style={{ color: 'var(--accent)' }} />
          Event Ingestion
        </h1>
        <p style={{
          marginTop: '6px',
          marginBottom: 0,
          fontFamily: SANS,
          fontSize: '12px',
          color: 'var(--fg-3)',
        }}>
          Drones authenticate to <code style={{ fontFamily: MONO, fontSize: '11px' }}>POST /api/v1/events</code> with a single site ingestion secret.
        </p>
      </div>

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
        }}>
          <h2 style={{
            margin: 0,
            fontFamily: MONO,
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--fg-2)',
          }}>
            Ingestion Secret
          </h2>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isLoading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--fg-3)',
              fontFamily: MONO,
              fontSize: '11px',
            }}>
              <Loader2 size={14} className="animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
                <div>
                  <div style={{
                    fontFamily: MONO,
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: 'var(--fg-3)',
                    marginBottom: '4px',
                  }}>
                    Status
                  </div>
                  <span style={{
                    fontFamily: SANS,
                    fontSize: '13px',
                    color: configured ? 'var(--sev-harmless)' : 'var(--sev-minor)',
                  }}>
                    {configured ? 'Configured' : 'Not configured'}
                  </span>
                </div>
                <div>
                  <div style={{
                    fontFamily: MONO,
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: 'var(--fg-3)',
                    marginBottom: '4px',
                  }}>
                    Last event received
                  </div>
                  <span style={{ fontFamily: SANS, fontSize: '13px', color: 'var(--fg-2)' }}>
                    {status?.lastReceivedAt
                      ? formatDistanceToNow(new Date(status.lastReceivedAt), { addSuffix: true })
                      : 'Never'}
                  </span>
                </div>
              </div>

              <p style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '12px',
                color: 'var(--fg-3)',
                lineHeight: 1.5,
              }}>
                Send the secret in the <code style={{ fontFamily: MONO, fontSize: '11px' }}>Authorization: Bearer &lt;secret&gt;</code> header.
                The raw value is only shown when you rotate it.
              </p>

              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={rotateMutation.isPending}
                style={{
                  ...PRIMARY_BTN,
                  alignSelf: 'flex-start',
                  opacity: rotateMutation.isPending ? 0.5 : 1,
                }}
              >
                {rotateMutation.isPending
                  ? <Loader2 size={12} className="animate-spin" />
                  : <RotateCw size={12} />}
                {configured ? 'Rotate secret' : 'Generate secret'}
              </button>
            </>
          )}
        </div>
      </section>

      {/* rotate confirm */}
      <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
          <Dialog.Content style={{
            position: 'fixed',
            zIndex: 50,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100%',
            maxWidth: '420px',
            background: 'var(--bg-surface-1)',
            border: '1px solid var(--border-strong)',
            borderRadius: '2px',
            padding: '18px',
          }}>
            <Dialog.Title style={{
              margin: '0 0 8px 0',
              fontFamily: SANS,
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--fg-1)',
            }}>
              {configured ? 'Rotate ingestion secret?' : 'Generate ingestion secret?'}
            </Dialog.Title>
            <Dialog.Description style={{
              margin: '0 0 16px 0',
              fontFamily: SANS,
              fontSize: '13px',
              color: 'var(--fg-3)',
            }}>
              {configured
                ? 'The current secret stops working immediately. Update all drones before closing the reveal dialog.'
                : 'A new secret will be generated and shown once.'}
            </Dialog.Description>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setConfirmOpen(false)} style={SECONDARY_BTN}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => rotateMutation.mutate()}
                disabled={rotateMutation.isPending}
                style={{ ...PRIMARY_BTN, opacity: rotateMutation.isPending ? 0.5 : 1 }}
              >
                {rotateMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                Confirm
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* reveal secret */}
      <Dialog.Root open={modalOpen} onOpenChange={(open) => { if (!open) closeRevealModal(); }}>
        <Dialog.Portal>
          <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
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
                Your ingestion secret
              </Dialog.Title>
              <button
                type="button"
                onClick={closeRevealModal}
                disabled={!secretAcked}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--fg-3)',
                  cursor: secretAcked ? 'pointer' : 'not-allowed',
                  opacity: secretAcked ? 1 : 0.3,
                  padding: 0,
                  display: 'flex',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 14px',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--sev-minor)',
                borderRadius: '2px',
              }}>
                <AlertTriangle size={16} style={{ color: 'var(--sev-minor)', flexShrink: 0 }} />
                <p style={{
                  margin: 0,
                  fontFamily: SANS,
                  fontSize: '12px',
                  color: 'var(--sev-minor)',
                }}>
                  This secret will never be shown again. Copy it now and configure your drones.
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
                    {newSecret}
                  </code>
                  <button type="button" onClick={handleCopySecret} style={{ ...SECONDARY_BTN, flexShrink: 0, padding: '5px 10px', fontSize: '10px' }}>
                    {secretCopied ? <Check size={11} /> : <Copy size={11} />}
                    {secretCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <Checkbox.Root
                  checked={secretAcked}
                  onCheckedChange={setSecretAcked}
                  style={{
                    width: '14px',
                    height: '14px',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '2px',
                    background: 'var(--bg-surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Checkbox.Indicator>
                    <Check size={10} style={{ color: 'var(--accent)' }} />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <span style={{ fontFamily: SANS, fontSize: '13px', color: 'var(--fg-2)' }}>
                  I have copied the secret
                </span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={closeRevealModal}
                  disabled={!secretAcked}
                  style={{
                    ...PRIMARY_BTN,
                    opacity: secretAcked ? 1 : 0.4,
                    cursor: secretAcked ? 'pointer' : 'not-allowed',
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
