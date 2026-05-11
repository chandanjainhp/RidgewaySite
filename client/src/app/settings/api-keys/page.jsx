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

const SCOPES = [
  { id: 'events:read',          desc: 'Read overnight events' },
  { id: 'incidents:read',       desc: 'Read incidents and evidence' },
  { id: 'briefings:read',       desc: 'Read morning briefings' },
  { id: 'investigations:read',  desc: 'Read investigation results' },
  { id: 'investigations:write', desc: 'Start new investigations' },
  { id: 'mcp',                  desc: 'Connect via MCP protocol' },
];

const EXPIRY_OPTIONS = [
  { label: 'No expiry', value: '' },
  { label: '30 days',   value: '30' },
  { label: '90 days',   value: '90' },
  { label: '1 year',    value: '365' },
];

/* ── helpers ── */

function ScopeBadges({ scopes }) {
  const visible = (scopes ?? []).slice(0, 3);
  const extra   = (scopes ?? []).slice(3);
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((s) => (
        <span key={s} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-medium bg-indigo-50 text-indigo-700">
          {s}
        </span>
      ))}
      {extra.length > 0 && (
        <span
          title={extra.join(', ')}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 cursor-default"
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

  /* ── render ── */
  return (
    <div className="space-y-8">

      {/* page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-500" />
            API Keys
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Create keys to connect external applications and AI agents to your Ridgeway data.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create API key
          </button>
        )}
      </div>

      {/* keys table */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <Key className="w-4 h-4 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Active Keys</h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading keys…
          </div>
        ) : isError ? (
          <div className="px-6 py-8">
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Failed to load API keys.
              <button onClick={() => refetch()} className="ml-auto font-medium hover:underline text-red-600">
                Retry
              </button>
            </div>
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Key className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">No API keys yet</p>
            <p className="text-xs text-gray-500 mb-4">Create a key to connect external tools or AI agents.</p>
            {isAdmin && (
              <button
                onClick={openModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Create API key
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 font-semibold">Name</th>
                  <th className="px-6 py-3 font-semibold">Key prefix</th>
                  <th className="px-6 py-3 font-semibold">Scopes</th>
                  <th className="px-6 py-3 font-semibold">Created</th>
                  <th className="px-6 py-3 font-semibold">Last used</th>
                  {isAdmin && <th className="px-6 py-3 font-semibold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{k.name}</td>
                    <td className="px-6 py-4">
                      <code className="text-xs font-mono bg-gray-100 text-gray-800 px-2 py-1 rounded">
                        {k.keyPrefix}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <ScopeBadges scopes={k.scopes} />
                    </td>
                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                      {k.createdAt ? format(new Date(k.createdAt), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                      {k.lastUsedAt
                        ? formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true })
                        : 'Never'}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={() => setRevokeId(revokeId === k._id ? null : k._id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Revoke
                          </button>
                          {revokeId === k._id && (
                            <div className="absolute right-0 top-full mt-1 z-10 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
                              <p className="text-sm text-gray-700 mb-3">
                                Revoke this key? All requests using it will fail immediately.
                              </p>
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setRevokeId(null)}
                                  className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => revokeMutation.mutate(k._id)}
                                  disabled={revokeMutation.isPending}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                                >
                                  {revokeMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
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
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-xl shadow-2xl focus:outline-none">

            {/* modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <Dialog.Title className="text-base font-semibold text-gray-900">
                {modalState === 'form' ? 'Create API Key' : 'Your New API Key'}
              </Dialog.Title>
              {modalState === 'form' ? (
                <Dialog.Close asChild>
                  <button className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              ) : (
                <button
                  onClick={closeModal}
                  disabled={!keyAcked}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* form state */}
            {modalState === 'form' && (
              <form onSubmit={handleCreate}>
                <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

                  {/* name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Claude.ai integration"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  {/* scopes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Scopes
                    </label>
                    <div className="space-y-2.5">
                      {SCOPES.map((scope) => (
                        <label key={scope.id} className="flex items-start gap-3 cursor-pointer">
                          <Checkbox.Root
                            checked={selectedScopes.includes(scope.id)}
                            onCheckedChange={() => toggleScope(scope.id)}
                            className="mt-0.5 w-4 h-4 flex-shrink-0 border-2 border-gray-300 rounded bg-white data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <Checkbox.Indicator>
                              <Check className="w-3 h-3 text-white" />
                            </Checkbox.Indicator>
                          </Checkbox.Root>
                          <div>
                            <span className="text-sm font-mono font-medium text-gray-800">{scope.id}</span>
                            <span className="text-xs text-gray-500 ml-2">{scope.desc}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                    {selectedScopes.length === 0 && (
                      <p className="mt-2 text-xs text-gray-400">Select at least one scope.</p>
                    )}
                  </div>

                  {/* expiry */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Expiry
                    </label>
                    <select
                      value={expiresIn}
                      onChange={(e) => setExpiresIn(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {EXPIRY_OPTIONS.map((opt) => (
                        <option key={opt.label} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {createError && (
                    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      {createError}
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={!canCreate}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    {createMutation.isPending ? 'Creating…' : 'Create Key'}
                  </button>
                </div>
              </form>
            )}

            {/* reveal state */}
            {modalState === 'reveal' && (
              <div className="px-6 py-5 space-y-4">
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 font-medium">
                    This key will never be shown again. Copy it now and store it securely.
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center gap-3">
                    <code className="flex-1 text-sm font-mono text-gray-900 break-all">{newKey}</code>
                    <button
                      onClick={handleCopyKey}
                      className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      {keyCopied
                        ? <Check className="w-3.5 h-3.5 text-green-600" />
                        : <Copy className="w-3.5 h-3.5" />}
                      {keyCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox.Root
                    checked={keyAcked}
                    onCheckedChange={setKeyAcked}
                    className="w-4 h-4 flex-shrink-0 border-2 border-gray-300 rounded bg-white data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <Checkbox.Indicator>
                      <Check className="w-3 h-3 text-white" />
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                  <span className="text-sm text-gray-700">I have copied my key</span>
                </label>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={closeModal}
                    disabled={!keyAcked}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
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
