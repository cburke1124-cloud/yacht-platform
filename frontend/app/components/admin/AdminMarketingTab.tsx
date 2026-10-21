'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '@/app/lib/apiRoot';
import { RefreshCw, Send, Check, X, ExternalLink } from 'lucide-react';

interface ClientInfo {
  id: number;
  name: string;
  connector: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_topics_at: string | null;
  last_topics_status: string | null;
}

interface Overview {
  clients: ClientInfo[];
  drafts: Record<string, number>;
  site_posts: { held: number; failed: number; draft_on_site: number; published: number };
  connected_platforms: string[];
  scheduler_minutes: number;
}

interface Draft {
  id: number;
  platform: string;
  content_type: string;
  body: string;
  status: string;
  image_url: string | null;
  source_url: string | null;
  warning: string | null;
  created_at: string | null;
  published_at: string | null;
  external_url: string | null;
  publish_error: string | null;
}

interface SitePost {
  id: number;
  kind: string;
  title: string;
  status: string;
  warning: string | null;
  error: string | null;
  site_post_id: number | null;
  site_status: string | null;
  site_url: string | null;
}

type DraftFilter = 'pending' | 'approved' | 'published' | 'rejected';

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function fmt(date: string | null): string {
  if (!date) return '';
  // The agent reports naive UTC timestamps.
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(date) ? date : `${date}Z`).toLocaleString();
}

const label = (s: string) => s.replace(/_/g, ' ');

async function api(path: string, method = 'GET') {
  const res = await fetch(apiUrl(`/admin/marketing${path}`), { method, headers: authHeaders() });
  let body: any = null;
  try { body = await res.json(); } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const detail = typeof body?.detail === 'string' ? body.detail : body?.error?.message;
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return body;
}

export default function AdminMarketingTab() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [setupDetail, setSetupDetail] = useState('');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [posts, setPosts] = useState<SitePost[]>([]);
  const [filter, setFilter] = useState<DraftFilter>('pending');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadAll = useCallback(async (draftFilter: DraftFilter) => {
    setError(null);
    try {
      const status = await api('/status');
      setConfigured(status.configured);
      setSetupDetail(status.detail || '');
      if (!status.configured) return;
      const [o, d, p] = await Promise.all([
        api('/overview'),
        api(`/drafts?status=${draftFilter}`),
        api('/site-posts'),
      ]);
      setOverview(o);
      setDrafts(d.drafts);
      setPosts(p.site_posts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => { loadAll(filter); }, [filter, loadAll]);

  const act = async (key: string, path: string, success?: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await api(path, 'POST');
      if (success) setNotice(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(null);
      loadAll(filter);
    }
  };

  const publishArticle = (p: SitePost) => {
    if (!p.site_post_id) return;
    if (!window.confirm(`Publish "${p.title}" on the live blog? Review it in the Blog tab first if you haven't.`)) return;
    act(`blog-${p.id}`, `/blog/${p.site_post_id}/publish`, `"${p.title}" is now live.`);
  };

  const postToPlatform = (d: Draft) => {
    if (!window.confirm(`Post this to ${d.platform} now? This goes live immediately.`)) return;
    act(`draft-${d.id}`, `/drafts/${d.id}/publish`, `Posted to ${d.platform}.`);
  };

  if (configured === null && !error) return <p className="text-sm text-gray-500">Loading…</p>;

  if (configured === false) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-gray-900">Marketing</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>The marketing agent isn&apos;t connected yet.</strong> {setupDetail}
          <p className="mt-2">
            Set <code>MARKETING_AGENT_URL</code> and <code>MARKETING_AGENT_API_KEY</code> on the backend (the key must match
            the agent&apos;s), then reload. See <code>DEPLOYMENT.md</code>, &ldquo;Marketing agent&rdquo;.
          </p>
        </div>
      </div>
    );
  }

  const articles = posts.filter((p) => p.status === 'held' || p.status === 'failed' || p.status === 'pushed');
  const needsAttention = articles.filter((p) => p.status === 'held' || p.status === 'failed');
  const onSite = articles.filter((p) => p.status === 'pushed');
  const btn = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50';
  const primary = `${btn} bg-primary text-white`;
  const secondary = `${btn} border border-gray-300 text-gray-700 hover:bg-gray-50`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Marketing</h2>
          <p className="text-sm text-gray-600">
            Social posts and blog articles written by the marketing agent. Nothing goes live until you approve it.
          </p>
        </div>
        <button onClick={() => loadAll(filter)} className={secondary}><RefreshCw size={14} /> Refresh</button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {notice && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</div>}

      {overview && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Social posts to review" value={overview.drafts.pending ?? 0} />
            <Stat label="Approved, not posted" value={overview.drafts.approved ?? 0} />
            <Stat label="Articles needing you" value={overview.site_posts.held + overview.site_posts.failed} />
            <Stat label="Article drafts on site" value={overview.site_posts.draft_on_site} />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-3 text-sm text-gray-600">
              Platforms connected for one-click posting:{' '}
              {overview.connected_platforms.length ? (
                overview.connected_platforms.map((p) => <span key={p} className="mr-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold capitalize text-green-800">{p}</span>)
              ) : (
                <span className="text-gray-500">none (copy posts by hand, or add credentials on the agent)</span>
              )}
              {overview.scheduler_minutes > 0 && <span className="ml-2 text-gray-400">· auto-sync every {overview.scheduler_minutes} min</span>}
            </div>
            <ul className="divide-y divide-gray-100">
              {overview.clients.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    <p className="text-gray-600">
                      {c.last_sync_at ? `Synced ${fmt(c.last_sync_at)}. ` : ''}{c.last_sync_status || 'Never synced.'}
                    </p>
                    {c.last_topics_status && <p className="text-gray-500">Topics: {c.last_topics_status}</p>}
                  </div>
                  <div className="flex gap-2">
                    {c.connector && (
                      <button disabled={busy !== null} onClick={() => act(`sync-${c.id}`, `/clients/${c.id}/sync`, 'Sync started. Refresh in a minute to see new drafts.')} className={primary}>
                        <RefreshCw size={14} /> Sync now
                      </button>
                    )}
                    <button disabled={busy !== null} onClick={() => act(`topics-${c.id}`, `/clients/${c.id}/topics/run`, 'Topic run started. Refresh in a minute.')} className={secondary}>
                      Find article topics
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Articles */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">Blog articles</h3>
        {articles.length === 0 && <p className="text-sm text-gray-500">No articles yet.</p>}
        {needsAttention.map((p) => (
          <div key={p.id} className="rounded-xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-gray-900">{p.title} <span className="ml-1 text-xs font-normal text-gray-500">{label(p.kind)}</span></p>
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">{p.status === 'held' ? 'Held for review' : 'Send failed'}</span>
            </div>
            {p.warning && <p className="mt-2 text-sm text-amber-900">&#9888; {p.warning}</p>}
            {p.error && <p className="mt-2 text-sm text-red-800">{p.error}</p>}
            <p className="mt-2 text-xs text-gray-600">Not on the site yet. Sending creates a draft only; you still publish it.</p>
            <div className="mt-3 flex gap-2">
              <button disabled={busy !== null} onClick={() => act(`send-${p.id}`, `/site-posts/${p.id}/send`, 'Sent to the site as a draft.')} className={primary}><Send size={14} /> Send as draft</button>
              <button disabled={busy !== null} onClick={() => act(`discard-${p.id}`, `/site-posts/${p.id}/discard`)} className={secondary}>Discard</button>
            </div>
          </div>
        ))}
        {onSite.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white">
            <ul className="divide-y divide-gray-100">
              {onSite.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{p.title}</p>
                    <p className="text-xs text-gray-500">{label(p.kind)} · {p.site_status === 'published' ? 'Published' : 'Draft on site'}</p>
                  </div>
                  {p.site_status === 'published' ? (
                    p.site_url && <a href={p.site_url} target="_blank" rel="noopener noreferrer" className={secondary}><ExternalLink size={14} /> View</a>
                  ) : (
                    <div className="flex gap-2">
                      <a href="/admin?tab=blog" className={secondary}>Review in Blog tab</a>
                      <button disabled={busy !== null || !p.site_post_id} onClick={() => publishArticle(p)} className={primary}>Publish</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Social posts */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-gray-900">Social posts</h3>
          <div className="flex gap-1">
            {(['pending', 'approved', 'published', 'rejected'] as DraftFilter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${filter === f ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-50'}`}>
                {f === 'pending' ? 'to review' : f}
              </button>
            ))}
          </div>
        </div>
        {drafts.length === 0 && <p className="text-sm text-gray-500">Nothing here.</p>}
        {drafts.map((d) => {
          const connected = overview?.connected_platforms.includes(d.platform);
          return (
            <div key={d.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold capitalize text-gray-900">{d.platform} <span className="ml-1 text-xs font-normal normal-case text-gray-500">{label(d.content_type)}</span></p>
                <span className="text-xs text-gray-400">{fmt(d.created_at)}</span>
              </div>
              <div className="mt-2 flex gap-3">
                {d.image_url && <img src={d.image_url} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-lg object-cover" />}
                <p className="whitespace-pre-wrap text-sm text-gray-800">{d.body}</p>
              </div>
              {d.warning && <p className="mt-2 text-sm text-amber-800">&#9888; Check before approving: {d.warning}</p>}
              {d.publish_error && <p className="mt-2 text-sm text-red-800">Last attempt failed: {d.publish_error}</p>}
              {d.source_url && <p className="mt-1 text-xs text-gray-500">Source: <a className="underline" href={d.source_url} target="_blank" rel="noopener noreferrer">{d.source_url}</a></p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {d.status === 'pending' && (
                  <>
                    <button disabled={busy !== null} onClick={() => act(`draft-${d.id}`, `/drafts/${d.id}/approve`)} className={primary}><Check size={14} /> Approve</button>
                    <button disabled={busy !== null} onClick={() => act(`draft-${d.id}`, `/drafts/${d.id}/reject`)} className={secondary}><X size={14} /> Reject</button>
                  </>
                )}
                {d.status === 'approved' && (connected ? (
                  <button disabled={busy !== null} onClick={() => postToPlatform(d)} className={primary}><Send size={14} /> Post to {d.platform}</button>
                ) : (
                  <span className="text-xs text-gray-500">{d.platform} isn&apos;t connected. Copy this post and publish it by hand.</span>
                ))}
                {d.status === 'published' && (
                  <span className="text-xs text-gray-500">
                    Posted {fmt(d.published_at)}{' '}
                    {d.external_url && <a className="underline" href={d.external_url} target="_blank" rel="noopener noreferrer">View post</a>}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-600">{label}</p>
    </div>
  );
}
