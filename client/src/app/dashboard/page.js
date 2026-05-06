'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { getOrgMe } from '@/lib/api';
import { X, AlertTriangle } from 'lucide-react';

export default function DashboardPage() {
  const { user, orgId } = useAuthStore();
  const [org, setOrg] = useState(null);
  const [showFirstLogin, setShowFirstLogin] = useState(false);
  const [showWebhookWarning, setShowWebhookWarning] = useState(false);

  useEffect(() => {
    // First login banner
    const dismissed = localStorage.getItem('ridgeway_first_login_dismissed');
    if (!dismissed && user?.firstLogin) {
      setShowFirstLogin(true);
    }

    // Webhook health warning (per session)
    const webhookDismissed = sessionStorage.getItem('ridgeway_webhook_warning_dismissed');
    if (!webhookDismissed) {
      getOrgMe().then((data) => {
        const o = data?.data || data;
        setOrg(o);
        if (o?.webhookUrl && o?.webhookHealthy === false) {
          setShowWebhookWarning(true);
        }
      }).catch(() => {});
    }
  }, [user]);

  const dismissFirstLogin = () => {
    localStorage.setItem('ridgeway_first_login_dismissed', '1');
    setShowFirstLogin(false);
  };

  const dismissWebhookWarning = () => {
    sessionStorage.setItem('ridgeway_webhook_warning_dismissed', '1');
    setShowWebhookWarning(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', paddingTop: '8px' }}>
      {/* Org name label */}
      {org?.name && (
        <div style={{
          padding: '4px 24px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--text-muted)',
          letterSpacing: '0.04em',
        }}>
          {org.name}
        </div>
      )}

      {/* First login banner */}
      {showFirstLogin && (
        <div style={{
          margin: '8px 24px',
          padding: '10px 16px',
          background: 'rgba(99,102,241,0.08)',
          border: '1px solid rgba(99,102,241,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#a5b4fc' }}>
            Welcome to Ridgeway. Events recorded tonight will appear here tomorrow morning.
          </span>
          <button
            onClick={dismissFirstLogin}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', flexShrink: 0 }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Webhook health warning */}
      {showWebhookWarning && (
        <div style={{
          margin: '8px 24px',
          padding: '10px 16px',
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={14} color="#f59e0b" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#f59e0b' }}>
              Webhook deliveries are failing.{' '}
              <Link href="/settings/webhooks" style={{ color: '#fbbf24', textDecoration: 'underline' }}>
                Check your webhook settings.
              </Link>
            </span>
          </div>
          <button
            onClick={dismissWebhookWarning}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', flexShrink: 0 }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main content placeholder — redirects to investigate */}
      <div style={{ padding: '32px 24px' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
          Redirecting to investigations…
        </p>
        <meta httpEquiv="refresh" content="0;url=/investigate" />
      </div>
    </div>
  );
}
