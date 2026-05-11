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

const MCP_TOOLS = [
  { tool: 'get_latest_briefing',  desc: 'Returns the morning briefing' },
  { tool: 'list_incidents',       desc: 'List incidents with optional filters' },
  { tool: 'get_incident',         desc: 'Full detail for one incident' },
  { tool: 'list_events',          desc: 'Overnight events for a date' },
  { tool: 'get_investigation',    desc: 'Investigation results' },
  { tool: 'start_investigation',  desc: 'Start an AI investigation' },
  { tool: 'get_site_status',      desc: 'Current site overview' },
];

/* ── helpers ── */

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function QuickStartPanel({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-4 border-t border-gray-100 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

function StepList({ steps }) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 text-sm text-gray-700">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center">
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
    <pre className="text-xs bg-gray-900 text-green-300 rounded-md p-4 overflow-x-auto font-mono leading-relaxed">
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
    <div className="space-y-8">

      {/* page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <Plug className="w-5 h-5 text-indigo-500" />
          MCP Integration
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Connect AI agents to your Ridgeway data using the Model Context Protocol.
        </p>
      </div>

      {/* section 1 — server status */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <Plug className="w-4 h-4 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Server Status</h2>
        </div>
        <div className="px-6 py-6 space-y-5">

          {/* status indicator */}
          <div className="flex items-center gap-2.5">
            {healthLoading ? (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />
                <span className="text-sm text-gray-500">Checking…</span>
              </>
            ) : healthError ? (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                <span className="text-sm text-red-700 font-medium">MCP server unreachable — contact support</span>
              </>
            ) : (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm text-green-700 font-medium">MCP server online</span>
              </>
            )}
          </div>

          {/* server URL */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5">
              MCP Server URL
            </label>
            <div className="flex items-center gap-2 border border-gray-300 rounded-lg shadow-sm overflow-hidden">
              <input
                readOnly
                value={mcpUrl}
                className="flex-1 px-3 py-2 text-sm font-mono bg-gray-50 text-gray-700 focus:outline-none min-w-0"
              />
              <div className="pr-2 flex-shrink-0">
                <CopyButton text={mcpUrl} />
              </div>
            </div>
          </div>

          {/* api key note */}
          <p className="text-xs text-gray-500">
            Authenticate with an API key that has the{' '}
            <code className="font-mono bg-gray-100 px-1 py-0.5 rounded text-gray-700">mcp</code>{' '}
            scope.{' '}
            <Link href="/settings/api-keys" className="text-indigo-600 hover:underline font-medium">
              Create an MCP key →
            </Link>
          </p>
        </div>
      </section>

      {/* section 2 — quick start */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-base font-semibold text-gray-900">Quick Start</h2>
        </div>
        <div className="p-6 space-y-3">

          <QuickStartPanel title="Claude.ai" defaultOpen>
            <StepList steps={[
              'Go to Claude.ai → Settings → Connectors',
              'Click "Add MCP server"',
              'Paste the server URL shown above',
              'Enter your API key when prompted',
              'Ridgeway tools will appear in your conversations',
            ]} />
          </QuickStartPanel>

          <QuickStartPanel title="Cursor">
            <StepList steps={[
              'Open or create ~/.cursor/mcp.json',
              'Add this configuration:',
            ]} />
            <CodeBlock>{`{
  "mcpServers": {
    "ridgeway": {
      "url": "YOUR_SERVER_URL",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`}</CodeBlock>
            <StepList steps={[
              'Restart Cursor',
              'Ridgeway tools are available in Cursor Agent',
            ]} />
          </QuickStartPanel>

          <QuickStartPanel title="Custom agent">
            <StepList steps={['Install the MCP SDK:']} />
            <CodeBlock>npm install @modelcontextprotocol/sdk</CodeBlock>
            <StepList steps={['Connect to Ridgeway:']} />
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
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setToolsOpen((v) => !v)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">
              {toolsOpen ? 'Hide tools' : 'Show available tools'}
            </h2>
          </div>
          {toolsOpen
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {toolsOpen && (
          <div className="overflow-x-auto border-t border-gray-100">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 font-semibold">Tool</th>
                  <th className="px-6 py-3 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody>
                {MCP_TOOLS.map((t) => (
                  <tr key={t.tool} className="border-b border-gray-100 last:border-0">
                    <td className="px-6 py-3">
                      <code className="text-xs font-mono bg-gray-100 text-gray-800 px-2 py-1 rounded">
                        {t.tool}
                      </code>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{t.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* section 4 — recent activity */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-base font-semibold text-gray-900">Recent tool calls</h2>
        </div>

        {activityLoading ? (
          <div className="px-6 py-6 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-500">
              No activity yet. Connect an MCP client and make a tool call to see it here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 font-semibold">Time</th>
                  <th className="px-6 py-3 font-semibold">Tool</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Duration</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a, i) => {
                  const ts = a.timestamp ?? a.createdAt ?? a.at;
                  const ok = a.status === 'success' || a.success === true;
                  return (
                    <tr key={a._id ?? i} className="border-b border-gray-100 last:border-0">
                      <td className="px-6 py-3 text-gray-500 whitespace-nowrap">
                        {ts ? formatDistanceToNow(new Date(ts), { addSuffix: true }) : '—'}
                      </td>
                      <td className="px-6 py-3">
                        <code className="text-xs font-mono bg-gray-100 text-gray-800 px-2 py-1 rounded">
                          {a.tool ?? a.toolName ?? '—'}
                        </code>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {ok
                            ? <CheckCircle2 className="w-3 h-3" />
                            : <XCircle className="w-3 h-3" />}
                          {ok ? 'Success' : 'Error'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-500 font-mono text-xs">
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
