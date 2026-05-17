'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import {
  Plug, Copy, Check, Loader2, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Wrench,
} from 'lucide-react';
import { getMcpHealth, getMcpActivity } from '@/lib/api';

const MONO = 'var(--font-mono)';
const SANS = 'var(--font-sans)';

const MCP_TOOLS = [
  { tool: 'get_latest_briefing',  desc: 'Returns the morning briefing' },
  { tool: 'list_incidents',       desc: 'List incidents with optional filters' },
  { tool: 'get_incident',         desc: 'Full detail for one incident' },
  { tool: 'list_events',          desc: 'Overnight events for a date' },
  { tool: 'get_investigation',    desc: 'Investigation results' },
  { tool: 'start_investigation',  desc: 'Start an AI investigation' },
  { tool: 'get_site_status',      desc: 'Current site overview' },
];

/* ── shared style fragments ── */

const sectionStyle = {
  background: 'var(--bg-surface-1)',
  border: '1px solid var(--border-default)',
  borderRadius: '2px',
  overflow: 'hidden',
};

const sectionHeaderStyle = {
  padding: '10px 16px',
  borderBottom: '1px solid var(--border-hairline)',
  background: 'var(--bg-surface-2)',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const sectionLabelStyle = {
  fontFamily: MONO,
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'var(--fg-2)',
};

const codeChipStyle = {
  fontFamily: MONO,
  fontSize: '11px',
  background: 'var(--bg-surface-2)',
  border: '1px solid var(--border-hairline)',
  color: 'var(--fg-1)',
  padding: '2px 6px',
  borderRadius: '2px',
};

const thStyle = {
  fontFamily: MONO,
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--fg-3)',
  padding: '10px 16px',
  textAlign: 'left',
  borderBottom: '1px solid var(--border-default)',
  background: 'var(--bg-surface-2)',
};

const tdStyle = {
  padding: '10px 16px',
  fontFamily: SANS,
  fontSize: '13px',
  color: 'var(--fg-2)',
  borderBottom: '1px solid var(--border-hairline)',
};

/* ── helpers ── */

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 10px',
        fontFamily: MONO,
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: hover ? 'var(--bg-base)' : 'var(--accent)',
        background: hover ? 'var(--accent)' : 'transparent',
        border: '1px solid var(--accent)',
        borderRadius: '2px',
        cursor: 'pointer',
        transition: 'background 120ms, color 120ms',
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function QuickStartPanel({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const [hover, setHover] = useState(false);
  return (
    <div style={{
      border: '1px solid var(--border-hairline)',
      borderRadius: '2px',
      overflow: 'hidden',
      background: 'var(--bg-surface-1)',
    }}>
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: '100%',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          textAlign: 'left',
          background: hover ? 'var(--bg-surface-2)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          transition: 'background 120ms',
        }}
      >
        <span style={{
          fontFamily: MONO,
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--fg-1)',
        }}>{title}</span>
        {open
          ? <ChevronUp size={14} style={{ color: 'var(--fg-3)' }} />
          : <ChevronDown size={14} style={{ color: 'var(--fg-3)' }} />}
      </button>
      {open && (
        <div style={{
          padding: '14px',
          borderTop: '1px solid var(--border-hairline)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

function StepList({ steps }) {
  return (
    <ol style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: 0, padding: 0, listStyle: 'none' }}>
      {steps.map((s, i) => (
        <li key={i} style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start',
          fontFamily: SANS,
          fontSize: '13px',
          color: 'var(--fg-2)',
        }}>
          <span style={{
            flexShrink: 0,
            width: '18px',
            height: '18px',
            borderRadius: '2px',
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-hairline)',
            color: 'var(--accent)',
            fontFamily: MONO,
            fontSize: '10px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {i + 1}
          </span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}

function CodeBlock({ children }) {
  return (
    <pre style={{
      fontFamily: MONO,
      fontSize: '11px',
      lineHeight: 1.6,
      background: 'var(--bg-surface-2)',
      border: '1px solid var(--border-hairline)',
      color: 'var(--fg-1)',
      borderRadius: '2px',
      padding: '12px',
      margin: 0,
      overflowX: 'auto',
    }}>
      {children}
    </pre>
  );
}

/* ── page ── */

export default function IntegrationsPage() {
  const [mcpUrl,     setMcpUrl]     = useState('');
  const [toolsOpen,  setToolsOpen]  = useState(false);

  useEffect(() => {
    setMcpUrl(window.location.origin + '/api/v1/mcp');
  }, []);

  const {
    isLoading: healthLoading,
    isError:   healthError,
  } = useQuery({
    queryKey: ['mcp-health'],
    queryFn:  getMcpHealth,
    refetchInterval: 60000,
  });

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['mcp-activity'],
    queryFn:  () => getMcpActivity({ limit: 20 }),
    refetchInterval: 60000,
  });

  const activities = Array.isArray(activityData)
    ? activityData
    : activityData?.activity ?? activityData?.data ?? [];

  /* ── render ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* page header */}
      <div>
        <h1 style={{
          fontFamily: SANS,
          fontSize: '20px',
          fontWeight: 600,
          color: 'var(--fg-1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          margin: 0,
          letterSpacing: '-0.01em',
        }}>
          <Plug size={16} style={{ color: 'var(--accent)' }} />
          MCP Integration
        </h1>
        <p style={{
          fontFamily: SANS,
          fontSize: '13px',
          color: 'var(--fg-3)',
          marginTop: '6px',
          marginBottom: 0,
        }}>
          Connect AI agents to your Sentinel data using the Model Context Protocol.
        </p>
      </div>

      {/* intro — connect your AI agent */}
      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionLabelStyle}>Connect your AI agent</span>
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontFamily: SANS, fontSize: '13px', color: 'var(--fg-2)', margin: 0 }}>
            Give any MCP-compatible AI agent direct access to Sentinel — incidents, investigations, briefings, and site data — without leaving your AI tool.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              ['1', 'Create an API key', 'Go to Settings → API Keys and create a key with the mcp scope.'],
              ['2', 'Add the MCP server URL', 'Paste the server URL shown below into your AI tool\'s MCP configuration.'],
              ['3', 'Authenticate', 'Pass your API key as a Bearer token in the Authorization header.'],
            ].map(([num, title, desc]) => (
              <div key={num} style={{
                display: 'flex', gap: '12px', alignItems: 'flex-start',
                padding: '10px 12px',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--border-hairline)',
                borderRadius: '2px',
              }}>
                <span style={{
                  flexShrink: 0,
                  fontFamily: MONO, fontSize: '10px',
                  fontWeight: 700, color: 'var(--accent)',
                  width: '16px', textAlign: 'center',
                }}>{num}</span>
                <div>
                  <div style={{
                    fontFamily: MONO, fontSize: '11px', fontWeight: 600,
                    color: 'var(--fg-1)', marginBottom: '3px',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>
                    {title}
                  </div>
                  <div style={{ fontFamily: SANS, fontSize: '13px', color: 'var(--fg-3)' }}>
                    {desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* section 1 — server status */}
      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <Plug size={12} style={{ color: 'var(--fg-3)' }} />
          <span style={sectionLabelStyle}>Server Status</span>
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* status indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {healthLoading ? (
              <>
                <span style={{
                  display: 'inline-block', width: '8px', height: '8px',
                  borderRadius: '50%', background: 'var(--fg-4)',
                }} />
                <span style={{ fontFamily: SANS, fontSize: '13px', color: 'var(--fg-3)' }}>Checking…</span>
              </>
            ) : healthError ? (
              <>
                <span style={{
                  display: 'inline-block', width: '8px', height: '8px',
                  borderRadius: '50%', background: 'var(--sev-serious)',
                }} />
                <span style={{
                  fontFamily: MONO, fontSize: '11px', fontWeight: 600,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--sev-serious)',
                }}>MCP server unreachable — contact support</span>
              </>
            ) : (
              <>
                <span style={{
                  display: 'inline-block', width: '8px', height: '8px',
                  borderRadius: '50%', background: 'var(--sev-harmless)',
                }} />
                <span style={{
                  fontFamily: MONO, fontSize: '11px', fontWeight: 600,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--sev-harmless)',
                }}>MCP server online</span>
              </>
            )}
          </div>

          {/* server URL */}
          <div>
            <label style={{
              display: 'block',
              fontFamily: MONO,
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--fg-3)',
              marginBottom: '6px',
            }}>
              MCP Server URL
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: '1px solid var(--border-default)',
              borderRadius: '2px',
              background: 'var(--bg-surface-2)',
              overflow: 'hidden',
            }}>
              <input
                readOnly
                value={mcpUrl}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontFamily: MONO,
                  fontSize: '12px',
                  background: 'transparent',
                  color: 'var(--fg-1)',
                  border: 'none',
                  outline: 'none',
                  minWidth: 0,
                }}
              />
              <div style={{ paddingRight: '8px', flexShrink: 0 }}>
                <CopyButton text={mcpUrl} />
              </div>
            </div>
          </div>

          {/* api key note */}
          <p style={{ fontFamily: SANS, fontSize: '12px', color: 'var(--fg-3)', margin: 0 }}>
            Authenticate with an API key that has the{' '}
            <code style={codeChipStyle}>mcp</code>{' '}
            scope.{' '}
            <Link href="/settings/api-keys" style={{
              fontFamily: MONO,
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              textDecoration: 'none',
            }}>
              Create an MCP key →
            </Link>
          </p>
        </div>
      </section>

      {/* section 2 — quick start */}
      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionLabelStyle}>Quick Start</span>
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

          <QuickStartPanel title="Claude.ai" defaultOpen>
            <StepList steps={[
              'Go to Claude.ai → Settings → Connectors',
              'Click "Add MCP server"',
              'Paste the server URL shown above',
              'Enter your API key when prompted',
              'Sentinel tools will appear in your conversations',
            ]} />
          </QuickStartPanel>

          <QuickStartPanel title="Cursor">
            <StepList steps={[
              'Open or create ~/.cursor/mcp.json',
              'Add this configuration:',
            ]} />
            <CodeBlock>{`{
  "mcpServers": {
    "sentinel": {
      "url": "YOUR_SERVER_URL",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`}</CodeBlock>
            <StepList steps={[
              'Restart Cursor',
              'Sentinel tools are available in Cursor Agent',
            ]} />
          </QuickStartPanel>

          <QuickStartPanel title="Custom agent">
            <StepList steps={['Install the MCP SDK:']} />
            <CodeBlock>npm install @modelcontextprotocol/sdk</CodeBlock>
            <StepList steps={['Connect to Sentinel:']} />
            <CodeBlock>{`import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const client = new Client({ name: 'my-agent', version: '1.0.0' })
await client.connect(new StreamableHTTPClientTransport(
  new URL('YOUR_SERVER_URL'),
  { headers: { Authorization: 'Bearer YOUR_API_KEY' } }
))
const tools = await client.listTools()`}</CodeBlock>
          </QuickStartPanel>

        </div>
      </section>

      {/* section 3 — available tools (collapsible) */}
      <section style={sectionStyle}>
        <button
          onClick={() => setToolsOpen((v) => !v)}
          style={{
            width: '100%',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            textAlign: 'left',
            background: 'var(--bg-surface-2)',
            border: 'none',
            borderBottom: toolsOpen ? '1px solid var(--border-hairline)' : 'none',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wrench size={12} style={{ color: 'var(--fg-3)' }} />
            <span style={sectionLabelStyle}>
              {toolsOpen ? 'Hide tools' : 'Show available tools'}
            </span>
          </div>
          {toolsOpen
            ? <ChevronUp size={14} style={{ color: 'var(--fg-3)' }} />
            : <ChevronDown size={14} style={{ color: 'var(--fg-3)' }} />}
        </button>
        {toolsOpen && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Tool</th>
                  <th style={thStyle}>Description</th>
                </tr>
              </thead>
              <tbody>
                {MCP_TOOLS.map((t, idx) => (
                  <tr key={t.tool}>
                    <td style={{ ...tdStyle, borderBottom: idx === MCP_TOOLS.length - 1 ? 'none' : tdStyle.borderBottom }}>
                      <code style={codeChipStyle}>
                        {t.tool}
                      </code>
                    </td>
                    <td style={{
                      ...tdStyle,
                      color: 'var(--fg-3)',
                      borderBottom: idx === MCP_TOOLS.length - 1 ? 'none' : tdStyle.borderBottom,
                    }}>{t.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* section 4 — recent activity */}
      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionLabelStyle}>Recent tool calls</span>
        </div>

        {activityLoading ? (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{
                height: '28px',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--border-hairline)',
                borderRadius: '2px',
                opacity: 0.6,
              }} />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
            <p style={{ fontFamily: SANS, fontSize: '13px', color: 'var(--fg-3)', margin: 0 }}>
              No activity yet. Connect an MCP client and make a tool call to see it here.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Tool</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a, i) => {
                  const ts = a.timestamp ?? a.createdAt ?? a.at;
                  const ok = a.status === 'success' || a.success === true;
                  const isLast = i === activities.length - 1;
                  const cellBase = { ...tdStyle, borderBottom: isLast ? 'none' : tdStyle.borderBottom };
                  return (
                    <tr key={a._id ?? i}>
                      <td style={{ ...cellBase, color: 'var(--fg-3)', whiteSpace: 'nowrap', fontFamily: MONO, fontSize: '11px' }}>
                        {ts ? formatDistanceToNow(new Date(ts), { addSuffix: true }) : '—'}
                      </td>
                      <td style={cellBase}>
                        <code style={codeChipStyle}>
                          {a.tool ?? a.toolName ?? '—'}
                        </code>
                      </td>
                      <td style={cellBase}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '2px 7px',
                          borderRadius: '2px',
                          fontFamily: MONO,
                          fontSize: '10px',
                          fontWeight: 600,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: ok ? 'var(--sev-harmless)' : 'var(--sev-serious)',
                          border: `1px solid ${ok ? 'var(--sev-harmless)' : 'var(--sev-serious)'}`,
                          background: 'transparent',
                        }}>
                          {ok
                            ? <CheckCircle2 size={11} />
                            : <XCircle size={11} />}
                          {ok ? 'Success' : 'Error'}
                        </span>
                      </td>
                      <td style={{ ...cellBase, color: 'var(--fg-3)', fontFamily: MONO, fontSize: '11px' }}>
                        {a.durationMs != null ? `${a.durationMs}ms` : (a.duration ?? '—')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  );
}
