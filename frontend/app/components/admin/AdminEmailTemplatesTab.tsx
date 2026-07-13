'use client';

import { useState, useEffect } from 'react';
import { apiUrl } from '@/app/lib/apiRoot';
import { Mail } from 'lucide-react';

const TEMPLATE_LABELS: Record<string, string> = {
  admin_new_broker_signup: 'New Broker Signup (Admin Alert)',
  sales_rep_referral_signup: 'New Referral Signup (Sales Rep Alert)',
  welcome: 'Welcome Email',
  verification: 'Email Verification',
  password_reset: 'Password Reset',
  password_set: 'Set Your Password',
  two_factor_code: '2FA Verification Code',
  trial_expiring: 'Trial Expiring',
  promotional_offer: 'Promotional Offer',
  dealer_invitation: 'Broker Invitation',
  api_key: 'API Key Delivery',
  wordpress_site_created: 'WordPress Site Created',
};

function labelFor(templateName: string): string {
  const key = templateName.replace(/\.html$/, '');
  return TEMPLATE_LABELS[key] || key;
}

export default function AdminEmailTemplatesTab() {
  const [templates, setTemplates] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [html, setHtml] = useState<string>('');
  const [listLoading, setListLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      setListLoading(true);
      setError(null);
      try {
        const response = await fetch(apiUrl('/admin/email-preview'), {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        });
        if (response.ok) {
          const data = await response.json();
          const list: string[] = data.templates || [];
          setTemplates(list);
          if (list.length > 0) {
            setSelected(list[0]);
          }
        } else {
          setError(`Failed to load email templates (${response.status})`);
        }
      } catch (err) {
        setError(`Email templates endpoint error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setListLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (!selected) return;

    const fetchPreview = async () => {
      setPreviewLoading(true);
      setError(null);
      try {
        const response = await fetch(apiUrl(`/admin/email-preview/${selected}`), {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        });
        if (response.ok) {
          setHtml(await response.text());
        } else {
          setHtml('');
          setError(`Failed to load preview (${response.status})`);
        }
      } catch (err) {
        setHtml('');
        setError(`Preview error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setPreviewLoading(false);
      }
    };
    fetchPreview();
  }, [selected]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-bold text-gray-900">Email Templates</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Preview the rendered HTML of each transactional/notification email using sample data. Nothing here is sent.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {listLoading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : templates.length === 0 ? (
        <p className="text-sm text-gray-500">No email templates available to preview.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6">
          <nav className="space-y-1">
            {templates.map((tmpl) => (
              <button
                key={tmpl}
                onClick={() => setSelected(tmpl)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  selected === tmpl
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {labelFor(tmpl)}
              </button>
            ))}
          </nav>

          <div className="relative min-w-0 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
            {previewLoading && (
              <div className="absolute inset-0 flex justify-center items-center bg-white/60 z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            )}
            {selected && html ? (
              <iframe
                key={selected}
                srcDoc={html}
                title={labelFor(selected)}
                sandbox=""
                className="w-full h-[75vh] bg-white"
              />
            ) : (
              !previewLoading && <p className="text-sm text-gray-500 p-6">Select a template to preview it.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
