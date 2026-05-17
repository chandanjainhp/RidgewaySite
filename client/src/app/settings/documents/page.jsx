'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  BookOpen, Upload, FileText, File, Loader2,
  ChevronDown, ChevronRight, AlertTriangle, Trash2,
  Check, X, Search, Filter, Info, RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import {
  getOrgDocuments,
  uploadOrgDocument,
  deleteOrgDocument,
  approveOrgDocument,
  rejectOrgDocument,
} from '@/lib/api';

const MONO = 'var(--font-mono)';
const SANS = 'var(--font-sans)';

/* ── helpers ─────────────────────────────────────────────── */

function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d) {
  if (!d) return '—';
  return format(new Date(d), 'MMM d, yyyy');
}

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];
const MAX_BYTES = 10 * 1024 * 1024;

function validateFile(file) {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return 'Only PDF, DOCX, and TXT files are accepted.';
  }
  if (file.size > MAX_BYTES) {
    return `File must be under 10 MB (this file is ${formatFileSize(file.size)}).`;
  }
  return null;
}

/* ── shared button styles ─────────────────────────────────── */

const primaryBtnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 12px',
  background: 'var(--accent)',
  color: 'var(--bg-base)',
  border: '1px solid var(--accent)',
  borderRadius: '2px',
  fontFamily: MONO,
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};

const secondaryBtnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 12px',
  background: 'var(--bg-surface-1)',
  color: 'var(--fg-2)',
  border: '1px solid var(--border-default)',
  borderRadius: '2px',
  fontFamily: MONO,
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};

const dangerBtnStyle = {
  ...primaryBtnStyle,
  background: 'var(--sev-serious)',
  border: '1px solid var(--sev-serious)',
  color: 'var(--bg-base)',
};

/* ── FileTypeIcon ─────────────────────────────────────────── */

function FileTypeIcon({ mimeType, size = 16 }) {
  if (mimeType === 'application/pdf') {
    return <FileText size={size} style={{ color: 'var(--sev-serious)', flexShrink: 0 }} />;
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return <FileText size={size} style={{ color: 'var(--sev-info)', flexShrink: 0 }} />;
  }
  if (mimeType === 'text/plain') {
    return <FileText size={size} style={{ color: 'var(--fg-3)', flexShrink: 0 }} />;
  }
  return <File size={size} style={{ color: 'var(--fg-3)', flexShrink: 0 }} />;
}

/* ── StatusBadge ──────────────────────────────────────────── */

const BADGE_STYLES = {
  pending:  { color: 'var(--sev-warning)',  bg: 'rgba(232,154,43,0.10)', label: 'PENDING' },
  approved: { color: 'var(--accent)',       bg: 'rgba(184,212,232,0.10)', label: 'APPROVED' },
  indexing: { color: 'var(--accent)',       bg: 'rgba(184,212,232,0.10)', label: 'INDEXING', spin: true },
  indexed:  { color: 'var(--sev-harmless)', bg: 'rgba(125,138,106,0.12)', label: 'ACTIVE' },
  rejected: { color: 'var(--sev-serious)',  bg: 'rgba(255,56,56,0.10)',   label: 'REJECTED' },
  failed:   { color: 'var(--sev-serious)',  bg: 'rgba(255,56,56,0.10)',   label: 'FAILED' },
};

function StatusBadge({ status, chunkCount }) {
  const s = BADGE_STYLES[status] ?? { color: 'var(--fg-3)', bg: 'var(--bg-surface-2)', label: status?.toUpperCase() ?? '—' };
  const label = (status === 'indexed' && chunkCount != null)
    ? `${s.label} · ${chunkCount} chunks`
    : s.label;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px',
      background: s.bg,
      color: s.color,
      fontFamily: MONO,
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.1em',
      borderRadius: '2px',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      {s.spin && <Loader2 style={{ width: '10px', height: '10px', animation: 'spin 1s linear infinite' }} />}
      {label}
    </span>
  );
}

/* ── modal shell ──────────────────────────────────────────── */

const modalOverlay = {
  position: 'fixed', inset: 0, zIndex: 50,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(0,0,0,0.55)',
};

const modalCard = {
  background: 'var(--bg-surface-1)',
  border: '1px solid var(--border-default)',
  borderRadius: '2px',
  width: '100%',
  maxWidth: '440px',
  margin: '0 16px',
  overflow: 'hidden',
  fontFamily: SANS,
};

const modalHeader = {
  padding: '14px 20px',
  borderBottom: '1px solid var(--border-hairline)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const modalTitle = {
  fontFamily: MONO,
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--fg-1)',
};

const modalFooter = {
  padding: '14px 20px',
  borderTop: '1px solid var(--border-hairline)',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  background: 'var(--bg-surface-2)',
};

const iconBtnStyle = {
  background: 'transparent',
  border: 'none',
  color: 'var(--fg-3)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4px',
};

/* ── UploadModal ──────────────────────────────────────────── */

function UploadModal({ onClose, onSuccess }) {
  const [file, setFile]             = useState(null);
  const [fileError, setFileError]   = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress]     = useState(0);
  const [uploading, setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  function selectFile(f) {
    const err = validateFile(f);
    if (err) {
      setFileError(err);
      setFile(null);
    } else {
      setFileError('');
      setFile(f);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) selectFile(f);
  }

  async function handleUpload() {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    setUploadError('');
    setProgress(0);
    try {
      await uploadOrgDocument(formData, (evt) => {
        if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100));
      });
      onSuccess();
    } catch (err) {
      setUploadError(err?.message || 'Upload failed. Please try again.');
      setProgress(0);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={modalOverlay}>
      <div style={modalCard}>
        <div style={modalHeader}>
          <h2 style={modalTitle}>Upload document</h2>
          <button onClick={onClose} disabled={uploading} style={{ ...iconBtnStyle, opacity: uploading ? 0.4 : 1 }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {!file ? (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `1px dashed ${isDragging ? 'var(--accent)' : 'var(--border-default)'}`,
                  background: isDragging ? 'rgba(184,212,232,0.06)' : 'var(--bg-surface-2)',
                  borderRadius: '2px',
                  padding: '28px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'border-color 120ms, background 120ms',
                }}
              >
                <Upload size={22} style={{ color: 'var(--fg-3)', display: 'block', margin: '0 auto 8px' }} />
                <p style={{ fontFamily: SANS, fontSize: '13px', color: 'var(--fg-2)', margin: 0 }}>
                  Drop a file here or click to browse
                </p>
                <p style={{
                  fontFamily: MONO, fontSize: '10px', color: 'var(--fg-4)',
                  letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '6px',
                }}>
                  PDF · DOCX · TXT · max 10 MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files[0] && selectFile(e.target.files[0])}
                />
              </div>
              {fileError && (
                <p style={{
                  fontFamily: SANS, fontSize: '12px', color: 'var(--sev-serious)',
                  display: 'flex', alignItems: 'center', gap: '6px', margin: 0,
                }}>
                  <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                  {fileError}
                </p>
              )}
            </>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px', border: '1px solid var(--border-hairline)',
              borderRadius: '2px', background: 'var(--bg-surface-2)',
            }}>
              <FileTypeIcon mimeType={file.type} size={16} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontFamily: SANS, fontSize: '13px', color: 'var(--fg-1)',
                  margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{file.name}</p>
                <p style={{
                  fontFamily: MONO, fontSize: '10px', color: 'var(--fg-3)',
                  letterSpacing: '0.08em', margin: '2px 0 0',
                }}>{formatFileSize(file.size)}</p>
              </div>
              {!uploading && (
                <button onClick={() => setFile(null)} style={iconBtnStyle}>
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {uploading && (
            <div>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontFamily: MONO, fontSize: '10px', color: 'var(--fg-3)',
                letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px',
              }}>
                <span>Uploading…</span>
                <span>{progress}%</span>
              </div>
              <div style={{
                height: '4px', background: 'var(--bg-surface-3)',
                borderRadius: '2px', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', background: 'var(--accent)',
                  width: `${progress}%`, transition: 'width 200ms',
                }} />
              </div>
            </div>
          )}

          {uploadError && (
            <p style={{
              fontFamily: SANS, fontSize: '12px', color: 'var(--sev-serious)',
              display: 'flex', alignItems: 'center', gap: '6px', margin: 0,
            }}>
              <AlertTriangle size={12} style={{ flexShrink: 0 }} />
              {uploadError}
            </p>
          )}
        </div>

        <div style={modalFooter}>
          <button
            onClick={onClose}
            disabled={uploading}
            style={{ ...secondaryBtnStyle, opacity: uploading ? 0.4 : 1 }}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            style={{ ...primaryBtnStyle, opacity: (!file || uploading) ? 0.4 : 1, cursor: (!file || uploading) ? 'not-allowed' : 'pointer' }}
          >
            {uploading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={12} />}
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── RejectModal ──────────────────────────────────────────── */

function RejectModal({ docId, onClose, onSuccess }) {
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  const rejectMutation = useMutation({
    mutationFn: () => rejectOrgDocument(docId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-documents'] });
      onSuccess();
    },
    onError: (err) => toast.error(err?.message || 'Failed to reject document'),
  });

  return (
    <div style={modalOverlay}>
      <div style={{ ...modalCard, maxWidth: '380px' }}>
        <div style={modalHeader}>
          <h2 style={modalTitle}>Reject document</h2>
          <button onClick={onClose} style={iconBtnStyle}>
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: '20px' }}>
          <label style={{
            display: 'block',
            fontFamily: MONO, fontSize: '10px', fontWeight: 600,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--fg-3)', marginBottom: '8px',
          }}>
            Reason <span style={{ color: 'var(--fg-4)', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this document is being rejected…"
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid var(--border-default)',
              borderRadius: '2px',
              background: 'var(--bg-base)',
              color: 'var(--fg-1)',
              fontFamily: SANS,
              fontSize: '13px',
              resize: 'none',
              outline: 'none',
            }}
          />
        </div>
        <div style={modalFooter}>
          <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
          <button
            onClick={() => rejectMutation.mutate()}
            disabled={rejectMutation.isPending}
            style={{ ...dangerBtnStyle, opacity: rejectMutation.isPending ? 0.4 : 1 }}
          >
            {rejectMutation.isPending && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── DeleteConfirmModal ───────────────────────────────────── */

function DeleteConfirmModal({ doc, onClose, onSuccess }) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => deleteOrgDocument(doc._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-documents'] });
      toast.success('Document deleted');
      onSuccess();
    },
    onError: (err) => toast.error(err?.message || 'Failed to delete document'),
  });

  return (
    <div style={modalOverlay}>
      <div style={{ ...modalCard, maxWidth: '380px' }}>
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{
              flexShrink: 0, width: '32px', height: '32px',
              background: 'rgba(255,56,56,0.12)',
              border: '1px solid var(--sev-serious)',
              borderRadius: '2px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Trash2 size={14} style={{ color: 'var(--sev-serious)' }} />
            </div>
            <div>
              <h2 style={modalTitle}>Delete document?</h2>
              <p style={{
                fontFamily: SANS, fontSize: '13px', color: 'var(--fg-3)',
                marginTop: '8px', margin: '8px 0 0', lineHeight: 1.5,
              }}>
                {doc.status === 'indexed'
                  ? 'This document is indexed. Deleting it will remove its content from AI context.'
                  : 'This action cannot be undone.'}
              </p>
            </div>
          </div>
        </div>
        <div style={modalFooter}>
          <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            style={{ ...dangerBtnStyle, opacity: deleteMutation.isPending ? 0.4 : 1 }}
          >
            {deleteMutation.isPending && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────── */

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  const isAdmin = role === 'org_admin' || role === 'super_admin';

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [rejectDocId, setRejectDocId]         = useState(null);
  const [deleteDoc, setDeleteDoc]             = useState(null);
  const [expandedRows, setExpandedRows]       = useState(new Set());
  const [showHowItWorks, setShowHowItWorks]   = useState(false);
  const [statusFilter, setStatusFilter]       = useState('all');
  const [searchInput, setSearchInput]         = useState('');
  const [searchTerm, setSearchTerm]           = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: docs = [], isLoading, isFetching, isError } = useQuery({
    queryKey: ['org-documents'],
    queryFn: getOrgDocuments,
    refetchInterval: 10000,
  });

  const approveMutation = useMutation({
    mutationFn: (docId) => approveOrgDocument(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-documents'] });
      toast.success('Document approved — queued for indexing');
    },
    onError: (err) => toast.error(err?.message || 'Failed to approve document'),
  });

  const filtered = docs.filter((doc) => {
    if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
    if (searchTerm) {
      const name = (doc.originalName || doc.filename || '').toLowerCase();
      if (!name.includes(searchTerm.toLowerCase())) return false;
    }
    return true;
  });

  function toggleRow(id) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function getExpandedContent(doc) {
    if (doc.status === 'rejected') {
      return (
        <span style={{ fontFamily: SANS, fontSize: '12px', color: 'var(--fg-3)' }}>
          <span style={{ fontWeight: 600, color: 'var(--sev-serious)' }}>Rejection reason: </span>
          {doc.rejectionReason || 'No reason provided'}
        </span>
      );
    }
    if (doc.status === 'failed') {
      return (
        <span style={{ fontFamily: SANS, fontSize: '12px', color: 'var(--sev-serious)' }}>
          <span style={{ fontWeight: 600 }}>Error: </span>
          {doc.errorMessage || 'Unknown error'}
        </span>
      );
    }
    if (doc.status === 'indexed') {
      return (
        <span style={{ fontFamily: SANS, fontSize: '12px', color: 'var(--fg-3)' }}>
          Indexed {doc.chunkCount} chunk{doc.chunkCount !== 1 ? 's' : ''} on {formatDate(doc.indexedAt)}
        </span>
      );
    }
    const desc = {
      pending:  'Awaiting review by an org admin',
      approved: 'Approved — waiting to be picked up by the indexer',
      indexing: 'Being processed — this may take a minute for large documents',
    };
    return (
      <span style={{ fontFamily: SANS, fontSize: '12px', color: 'var(--fg-3)' }}>
        Uploaded {formatDate(doc.createdAt)} — {desc[doc.status] ?? doc.status}
      </span>
    );
  }

  const cardStyle = {
    background: 'var(--bg-surface-1)',
    border: '1px solid var(--border-default)',
    borderRadius: '2px',
    overflow: 'hidden',
  };

  /* loading skeleton */
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: SANS }}>
        <div>
          <div style={{ height: '24px', width: '180px', background: 'var(--bg-surface-2)', borderRadius: '2px', marginBottom: '8px' }} />
          <div style={{ height: '12px', width: '320px', background: 'var(--bg-surface-2)', borderRadius: '2px' }} />
        </div>
        <div style={cardStyle}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--border-hairline)',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <div style={{ height: '16px', width: '16px', background: 'var(--bg-surface-2)', borderRadius: '2px' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ height: '12px', width: '180px', background: 'var(--bg-surface-2)', borderRadius: '2px' }} />
                <div style={{ height: '10px', width: '80px', background: 'var(--bg-surface-2)', borderRadius: '2px' }} />
              </div>
              <div style={{ height: '14px', width: '60px', background: 'var(--bg-surface-2)', borderRadius: '2px' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        border: '1px solid var(--sev-serious)',
        background: 'rgba(255,56,56,0.08)',
        padding: '12px 14px',
        color: 'var(--sev-serious)',
        fontFamily: SANS, fontSize: '13px',
        borderRadius: '2px',
      }}>
        <AlertTriangle size={14} style={{ flexShrink: 0 }} />
        Failed to load documents. Please refresh the page.
      </div>
    );
  }

  const labelStyle = {
    fontFamily: MONO,
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--fg-3)',
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid var(--border-default)',
    borderRadius: '2px',
    background: 'var(--bg-base)',
    color: 'var(--fg-1)',
    fontFamily: SANS,
    fontSize: '13px',
    outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: SANS }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            fontFamily: MONO,
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--fg-1)',
            margin: 0,
          }}>
            <BookOpen size={14} style={{ color: 'var(--accent)' }} />
            Knowledge base
          </h1>
          <p style={{
            fontFamily: SANS, fontSize: '12px',
            color: 'var(--fg-3)', marginTop: '6px', margin: '6px 0 0',
            lineHeight: 1.5, maxWidth: '560px',
          }}>
            Upload documents to improve AI investigation accuracy. Approved documents are used as context in all investigations.
          </p>
        </div>
        <button onClick={() => setShowUploadModal(true)} style={{ ...primaryBtnStyle, flexShrink: 0 }}>
          <Upload size={12} />
          Upload document
        </button>
      </div>

      {/* How it works banner */}
      <div style={cardStyle}>
        <button
          onClick={() => setShowHowItWorks((v) => !v)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'transparent',
            border: 'none',
            color: 'var(--fg-2)',
            fontFamily: MONO,
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Info size={12} style={{ color: 'var(--accent)' }} />
            How does this work?
          </span>
          {showHowItWorks
            ? <ChevronDown size={14} style={{ color: 'var(--fg-3)' }} />
            : <ChevronRight size={14} style={{ color: 'var(--fg-3)' }} />
          }
        </button>
        {showHowItWorks && (
          <div style={{ padding: '14px 16px 16px', borderTop: '1px solid var(--border-hairline)' }}>
            <ol style={{
              listStyle: 'none', padding: 0, margin: 0,
              display: 'flex', flexDirection: 'column', gap: '6px',
              fontFamily: SANS, fontSize: '12px', color: 'var(--fg-3)',
            }}>
              <li><span style={{ fontWeight: 600, color: 'var(--fg-2)' }}>1. Upload</span> — Upload PDF, DOCX, or TXT files up to 10 MB</li>
              <li><span style={{ fontWeight: 600, color: 'var(--fg-2)' }}>2. Review</span> — An org admin reviews and approves the document</li>
              <li><span style={{ fontWeight: 600, color: 'var(--fg-2)' }}>3. Indexing</span> — Approved documents are automatically processed</li>
              <li><span style={{ fontWeight: 600, color: 'var(--fg-2)' }}>4. Ready</span> — The AI uses approved documents during investigations</li>
            </ol>
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 0, maxWidth: '280px' }}>
          <Search size={14} style={{
            position: 'absolute', left: '10px', top: '50%',
            transform: 'translateY(-50%)', color: 'var(--fg-4)', pointerEvents: 'none',
          }} />
          <input
            type="text"
            placeholder="Search by filename…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '32px' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={14} style={{ color: 'var(--fg-4)' }} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ ...inputStyle, width: 'auto', paddingRight: '24px' }}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="indexing">Indexing</option>
            <option value="indexed">Ready</option>
            <option value="rejected">Rejected</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        {isFetching && !isLoading && (
          <RefreshCw size={12} style={{ color: 'var(--fg-4)', animation: 'spin 1s linear infinite' }} />
        )}
      </div>

      {/* Content */}
      {docs.length === 0 ? (
        <div style={{ ...cardStyle, padding: '48px 24px', textAlign: 'center' }}>
          <BookOpen size={32} style={{ color: 'var(--fg-4)', display: 'block', margin: '0 auto 14px' }} />
          <h3 style={{
            fontFamily: MONO, fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--fg-2)', margin: '0 0 10px',
          }}>
            No documents yet
          </h3>
          <p style={{
            fontFamily: SANS, fontSize: '13px', color: 'var(--fg-3)',
            maxWidth: '420px', margin: '0 auto 18px', lineHeight: 1.6,
          }}>
            Upload your site procedures, contractor schedules, and safety manuals. Claude uses them during investigations.
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            style={{ ...primaryBtnStyle, margin: '0 auto' }}
          >
            <Upload size={12} />
            Upload document
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...cardStyle, padding: '40px 24px', textAlign: 'center' }}>
          <p style={{ fontFamily: SANS, fontSize: '13px', color: 'var(--fg-3)', margin: 0 }}>
            No documents match your filters.
          </p>
        </div>
      ) : (
        <div style={cardStyle}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontFamily: SANS }}>
            <thead style={{
              background: 'var(--bg-surface-2)',
              borderBottom: '1px solid var(--border-hairline)',
            }}>
              <tr>
                <th style={{ width: '32px', padding: '10px 12px' }} />
                <th style={{ ...labelStyle, padding: '10px 14px' }}>Document</th>
                <th style={{ ...labelStyle, padding: '10px 14px' }}>Uploaded by</th>
                <th style={{ ...labelStyle, padding: '10px 14px' }}>Size</th>
                <th style={{ ...labelStyle, padding: '10px 14px' }}>Status</th>
                <th style={{ ...labelStyle, padding: '10px 14px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => {
                const expanded = expandedRows.has(doc._id);
                const isCurrentUser =
                  doc.uploadedBy?._id?.toString() === user?._id?.toString();

                return (
                  <React.Fragment key={doc._id}>
                    <tr
                      style={{
                        borderTop: '1px solid var(--border-hairline)',
                        cursor: 'pointer',
                        transition: 'background 120ms',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface-2)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      onClick={() => toggleRow(doc._id)}
                    >
                      <td style={{ padding: '12px', color: 'var(--fg-4)' }}>
                        {expanded
                          ? <ChevronDown size={12} />
                          : <ChevronRight size={12} />
                        }
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <FileTypeIcon mimeType={doc.mimeType} size={14} />
                          <div>
                            <p style={{
                              fontFamily: SANS, fontSize: '13px', color: 'var(--fg-1)',
                              margin: 0, overflow: 'hidden', textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap', maxWidth: '220px',
                            }}>
                              {doc.originalName || doc.filename}
                            </p>
                            <p style={{
                              fontFamily: MONO, fontSize: '10px', color: 'var(--fg-4)',
                              letterSpacing: '0.08em', margin: '2px 0 0',
                            }}>{formatDate(doc.createdAt)}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {isCurrentUser ? (
                          <span style={{
                            fontFamily: MONO, fontSize: '10px', fontWeight: 700,
                            letterSpacing: '0.1em', textTransform: 'uppercase',
                            color: 'var(--accent)',
                          }}>You</span>
                        ) : doc.uploadedBy?.username ? (
                          <span style={{ fontFamily: SANS, fontSize: '12px', color: 'var(--fg-2)' }}>
                            {doc.uploadedBy.username}
                          </span>
                        ) : (
                          <span style={{ fontFamily: SANS, fontSize: '12px', color: 'var(--fg-4)' }}>
                            Team member
                          </span>
                        )}
                      </td>
                      <td style={{
                        padding: '12px 14px',
                        fontFamily: MONO, fontSize: '11px', color: 'var(--fg-3)',
                      }}>{formatFileSize(doc.fileSize)}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge status={doc.status} chunkCount={doc.chunkCount} />
                        {doc.status === 'indexing' && (
                          <p style={{
                            fontFamily: SANS, fontSize: '11px', color: 'var(--fg-4)',
                            margin: '4px 0 0',
                          }}>May take a minute for large files</p>
                        )}
                      </td>
                      <td
                        style={{ padding: '12px 14px', textAlign: 'right' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          {doc.status === 'pending' && isAdmin && (
                            <>
                              <button
                                onClick={() => approveMutation.mutate(doc._id)}
                                disabled={approveMutation.isPending && approveMutation.variables === doc._id}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  padding: '5px 9px',
                                  background: 'rgba(125,138,106,0.12)',
                                  color: 'var(--sev-harmless)',
                                  border: '1px solid var(--sev-harmless)',
                                  borderRadius: '2px',
                                  fontFamily: MONO, fontSize: '10px', fontWeight: 700,
                                  letterSpacing: '0.1em', textTransform: 'uppercase',
                                  cursor: 'pointer',
                                }}
                              >
                                <Check size={10} />
                                Approve
                              </button>
                              <button
                                onClick={() => setRejectDocId(doc._id)}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  padding: '5px 9px',
                                  background: 'rgba(255,56,56,0.10)',
                                  color: 'var(--sev-serious)',
                                  border: '1px solid var(--sev-serious)',
                                  borderRadius: '2px',
                                  fontFamily: MONO, fontSize: '10px', fontWeight: 700,
                                  letterSpacing: '0.1em', textTransform: 'uppercase',
                                  cursor: 'pointer',
                                }}
                              >
                                <X size={10} />
                                Reject
                              </button>
                            </>
                          )}
                          {doc.status === 'pending' && !isAdmin && (
                            <span style={{
                              fontFamily: MONO, fontSize: '10px', color: 'var(--fg-4)',
                              letterSpacing: '0.1em', textTransform: 'uppercase',
                              fontStyle: 'italic',
                            }}>Awaiting review</span>
                          )}
                          {doc.status === 'indexing' && (
                            <span style={{
                              fontFamily: MONO, fontSize: '10px', color: 'var(--fg-4)',
                              letterSpacing: '0.1em', textTransform: 'uppercase',
                              fontStyle: 'italic',
                            }}>Processing…</span>
                          )}
                          {(doc.status === 'indexed' || doc.status === 'rejected' || doc.status === 'failed') && (
                            <button
                              onClick={() => setDeleteDoc(doc)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '5px 9px',
                                background: 'var(--bg-surface-2)',
                                color: 'var(--fg-3)',
                                border: '1px solid var(--border-default)',
                                borderRadius: '2px',
                                fontFamily: MONO, fontSize: '10px', fontWeight: 700,
                                letterSpacing: '0.1em', textTransform: 'uppercase',
                                cursor: 'pointer',
                              }}
                            >
                              <Trash2 size={10} />
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr style={{ background: 'var(--bg-surface-2)' }}>
                        <td />
                        <td colSpan={5} style={{ padding: '10px 14px' }}>
                          {getExpandedContent(doc)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            queryClient.invalidateQueries({ queryKey: ['org-documents'] });
            toast.success('Document uploaded — pending approval');
          }}
        />
      )}
      {rejectDocId && (
        <RejectModal
          docId={rejectDocId}
          onClose={() => setRejectDocId(null)}
          onSuccess={() => setRejectDocId(null)}
        />
      )}
      {deleteDoc && (
        <DeleteConfirmModal
          doc={deleteDoc}
          onClose={() => setDeleteDoc(null)}
          onSuccess={() => setDeleteDoc(null)}
        />
      )}
    </div>
  );
}
