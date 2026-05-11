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

/* ── FileTypeIcon ─────────────────────────────────────────── */

function FileTypeIcon({ mimeType, className = 'w-5 h-5' }) {
  if (mimeType === 'application/pdf') {
    return <FileText className={`${className} text-red-500`} />;
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return <FileText className={`${className} text-blue-500`} />;
  }
  if (mimeType === 'text/plain') {
    return <FileText className={`${className} text-gray-400`} />;
  }
  return <File className={`${className} text-gray-400`} />;
}

/* ── StatusBadge ──────────────────────────────────────────── */

function StatusBadge({ status }) {
  const map = {
    pending:  { label: 'Pending review', cls: 'bg-amber-100 text-amber-700' },
    approved: { label: 'Approved',       cls: 'bg-blue-100 text-blue-700' },
    indexing: { label: 'Indexing…',      cls: 'bg-blue-100 text-blue-700', spin: true },
    indexed:  { label: 'Ready',          cls: 'bg-green-100 text-green-700' },
    rejected: { label: 'Rejected',       cls: 'bg-red-100 text-red-700' },
    failed:   { label: 'Failed',         cls: 'bg-red-100 text-red-700' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>
      {s.spin && <Loader2 className="w-3 h-3 animate-spin" />}
      {s.label}
    </span>
  );
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Upload document</h2>
          <button onClick={onClose} disabled={uploading} className="text-gray-400 hover:text-gray-600 disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!file ? (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-gray-300 hover:border-indigo-300 hover:bg-gray-50'
                }`}
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">Drop a file here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">PDF, DOCX, TXT · max 10 MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={(e) => e.target.files[0] && selectFile(e.target.files[0])}
                />
              </div>
              {fileError && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  {fileError}
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
              <FileTypeIcon mimeType={file.type} className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
              </div>
              {!uploading && (
                <button onClick={() => setFile(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {uploading && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>Uploading…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-200 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {uploadError && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              {uploadError}
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Reject document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Reason <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this document is being rejected…"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => rejectMutation.mutate()}
            disabled={rejectMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors"
          >
            {rejectMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-9 h-9 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Delete document?</h2>
              <p className="text-sm text-gray-500 mt-1">
                {doc.status === 'indexed'
                  ? 'This document is indexed. Deleting it will remove its content from AI context.'
                  : 'This action cannot be undone.'}
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors"
          >
            {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
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
        <span className="text-sm text-gray-600">
          <span className="font-medium text-red-700">Rejection reason: </span>
          {doc.rejectionReason || 'No reason provided'}
        </span>
      );
    }
    if (doc.status === 'failed') {
      return (
        <span className="text-sm text-red-700">
          <span className="font-medium">Error: </span>
          {doc.errorMessage || 'Unknown error'}
        </span>
      );
    }
    if (doc.status === 'indexed') {
      return (
        <span className="text-sm text-gray-600">
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
      <span className="text-sm text-gray-500">
        Uploaded {formatDate(doc.createdAt)} — {desc[doc.status] ?? doc.status}
      </span>
    );
  }

  /* loading skeleton */
  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-96 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="px-6 py-4 border-b border-gray-100 flex items-center gap-4">
              <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="h-5 w-20 bg-gray-100 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        Failed to load documents. Please refresh the page.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-500" />
            Knowledge base
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload documents to improve AI investigation accuracy. Approved documents are used as context in all investigations.
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload document
        </button>
      </div>

      {/* How it works banner */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <button
          onClick={() => setShowHowItWorks((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-400" />
            How does this work?
          </span>
          {showHowItWorks
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronRight className="w-4 h-4 text-gray-400" />
          }
        </button>
        {showHowItWorks && (
          <div className="px-5 pb-5 border-t border-gray-100">
            <ol className="space-y-2 mt-4 text-sm text-gray-600">
              <li><span className="font-semibold text-gray-800">1. Upload</span> — Upload PDF, DOCX, or TXT files up to 10 MB</li>
              <li><span className="font-semibold text-gray-800">2. Review</span> — An org admin reviews and approves the document</li>
              <li><span className="font-semibold text-gray-800">3. Indexing</span> — Approved documents are automatically processed</li>
              <li><span className="font-semibold text-gray-800">4. Ready</span> — The AI uses approved documents during investigations</li>
            </ol>
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-0 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by filename…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
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
          <RefreshCw className="w-3.5 h-3.5 text-gray-300 animate-spin" />
        )}
      </div>

      {/* Content */}
      {docs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-700 mb-1">No documents yet</h3>
          <p className="text-sm text-gray-400 mb-5 max-w-sm mx-auto">
            Upload site documents, SOPs, or compliance reports to enhance AI investigation accuracy.
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload document
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
          <p className="text-sm text-gray-400">No documents match your filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="w-8 px-3 py-3" />
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Uploaded by</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Chunks</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((doc) => {
                const expanded = expandedRows.has(doc._id);
                const isCurrentUser =
                  doc.uploadedBy?._id?.toString() === user?._id?.toString();

                return (
                  <React.Fragment key={doc._id}>
                    <tr
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => toggleRow(doc._id)}
                    >
                      <td className="px-3 py-4 text-gray-400">
                        {expanded
                          ? <ChevronDown className="w-3.5 h-3.5" />
                          : <ChevronRight className="w-3.5 h-3.5" />
                        }
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2.5">
                          <FileTypeIcon mimeType={doc.mimeType} className="w-4 h-4 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-gray-900 truncate max-w-[200px]">
                              {doc.originalName || doc.filename}
                            </p>
                            <p className="text-xs text-gray-400">{formatDate(doc.createdAt)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {isCurrentUser ? (
                          <span className="text-xs font-medium text-indigo-600">You</span>
                        ) : doc.uploadedBy?.username ? (
                          <span className="text-xs text-gray-700">{doc.uploadedBy.username}</span>
                        ) : (
                          <span className="text-xs text-gray-400">Team member</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-gray-500 text-xs">{formatFileSize(doc.fileSize)}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={doc.status} />
                        {doc.status === 'indexing' && (
                          <p className="text-xs text-gray-400 mt-0.5">May take a minute for large files</p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-gray-500 text-xs">
                        {doc.status === 'indexed' ? doc.chunkCount : '—'}
                      </td>
                      <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {doc.status === 'pending' && isAdmin && (
                            <>
                              <button
                                onClick={() => approveMutation.mutate(doc._id)}
                                disabled={approveMutation.isPending && approveMutation.variables === doc._id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 disabled:opacity-40 transition-colors"
                              >
                                <Check className="w-3 h-3" />
                                Approve
                              </button>
                              <button
                                onClick={() => setRejectDocId(doc._id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                              >
                                <X className="w-3 h-3" />
                                Reject
                              </button>
                            </>
                          )}
                          {doc.status === 'pending' && !isAdmin && (
                            <span className="text-xs text-gray-400 italic">Awaiting review</span>
                          )}
                          {doc.status === 'indexing' && (
                            <span className="text-xs text-gray-400 italic">Processing…</span>
                          )}
                          {(doc.status === 'indexed' || doc.status === 'rejected' || doc.status === 'failed') && (
                            <button
                              onClick={() => setDeleteDoc(doc)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-indigo-50/40">
                        <td />
                        <td colSpan={6} className="px-4 py-3">
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
