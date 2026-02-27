'use client';

import { useState } from 'react';
import { Upload, Download, FileText, CheckCircle, AlertCircle, X, Trash2 } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface ImportExportProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

export default function ImportExportListings({ onClose, onSuccess }: ImportExportProps) {
  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'bulk'>('export');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bulkAction, setBulkAction] = useState<'delete' | 'status'>('status');
  const [selectedStatus, setSelectedStatus] = useState('active');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [processing, setProcessing] = useState(false);

  // Export listings to CSV
  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/listings/export'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `listings-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        alert('Failed to export listings');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export listings');
    } finally {
      setExporting(false);
    }
  };

  // Download blank template
  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(apiUrl('/listings/template'));
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'listings-import-template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Template download error:', error);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setImportResult(null);
    }
  };

  // Import listings from CSV
  const handleImport = async () => {
    if (!selectedFile) {
      alert('Please select a file');
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(apiUrl('/listings/import'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setImportResult(result);
        if (onSuccess) onSuccess();
      } else {
        alert('Import failed: ' + (result.detail || 'Unknown error'));
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import listings');
    } finally {
      setImporting(false);
    }
  };

  // Bulk delete listings
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      alert('Please select listings first');
      return;
    }

    if (!confirm(`Delete ${selectedIds.length} listing(s)?`)) return;

    setProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/listings/bulk-delete'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          listing_ids: selectedIds,
          permanent: false
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Successfully archived ${result.deleted_count} listing(s)`);
        setSelectedIds([]);
        if (onSuccess) onSuccess();
      } else {
        alert('Failed to delete listings');
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
      alert('Failed to delete listings');
    } finally {
      setProcessing(false);
    }
  };

  // Bulk update status
  const handleBulkUpdateStatus = async () => {
    if (selectedIds.length === 0) {
      alert('Please select listings first');
      return;
    }

    setProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/listings/bulk-update-status'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          listing_ids: selectedIds,
          status: selectedStatus
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Successfully updated ${result.updated_count} listing(s) to ${selectedStatus}`);
        setSelectedIds([]);
        if (onSuccess) onSuccess();
      } else {
        alert('Failed to update listings');
      }
    } catch (error) {
      console.error('Bulk update error:', error);
      alert('Failed to update listings');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Manage Listings</h2>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === 'export'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Download className="inline mr-2" size={18} />
            Export
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === 'import'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Upload className="inline mr-2" size={18} />
            Import
          </button>
          <button
            onClick={() => setActiveTab('bulk')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === 'bulk'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Trash2 className="inline mr-2" size={18} />
            Bulk Actions
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Export Tab */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">📥 Export Your Listings</h3>
                <p className="text-sm text-blue-800">
                  Download all your listings as a CSV file. You can open this in Excel, Google Sheets, or any spreadsheet application.
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-white border-2 border-gray-200 rounded-lg p-6 text-center">
                  <FileText className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="text-gray-700 mb-4">
                    Export includes all your listing data: titles, specs, pricing, locations, and more.
                  </p>
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium flex items-center gap-2 mx-auto"
                  >
                    <Download size={20} />
                    {exporting ? 'Exporting...' : 'Export to CSV'}
                  </button>
                </div>

                <div className="text-sm text-gray-600">
                  <p className="font-medium mb-2">What's included:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>All listing details (title, make, model, year, price)</li>
                    <li>Specifications (length, beam, draft, engines)</li>
                    <li>Location information (city, state, country)</li>
                    <li>Status, views, and inquiry counts</li>
                    <li>Created and updated timestamps</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Import Tab */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Important Notes</h3>
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>• CSV file must match the template format</li>
                  <li>• Include 'id' column to update existing listings (leave blank for new)</li>
                  <li>• Required fields: title, make, model</li>
                  <li>• All listings will be created as drafts initially</li>
                </ul>
              </div>

              {/* Download Template */}
              <div className="text-center">
                <button
                  onClick={handleDownloadTemplate}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium flex items-center gap-2 mx-auto"
                >
                  <FileText size={18} />
                  Download Template CSV
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Start with our template to ensure correct formatting
                </p>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select CSV File
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <Upload className="mx-auto text-gray-400 mb-2" size={48} />
                    <p className="text-sm text-gray-600">
                      {selectedFile ? selectedFile.name : 'Click to select CSV file'}
                    </p>
                  </label>
                </div>
              </div>

              {/* Import Button */}
              {selectedFile && (
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium"
                >
                  {importing ? 'Importing...' : 'Import Listings'}
                </button>
              )}

              {/* Import Results */}
              {importResult && (
                <div className={`p-4 rounded-lg ${
                  importResult.errors.length > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'
                }`}>
                  <div className="flex items-start gap-2 mb-3">
                    {importResult.errors.length === 0 ? (
                      <CheckCircle className="text-green-600 flex-shrink-0" size={24} />
                    ) : (
                      <AlertCircle className="text-yellow-600 flex-shrink-0" size={24} />
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-2">Import Complete</h4>
                      <div className="text-sm space-y-1">
                        <p className="text-green-800">✅ Created: {importResult.created} listings</p>
                        <p className="text-blue-800">🔄 Updated: {importResult.updated} listings</p>
                        {importResult.errors.length > 0 && (
                          <p className="text-red-800">❌ Errors: {importResult.errors.length}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="mt-4 max-h-40 overflow-y-auto">
                      <p className="text-sm font-medium text-gray-900 mb-2">Errors:</p>
                      <ul className="text-xs text-red-800 space-y-1">
                        {importResult.errors.slice(0, 10).map((error: string, idx: number) => (
                          <li key={idx}>• {error}</li>
                        ))}
                        {importResult.errors.length > 10 && (
                          <li>... and {importResult.errors.length - 10} more errors</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Bulk Actions Tab */}
          {activeTab === 'bulk' && (
            <div className="space-y-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-900 mb-2">⚠️ Warning</h3>
                <p className="text-sm text-red-800">
                  Bulk actions affect multiple listings at once. Please use with caution.
                </p>
              </div>

              {/* Action Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Action
                </label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setBulkAction('status')}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                      bulkAction === 'status'
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium">Change Status</p>
                    <p className="text-xs text-gray-600">Update listing visibility</p>
                  </button>
                  <button
                    onClick={() => setBulkAction('delete')}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                      bulkAction === 'delete'
                        ? 'border-red-600 bg-red-50 text-red-900'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium">Archive Listings</p>
                    <p className="text-xs text-gray-600">Move to archived</p>
                  </button>
                </div>
              </div>

              {/* Status Selection (if bulk action is status) */}
              {bulkAction === 'status' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active (Published)</option>
                    <option value="draft">Draft (Hidden)</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              )}

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>How to use:</strong> Go to your listings page, select the listings you want to modify, then return here to apply the action.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                {bulkAction === 'status' ? (
                  <button
                    onClick={handleBulkUpdateStatus}
                    disabled={processing || selectedIds.length === 0}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
                  >
                    {processing ? 'Processing...' : `Update Status (${selectedIds.length} selected)`}
                  </button>
                ) : (
                  <button
                    onClick={handleBulkDelete}
                    disabled={processing || selectedIds.length === 0}
                    className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-medium"
                  >
                    {processing ? 'Processing...' : `Archive Listings (${selectedIds.length} selected)`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-6 bg-gray-50">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <p>💡 Tip: Always backup your data before bulk operations</p>
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}