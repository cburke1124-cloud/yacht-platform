'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiUrl } from '@/app/lib/apiRoot';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type SubTab = 'logs' | 'health' | 'api-tester' | 'environment';
type LogLevel = 'ALL' | 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

interface LogRecord {
  timestamp: string;
  level: LogLevel;
  logger: string;
  module: string;
  funcName: string;
  lineno: number;
  message: string;
  exc_info?: string;
}

interface HealthResult {
  database?: { status: string; message?: string };
  table_counts?: { status: string; counts?: Record<string, number>; message?: string };
  storage?: { status: string; [key: string]: unknown };
  env_vars?: Record<string, string>;
  scheduler?: { status: string; jobs?: number; message?: string };
  email?: { status: string; provider?: string };
  generated_at?: string;
}

interface PingResult {
  endpoint: string;
  label: string;
  status: number | null;
  latencyMs: number | null;
  ok: boolean | null;
  error?: string;
}

// ─────────────────────────────────────────────
// Level colour helpers
// ─────────────────────────────────────────────
const LEVEL_STYLES: Record<string, string> = {
  DEBUG:    'color:#94a3b8',
  INFO:     'color:#60a5fa',
  WARNING:  'color:#fbbf24',
  ERROR:    'color:#f87171',
  CRITICAL: 'color:#f43f5e',
};
const LEVEL_BG: Record<string, string> = {
  DEBUG:    '#1e293b',
  INFO:     '#1e3a5f',
  WARNING:  '#422006',
  ERROR:    '#450a0a',
  CRITICAL: '#4c0519',
};

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { Authorization: `Bearer ${token ?? ''}`, 'Content-Type': 'application/json' };
}

// ─────────────────────────────────────────────
// Sub-tab: Logs
// ─────────────────────────────────────────────
function LogsTab() {
  const [records, setRecords] = useState<LogRecord[]>([]);
  const [level, setLevel] = useState<LogLevel>('ALL');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(500);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [totalInBuffer, setTotalInBuffer] = useState(0);
  const [clearMsg, setClearMsg] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ level, limit: String(limit) });
      if (search) params.set('search', search);
      const res = await fetch(apiUrl(`/admin/logs?${params}`), { headers: authHeaders() });
      const data = await res.json();
      setRecords(data.records ?? []);
      setTotalInBuffer(data.total_in_buffer ?? 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [level, search, limit]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 8000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchLogs]);

  const handleClear = async () => {
    await fetch(apiUrl('/admin/logs/clear'), { method: 'POST', headers: authHeaders() });
    setClearMsg('Buffer cleared');
    setRecords([]);
    setTimeout(() => setClearMsg(''), 3000);
  };

  const handleTestLog = async () => {
    await fetch(apiUrl('/admin/logs/test'), { method: 'POST', headers: authHeaders() });
    setTimeout(fetchLogs, 300);
  };

  const downloadLogs = () => {
    const text = records.map(r => `${r.timestamp} [${r.level}] ${r.logger} — ${r.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'yachtversal-logs.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  const LEVELS: LogLevel[] = ['ALL', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        {/* Level filter */}
        <div style={{ display: 'flex', gap: 6 }}>
          {LEVELS.map(l => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                background: level === l ? '#3b82f6' : '#1e293b',
                color: level === l ? '#fff' : '#94a3b8',
              }}
            >{l}</button>
          ))}
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search messages…"
          style={{
            padding: '6px 12px', borderRadius: 8, border: '1px solid #334155',
            background: '#0f172a', color: '#e2e8f0', fontSize: 13, width: 220,
          }}
        />

        {/* Limit */}
        <select
          value={limit}
          onChange={e => setLimit(Number(e.target.value))}
          style={{
            padding: '6px 10px', borderRadius: 8, border: '1px solid #334155',
            background: '#0f172a', color: '#e2e8f0', fontSize: 13,
          }}
        >
          {[100, 250, 500, 1000, 2000].map(n => (
            <option key={n} value={n}>Last {n}</option>
          ))}
        </select>

        <button onClick={fetchLogs} style={btnStyle('#1e40af', loading)}>
          {loading ? '…' : '⟳ Refresh'}
        </button>
        <button onClick={handleTestLog} style={btnStyle('#065f46')}>Write Test Logs</button>
        <button onClick={downloadLogs} style={btnStyle('#374151')}>⬇ Download</button>
        <button onClick={handleClear} style={btnStyle('#7f1d1d')}>🗑 Clear Buffer</button>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#94a3b8' }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={e => setAutoRefresh(e.target.checked)}
          />
          Auto-refresh (8s)
        </label>
      </div>

      {/* Stats bar */}
      <div style={{ fontSize: 12, color: '#64748b' }}>
        Showing <strong style={{ color: '#94a3b8' }}>{records.length}</strong> records
        · Buffer has <strong style={{ color: '#94a3b8' }}>{totalInBuffer}</strong> total
        {clearMsg && <span style={{ marginLeft: 12, color: '#34d399' }}>{clearMsg}</span>}
        {autoRefresh && <span style={{ marginLeft: 12, color: '#60a5fa' }}>● Live</span>}
      </div>

      {/* Log table */}
      <div style={{
        background: '#0a0f1a',
        borderRadius: 10,
        border: '1px solid #1e293b',
        overflow: 'hidden',
        fontFamily: 'monospace',
        fontSize: 12,
      }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '180px 80px 120px 1fr',
          gap: 8,
          padding: '8px 12px',
          background: '#111827',
          color: '#64748b',
          fontWeight: 600,
          fontSize: 11,
          borderBottom: '1px solid #1e293b',
        }}>
          <span>TIMESTAMP</span>
          <span>LEVEL</span>
          <span>MODULE</span>
          <span>MESSAGE</span>
        </div>

        {/* Rows */}
        <div style={{ maxHeight: 600, overflowY: 'auto' }}>
          {records.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#475569' }}>
              No log records in buffer matching filters
            </div>
          ) : (
            records.map((r, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '180px 80px 120px 1fr',
                  gap: 8,
                  padding: '5px 12px',
                  background: i % 2 === 0 ? LEVEL_BG[r.level] ?? '#0a0f1a' : 'transparent',
                  borderBottom: '1px solid #0f172a',
                  alignItems: 'start',
                }}
              >
                <span style={{ color: '#475569', whiteSpace: 'nowrap' }}>
                  {r.timestamp.replace('T', ' ').substring(0, 23)}
                </span>
                <span style={{ fontWeight: 700, ...(LEVEL_STYLES[r.level] ? { color: LEVEL_STYLES[r.level].replace('color:', '') } : {}) }}>
                  {r.level}
                </span>
                <span style={{ color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.module}
                </span>
                <div>
                  <span style={{ color: '#cbd5e1', wordBreak: 'break-all' }}>{r.message}</span>
                  {r.exc_info && (
                    <pre style={{ marginTop: 4, color: '#f87171', fontSize: 11, whiteSpace: 'pre-wrap' }}>
                      {r.exc_info}
                    </pre>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-tab: Health
// ─────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const ok = status === 'ok' || status === 'set';
  const warn = status === 'stopped' || status === 'missing_key';
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 700,
      background: ok ? '#14532d' : warn ? '#431407' : '#450a0a',
      color: ok ? '#4ade80' : warn ? '#fb923c' : '#f87171',
    }}>
      {ok ? '✓ ' : warn ? '⚠ ' : '✗ '}{status.toUpperCase()}
    </span>
  );
}

function HealthTab() {
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [info, setInfo] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const runCheck = async () => {
    setLoading(true);
    try {
      const [h, i] = await Promise.all([
        fetch(apiUrl('/admin/system/health'), { headers: authHeaders() }).then(r => r.json()),
        fetch(apiUrl('/admin/system/info'), { headers: authHeaders() }).then(r => r.json()),
      ]);
      setHealth(h);
      setInfo(i);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runCheck(); }, []);

  const card = (title: string, children: React.ReactNode) => (
    <div style={{
      background: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: 12,
      padding: 20,
      minWidth: 260,
    }}>
      <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 12, fontSize: 14 }}>{title}</div>
      {children}
    </div>
  );

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <span style={{ color: '#64748b', fontSize: 13 }}>{label}</span>
      <span style={{ color: '#cbd5e1', fontSize: 13 }}>{value}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={runCheck} style={btnStyle('#1e40af', loading)}>
          {loading ? 'Running…' : '▶ Run Full Check'}
        </button>
        {health?.generated_at && (
          <span style={{ color: '#475569', fontSize: 12 }}>
            Last checked: {health.generated_at.replace('T', ' ').substring(0, 19)} UTC
          </span>
        )}
      </div>

      {health && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {/* Database */}
          {card('Database', <>
            {row('Connection', <StatusBadge status={health.database?.status ?? 'unknown'} />)}
            {health.database?.message && (
              <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{health.database.message}</div>
            )}
            {health.table_counts?.status === 'ok' && health.table_counts.counts && (
              <>
                <div style={{ borderTop: '1px solid #1e293b', margin: '10px 0' }} />
                {Object.entries(health.table_counts.counts).map(([t, n]) =>
                  row(t, <strong style={{ color: '#60a5fa' }}>{n.toLocaleString()}</strong>)
                )}
              </>
            )}
          </>)}

          {/* Storage */}
          {card('Storage', <>
            {row('Status', <StatusBadge status={health.storage?.status as string ?? 'unknown'} />)}
            {Object.entries(health.storage ?? {}).filter(([k]) => k !== 'status').slice(0, 6).map(([k, v]) =>
              row(k, String(v))
            )}
          </>)}

          {/* Scheduler + Email */}
          {card('Services', <>
            {row('Scheduler', <StatusBadge status={health.scheduler?.status ?? 'unknown'} />)}
            {health.scheduler?.jobs !== undefined && row('Scheduled Jobs', health.scheduler.jobs)}
            <div style={{ borderTop: '1px solid #1e293b', margin: '10px 0' }} />
            {row('Email Provider', health.email?.provider ?? '—')}
            {row('Email Config', <StatusBadge status={health.email?.status ?? 'unknown'} />)}
          </>)}

          {/* Environment vars */}
          {health.env_vars && card('Environment Variables', <>
            {Object.entries(health.env_vars).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{k}</span>
                <StatusBadge status={v} />
              </div>
            ))}
          </>)}
        </div>
      )}

      {/* System info */}
      {info && card('Runtime Info', <>
        {row('Uptime', String(info.uptime_human))}
        {row('PID', String(info.pid))}
        {row('Log Buffer', `${info.log_buffer_entries} entries`)}
        {row('Log File', (info.log_file as any)?.exists
          ? `${Math.round(((info.log_file as any).size_bytes ?? 0) / 1024)} KB`
          : 'Not found'
        )}
        <div style={{ borderTop: '1px solid #1e293b', margin: '10px 0' }} />
        <div style={{ fontSize: 11, color: '#475569', wordBreak: 'break-all' }}>{String(info.python_version)}</div>
        <div style={{ fontSize: 11, color: '#475569' }}>{String(info.platform)}</div>
      </>)}
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-tab: API Tester
// ─────────────────────────────────────────────
const API_ENDPOINTS = [
  { label: 'Health Check', path: '/health', method: 'GET', auth: false },
  { label: 'System Health (admin)', path: '/admin/system/health', method: 'GET', auth: true },
  { label: 'System Info (admin)', path: '/admin/system/info', method: 'GET', auth: true },
  { label: 'Admin Stats', path: '/admin/stats', method: 'GET', auth: true },
  { label: 'Active Listings', path: '/listings?status=active&limit=1', method: 'GET', auth: false },
  { label: 'Auth Me', path: '/auth/me', method: 'GET', auth: true },
  { label: 'Storage Health', path: '/admin/storage/health', method: 'GET', auth: true },
  { label: 'Log Buffer', path: '/admin/logs?limit=1', method: 'GET', auth: true },
];

function ApiTesterTab() {
  const [results, setResults] = useState<Record<string, PingResult>>({});
  const [pinging, setPinging] = useState<Record<string, boolean>>({});

  const ping = async (ep: typeof API_ENDPOINTS[0]) => {
    setPinging(p => ({ ...p, [ep.path]: true }));
    const start = performance.now();
    let result: PingResult = { endpoint: ep.path, label: ep.label, status: null, latencyMs: null, ok: null };
    try {
      const res = await fetch(apiUrl(ep.path), {
        method: ep.method,
        headers: ep.auth ? authHeaders() : { 'Content-Type': 'application/json' },
      });
      result = {
        ...result,
        status: res.status,
        latencyMs: Math.round(performance.now() - start),
        ok: res.ok,
      };
    } catch (err: unknown) {
      result = {
        ...result,
        latencyMs: Math.round(performance.now() - start),
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    setResults(p => ({ ...p, [ep.path]: result }));
    setPinging(p => ({ ...p, [ep.path]: false }));
  };

  const pingAll = async () => {
    for (const ep of API_ENDPOINTS) await ping(ep);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <button onClick={pingAll} style={btnStyle('#1e40af')}>▶ Ping All Endpoints</button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {API_ENDPOINTS.map(ep => {
          const r = results[ep.path];
          return (
            <div key={ep.path} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 16px',
              background: '#0f172a',
              borderRadius: 8,
              border: '1px solid #1e293b',
            }}>
              <button
                onClick={() => ping(ep)}
                disabled={pinging[ep.path]}
                style={btnStyle('#1e3a5f', pinging[ep.path])}
              >
                {pinging[ep.path] ? '…' : 'Ping'}
              </button>
              <span style={{ color: '#94a3b8', fontSize: 13, width: 200 }}>{ep.label}</span>
              <code style={{ color: '#475569', fontSize: 12, flex: 1 }}>{ep.method} {ep.path}</code>
              {r && (
                <>
                  <span style={{
                    fontWeight: 700, fontSize: 13,
                    color: r.ok ? '#4ade80' : '#f87171',
                  }}>
                    {r.status ?? 'ERR'}
                  </span>
                  <span style={{ color: '#64748b', fontSize: 12 }}>
                    {r.latencyMs}ms
                  </span>
                  {r.error && (
                    <span style={{ color: '#f87171', fontSize: 11 }}>{r.error}</span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-tab: Environment
// ─────────────────────────────────────────────
const ENV_VARS_LIST = [
  { key: 'DATABASE_URL', description: 'PostgreSQL connection string', required: true },
  { key: 'SECRET_KEY', description: 'JWT signing secret', required: true },
  { key: 'SENDGRID_API_KEY', description: 'SendGrid email delivery', required: true },
  { key: 'ANTHROPIC_API_KEY', description: 'AI search (Claude)', required: false },
  { key: 'CLOUDFLARE_R2_BUCKET', description: 'R2 bucket name', required: true },
  { key: 'CLOUDFLARE_ACCOUNT_ID', description: 'Cloudflare account', required: true },
  { key: 'CLOUDFLARE_R2_ACCESS_KEY', description: 'R2 access key', required: true },
  { key: 'CLOUDFLARE_R2_SECRET_KEY', description: 'R2 secret key', required: true },
  { key: 'FRONTEND_URL', description: 'Frontend base URL (CORS)', required: true },
  { key: 'AUTO_CREATE_TABLES', description: 'Auto-migrate on startup', required: false },
];

function EnvironmentTab() {
  const [envStatus, setEnvStatus] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchEnv = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/admin/system/health'), { headers: authHeaders() });
      const data = await res.json();
      setEnvStatus(data.env_vars ?? {});
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEnv(); }, []);

  const allRequired = envStatus
    ? ENV_VARS_LIST.filter(e => e.required).every(e => envStatus[e.key] === 'set')
    : false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={fetchEnv} style={btnStyle('#1e40af', loading)}>
          {loading ? 'Checking…' : '⟳ Refresh'}
        </button>
        {envStatus && (
          <span style={{ fontSize: 13, color: allRequired ? '#4ade80' : '#f87171' }}>
            {allRequired ? '✓ All required variables are set' : '✗ Some required variables are missing'}
          </span>
        )}
      </div>

      {envStatus && (
        <div style={{
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 2fr 100px 80px',
            padding: '10px 16px',
            background: '#111827',
            color: '#64748b',
            fontSize: 11,
            fontWeight: 700,
            borderBottom: '1px solid #1e293b',
          }}>
            <span>VARIABLE</span>
            <span>DESCRIPTION</span>
            <span>REQUIRED</span>
            <span>STATUS</span>
          </div>

          {ENV_VARS_LIST.map((e, i) => {
            const status = envStatus[e.key] ?? 'unknown';
            const isSet = status === 'set';
            return (
              <div key={e.key} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 2fr 100px 80px',
                padding: '10px 16px',
                background: i % 2 === 0 ? '#0a0f1a' : '#0f172a',
                borderBottom: '1px solid #0f172a',
                alignItems: 'center',
              }}>
                <code style={{ color: '#60a5fa', fontSize: 12 }}>{e.key}</code>
                <span style={{ color: '#64748b', fontSize: 12 }}>{e.description}</span>
                <span style={{ fontSize: 12, color: e.required ? '#f87171' : '#64748b' }}>
                  {e.required ? 'Required' : 'Optional'}
                </span>
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: isSet ? '#4ade80' : '#f87171',
                }}>
                  {isSet ? '✓ Set' : '✗ Missing'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Shared button style helper
// ─────────────────────────────────────────────
function btnStyle(bg: string, disabled = false): React.CSSProperties {
  return {
    padding: '7px 16px',
    borderRadius: 8,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 13,
    fontWeight: 600,
    background: disabled ? '#1e293b' : bg,
    color: disabled ? '#475569' : '#e2e8f0',
    opacity: disabled ? 0.6 : 1,
    transition: 'opacity .15s',
    whiteSpace: 'nowrap',
  };
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
const SUB_TABS: { id: SubTab; label: string; icon: string }[] = [
  { id: 'logs',        label: 'Error Logs',   icon: '📋' },
  { id: 'health',      label: 'System Health', icon: '🩺' },
  { id: 'api-tester',  label: 'API Tester',    icon: '🔌' },
  { id: 'environment', label: 'Environment',   icon: '🔑' },
];

export default function AdminSystemTab() {
  const [active, setActive] = useState<SubTab>('logs');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h2 style={{ margin: 0, color: '#e2e8f0', fontSize: 22, fontWeight: 700 }}>
          🛠️ System & Diagnostics
        </h2>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
          Live error logs, health checks, API tester and environment diagnostics.
        </p>
      </div>

      {/* Sub-tab nav */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #1e293b', paddingBottom: 0 }}>
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            style={{
              padding: '8px 20px',
              borderRadius: '8px 8px 0 0',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              background: active === t.id ? '#1e40af' : 'transparent',
              color: active === t.id ? '#fff' : '#64748b',
              borderBottom: active === t.id ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {active === 'logs'        && <LogsTab />}
        {active === 'health'      && <HealthTab />}
        {active === 'api-tester'  && <ApiTesterTab />}
        {active === 'environment' && <EnvironmentTab />}
      </div>
    </div>
  );
}
