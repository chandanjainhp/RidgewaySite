'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api, { deactivateOrgUser } from '@/lib/api';
import { Users, Mail, UserX, AlertCircle, CheckCircle2, UserPlus } from 'lucide-react';
import { format } from 'date-fns';

const MONO = 'var(--font-mono)';
const SANS = 'var(--font-sans)';

const labelStyle = {
  fontFamily: MONO,
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'var(--fg-3)',
};

const cardStyle = {
  background: 'var(--bg-surface-1)',
  border: '1px solid var(--border-default)',
  borderRadius: '2px',
  overflow: 'hidden',
};

const cardHeaderStyle = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--border-hairline)',
  background: 'var(--bg-surface-2)',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const thStyle = {
  padding: '10px 16px',
  textAlign: 'left',
  fontFamily: MONO,
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--fg-3)',
  borderBottom: '1px solid var(--border-default)',
  background: 'var(--bg-surface-2)',
};

const tdStyle = {
  padding: '12px 16px',
  fontFamily: SANS,
  fontSize: '13px',
  color: 'var(--fg-2)',
  borderBottom: '1px solid var(--border-hairline)',
};

export default function MembersSettingsPage() {
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const inviteInputRef = useRef(null);

  const { data: response, isLoading } = useQuery({
    queryKey: ['org-members'],
    queryFn: () => api.get('/org/users'),
  });

  const members = Array.isArray(response) ? response : response?.users ?? [];

  const inviteMutation = useMutation({
    mutationFn: (email) => api.post('/org/users/invite', { email }),
    onSuccess: (data) => {
      setInviteSuccess(`Invite sent to ${inviteEmail}!`);
      setInviteEmail('');
      setInviteError('');
      queryClient.invalidateQueries(['org-members']);
      setTimeout(() => setInviteSuccess(''), 5000);
    },
    onError: (error) => {
      setInviteError(error.response?.data?.message || 'Failed to send invite');
      setInviteSuccess('');
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId) => deactivateOrgUser(userId),
    onSuccess: () => {
      toast.success('Member removed');
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
    },
    onError: (err) => {
      toast.error(err?.message ?? 'Failed to remove member');
    },
  });

  const onlyAdmin = members.length === 1 && (members[0]?.role === 'org_admin' || members[0]?.role === 'super_admin');

  const focusInvite = () => {
    if (inviteInputRef.current) {
      inviteInputRef.current.focus();
      inviteInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{
          fontFamily: SANS,
          fontSize: '20px',
          fontWeight: 600,
          color: 'var(--fg-1)',
          margin: 0,
          letterSpacing: '-0.01em',
        }}>
          Organisation Members
        </h1>
        <p style={{
          fontFamily: SANS,
          fontSize: '13px',
          color: 'var(--fg-3)',
          marginTop: '6px',
          marginBottom: 0,
        }}>
          Manage who has access to your organisation's data.
        </p>
      </div>

      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <Users size={14} style={{ color: 'var(--fg-3)' }} />
          <h2 style={labelStyle}>Current Members</h2>
        </div>

        {onlyAdmin ? (
          <div style={{
            padding: '48px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: '16px',
          }}>
            <Users size={28} style={{ color: 'var(--fg-4)', opacity: 0.6 }} />
            <div style={{
              fontFamily: SANS,
              fontSize: '13px',
              color: 'var(--fg-3)',
              maxWidth: '360px',
              lineHeight: 1.5,
            }}>
              Invite your team to share the morning briefing workflow.
            </div>
            <button
              type="button"
              onClick={focusInvite}
              style={{
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
                letterSpacing: '0.08em',
                cursor: 'pointer',
              }}
            >
              <UserPlus size={12} />
              Invite Operator
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Last Login</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="5" style={{ ...tdStyle, padding: '32px 16px', textAlign: 'center', color: 'var(--fg-4)', fontFamily: MONO, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Loading members...
                    </td>
                  </tr>
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ ...tdStyle, padding: '32px 16px', textAlign: 'center', color: 'var(--fg-4)', fontFamily: MONO, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      No members found.
                    </td>
                  </tr>
                ) : (
                  members.map((m) => (
                    <tr
                      key={m._id}
                      style={{ background: !m.isActive ? 'var(--bg-surface-2)' : 'transparent' }}
                    >
                      <td style={tdStyle}>
                        <div style={{
                          fontFamily: SANS,
                          fontWeight: 500,
                          color: !m.isActive ? 'var(--fg-3)' : 'var(--fg-1)',
                          fontSize: '13px',
                        }}>
                          {m.username}
                        </div>
                        <div style={{
                          fontFamily: MONO,
                          fontSize: '11px',
                          color: 'var(--fg-3)',
                          marginTop: '2px',
                        }}>
                          {m.email}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          textTransform: 'capitalize',
                          color: 'var(--fg-2)',
                          fontFamily: SANS,
                          fontSize: '13px',
                        }}>
                          {m.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 8px',
                          borderRadius: '2px',
                          fontFamily: MONO,
                          fontSize: '10px',
                          fontWeight: 600,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          border: '1px solid',
                          borderColor: m.isActive ? 'var(--sev-harmless)' : 'var(--border-default)',
                          color: m.isActive ? 'var(--sev-harmless)' : 'var(--fg-4)',
                          background: 'transparent',
                        }}>
                          {m.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--fg-3)', fontFamily: MONO, fontSize: '11px' }}>
                        {m.lastLoginAt ? format(new Date(m.lastLoginAt), 'MMM d, yyyy HH:mm') : 'Never'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {m.role !== 'org_admin' && m.role !== 'super_admin' && m.isActive && (
                          <button
                            onClick={() => {
                              if (!window.confirm('Remove this member? They will lose access immediately.')) return;
                              deactivateMutation.mutate(m._id);
                            }}
                            disabled={deactivateMutation.isPending}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              background: 'transparent',
                              border: '1px solid var(--border-default)',
                              borderRadius: '2px',
                              color: 'var(--sev-serious)',
                              fontFamily: MONO,
                              fontSize: '10px',
                              fontWeight: 600,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              cursor: deactivateMutation.isPending ? 'not-allowed' : 'pointer',
                              opacity: deactivateMutation.isPending ? 0.5 : 1,
                            }}
                          >
                            <UserX size={12} />
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <Mail size={14} style={{ color: 'var(--fg-3)' }} />
          <h2 style={labelStyle}>Invite New Operator</h2>
        </div>
        <div style={{ padding: '20px' }}>
          <p style={{
            fontFamily: SANS,
            fontSize: '13px',
            color: 'var(--fg-3)',
            marginTop: 0,
            marginBottom: '16px',
            lineHeight: 1.5,
          }}>
            Operators can view incidents, acknowledge events, and review AI briefings. They cannot manage other users or organisation settings.
          </p>

          {inviteSuccess && (
            <div style={{
              marginBottom: '16px',
              padding: '10px 12px',
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--sev-harmless)',
              borderRadius: '2px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: SANS,
              fontSize: '13px',
              color: 'var(--sev-harmless)',
            }}>
              <CheckCircle2 size={16} />
              {inviteSuccess}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setInviteError('');
              inviteMutation.mutate(inviteEmail);
            }}
            style={{ display: 'flex', flexDirection: 'row', gap: '8px', flexWrap: 'wrap' }}
          >
            <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
              <input
                ref={inviteInputRef}
                type="email"
                required
                placeholder="operator@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'var(--bg-base)',
                  border: '1px solid',
                  borderColor: inviteError ? 'var(--sev-serious)' : 'var(--border-default)',
                  borderRadius: '2px',
                  fontFamily: MONO,
                  fontSize: '12px',
                  color: 'var(--fg-1)',
                  outline: 'none',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = inviteError ? 'var(--sev-serious)' : 'var(--border-default)'; }}
              />
              {inviteError && (
                <p style={{
                  marginTop: '6px',
                  marginBottom: 0,
                  fontFamily: MONO,
                  fontSize: '10px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--sev-serious)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <AlertCircle size={11} />
                  {inviteError}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={!inviteEmail || inviteMutation.isPending}
              style={{
                display: 'inline-flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '8px 16px',
                background: 'var(--accent)',
                color: 'var(--bg-base)',
                border: '1px solid var(--accent)',
                borderRadius: '2px',
                fontFamily: MONO,
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: (!inviteEmail || inviteMutation.isPending) ? 'not-allowed' : 'pointer',
                opacity: (!inviteEmail || inviteMutation.isPending) ? 0.5 : 1,
                height: '36px',
              }}
            >
              {inviteMutation.isPending ? 'Sending...' : 'Send Invite'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
