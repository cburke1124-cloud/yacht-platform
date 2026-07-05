'use client';

import { useEffect, useState } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface RevisionSummary {
  id: number;
  title: string;
  editor: string;
  created_at: string | null;
}

interface BlogRevisionsPanelProps {
  postId: number;
  onClose: () => void;
  onRestored: () => void;
}

export default function BlogRevisionsPanel({ postId, onClose, onRestored }: BlogRevisionsPanelProps) {
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  useEffect(() => {
    fetchRevisions();
  }, [postId]);

  const fetchRevisions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/admin/blog/posts/${postId}/revisions`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setRevisions(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch revisions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (revisionId: number) => {
    if (!confirm('Restore this version? The current content will be saved as a new revision first, so this can be undone.')) {
      return;
    }
    setRestoringId(revisionId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        apiUrl(`/admin/blog/posts/${postId}/revisions/${revisionId}/restore`),
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.ok) {
        onRestored();
      } else {
        alert('Failed to restore revision');
      }
    } catch (error) {
      console.error('Failed to restore revision:', error);
      alert('Failed to restore revision');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Revision History</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={22} />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : revisions.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              No past revisions yet — they appear here once you save an edit.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {revisions.map((rev) => (
                <li key={rev.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">{rev.title}</div>
                    <div className="text-xs text-gray-500">
                      {rev.editor} &middot;{' '}
                      {rev.created_at ? new Date(rev.created_at).toLocaleString() : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRestore(rev.id)}
                    disabled={restoringId === rev.id}
                    className="shrink-0 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RotateCcw size={14} />
                    {restoringId === rev.id ? 'Restoring...' : 'Restore'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
