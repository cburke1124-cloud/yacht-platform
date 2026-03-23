import { useState } from 'react';
import { Upload, Download, FileText, CheckCircle, AlertCircle, X, Info, Trash2, Eye } from 'lucide-react';
import { API_ROOT } from '@/app/lib/apiRoot';

interface BulkToolsProps {
  mode?: 'standalone' | 'modal';
  onClose?: () => void;
  onSuccess?: () => void;
  userRole?: 'admin' | 'dealer';
}

export default function BulkImportExportTools({ 
  mode = 'standalone', 
  onClose, 
  onSuccess,
  userRole = 'dealer'
}: BulkToolsProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'bulk'>('export');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bulkAction, setBulkAction] = useState<'delete' | 'status'>('status');
  const [selectedStatus, setSelectedStatus] = useState('active');

  // CSV Template with all fields
  const csvTemplate = `id,title,make,model,year,price,currency,length_feet,beam_feet,draft_feet,hull_material,fuel_type,engine_make,engine_model,engine_hours,cruising_speed,max_speed,fuel_capacity,water_capacity,cabins,berths,heads,city,state,country,status,description
,2018 Sunseeker Manhattan 52,Sunseeker,Manhattan,2018,895000,USD,52,14.5,4.2,Fiberglass,Diesel,MAN,V8-1000,450,22,28,500,150,3,6,2,Miami,Florida,USA,active,"Luxurious flybridge motor yacht with spacious accommodations"
,2020 Azimut Grande 32M,Azimut,Grande,2020,8500000,USD,105,24,6.5,Fiberglass,Diesel,MTU,16V 2000 M96,200,16,24,12000,2000,5,10,5,Fort Lauderdale,Florida,USA,active,"Stunning superyacht with elegant Italian design"
,2015 Sea Ray Sundancer 510,Sea Ray,Sundancer,2015,625000,USD,51,15,3.8,Fiberglass,Diesel,Cummins,QSM11,800,24,32,400,100,3,6,2,Newport,Rhode Island,USA,active,"Sport cruiser with modern amenities and performance"`;

  const handleDownloadTemplate = () => {
    const blob = new Blob([csvTemplate], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'yacht-listings-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const endpoint = `${API_ROOT}/listings/export`;
        
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `yacht-listings-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        alert('Export successful!');
      } else {
        alert('Export failed');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setImportResult(null);
    }
  };

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

      const endpoint = `${API_ROOT}/listings/import`;

      const response = await fetch(endpoint, {
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

  const content = (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('export')}
          className={`flex-1 px-6 py-4 font-medium transition-colors ${
            activeTab === 'export'
              ? 'text-primary border-b-2 border-primary bg-primary/10'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Download className="inline mr-2" size={20} />
          Export
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`flex-1 px-6 py-4 font-medium transition-colors ${
            activeTab === 'import'
              ? 'text-primary border-b-2 border-primary bg-primary/10'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Upload className="inline mr-2" size={20} />
          Import
        </button>
        {userRole === 'admin' && (
          <button
            onClick={() => setActiveTab('bulk')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === 'bulk'
                ? 'text-primary border-b-2 border-primary bg-primary/10'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Trash2 className="inline mr-2" size={20} />
            Bulk Actions
          </button>
        )}
      </div>

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="p-6 space-y-6">
          <div className="bg-primary/10 border-l-4 border-primary p-4">
            <div className="flex">
              <Info className="text-primary flex-shrink-0 mr-3" size={24} />
              <div>
                <h3 className="font-semibold text-secondary mb-1">Export Your Listings</h3>
                <p className="text-sm text-primary">
                  Download {userRole === 'admin' ? 'all' : 'your'} listings as a CSV file for backup or editing.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-gray-200 rounded-lg p-8 text-center">
            <FileText className="mx-auto text-gray-400 mb-4" size={64} />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Export to CSV</h3>
            <p className="text-gray-600 mb-6">
              Export includes all listing data: titles, specs, pricing, locations, and descriptions.
            </p>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-8 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-gray-400 font-medium flex items-center gap-2 mx-auto"
            >
              <Download size={20} />
              {exporting ? 'Exporting...' : 'Export All Listings'}
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h4 className="font-semibold text-gray-900 mb-3">What's Included:</h4>
            <div className="grid md:grid-cols-2 gap-3 text-sm text-gray-700">
              {[
                'Basic info (title, make, model, year)',
                'Pricing and currency',
                'Dimensions (length, beam, draft)',
                'Engine specifications',
                'Performance data',
                'Capacities (fuel, water)',
                'Accommodations (cabins, berths)',
                'Location information',
                'Status and descriptions',
                'Timestamps'
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="p-6 space-y-6">
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
            <div className="flex">
              <AlertCircle className="text-yellow-600 flex-shrink-0 mr-3" size={24} />
              <div>
                <h3 className="font-semibold text-yellow-900 mb-2">Important Notes</h3>
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>• CSV file must match the template format exactly</li>
                  <li>• Include 'id' column to update existing listings (leave blank for new)</li>
                  <li>• Required fields: title, make, model, year</li>
                  <li>• All new listings will be created as drafts</li>
                  <li>• Maximum file size: 10MB</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Download Template */}
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Step 1: Download Template</h3>
            <p className="text-gray-600 mb-4">Start with our template to ensure correct formatting</p>
            <button
              onClick={handleDownloadTemplate}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2 mx-auto"
            >
              <FileText size={20} />
              Download CSV Template
            </button>
          </div>

          {/* Template Preview */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h4 className="font-semibold text-gray-900 mb-3">Template Columns:</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              {[
                'id', 'title*', 'make*', 'model*', 'year*', 'price', 'currency',
                'length_feet', 'beam_feet', 'draft_feet', 'hull_material',
                'fuel_type', 'engine_make', 'engine_model', 'engine_hours',
                'cruising_speed', 'max_speed', 'fuel_capacity', 'water_capacity',
                'cabins', 'berths', 'heads', 'city', 'state', 'country',
                'status', 'description'
              ].map(col => (
                <div key={col} className="bg-white px-3 py-2 rounded border border-gray-200">
                  <code className="text-primary text-xs">{col}</code>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-4">
              <strong>Note:</strong> Fields marked with * are required.
            </p>
          </div>

          {/* File Upload */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Step 2: Upload Your CSV</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Upload className="mx-auto text-gray-400 mb-3" size={48} />
                <p className="text-gray-700 font-medium mb-1">
                  {selectedFile ? selectedFile.name : 'Click to select CSV file'}
                </p>
                <p className="text-sm text-gray-500">
                  {selectedFile 
                    ? `${(selectedFile.size / 1024).toFixed(2)} KB` 
                    : 'or drag and drop'}
                </p>
              </label>
            </div>
          </div>

          {/* Import Button */}
          {selectedFile && (
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Step 3: Import Listings</h3>
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-8 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-gray-400 font-medium flex items-center gap-2 mx-auto"
              >
                <Upload size={20} />
                {importing ? 'Importing...' : 'Import Listings'}
              </button>
            </div>
          )}

          {/* Import Results */}
          {importResult && (
            <div className={`rounded-lg p-6 ${
              importResult.errors && importResult.errors.length > 0 
                ? 'bg-yellow-50 border-2 border-yellow-200' 
                : 'bg-green-50 border-2 border-green-200'
            }`}>
              <div className="flex items-start gap-3 mb-4">
                {importResult.errors && importResult.errors.length === 0 ? (
                  <CheckCircle className="text-green-600 flex-shrink-0" size={32} />
                ) : (
                  <AlertCircle className="text-yellow-600 flex-shrink-0" size={32} />
                )}
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 text-lg mb-3">Import Complete</h4>
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-white rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-green-600">{importResult.created || 0}</p>
                      <p className="text-sm text-gray-600">Created</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-primary">{importResult.updated || 0}</p>
                      <p className="text-sm text-gray-600">Updated</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-red-600">
                        {importResult.errors ? importResult.errors.length : 0}
                      </p>
                      <p className="text-sm text-gray-600">Errors</p>
                    </div>
                  </div>
                </div>
              </div>

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="bg-white rounded-lg p-4">
                  <h5 className="font-semibold text-gray-900 mb-2">Errors:</h5>
                  <div className="max-h-60 overflow-y-auto">
                    <ul className="text-sm text-red-800 space-y-1">
                      {importResult.errors.slice(0, 20).map((error: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-red-600 flex-shrink-0">•</span>
                          <span>{error}</span>
                        </li>
                      ))}
                      {importResult.errors.length > 20 && (
                        <li className="text-gray-600 italic">
                          ... and {importResult.errors.length - 20} more errors
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => window.location.href = userRole === 'admin' ? '/admin' : '/dashboard'}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium"
                >
                  View Listings
                </button>
                <button
                  onClick={() => {
                    setImportResult(null);
                    setSelectedFile(null);
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Import Another File
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk Actions Tab (Admin Only) */}
      {activeTab === 'bulk' && userRole === 'admin' && (
        <div className="p-6 space-y-6">
          <div className="bg-red-50 border-l-4 border-red-500 p-4">
            <div className="flex">
              <AlertCircle className="text-red-600 flex-shrink-0 mr-3" size={24} />
              <div>
                <h3 className="font-semibold text-red-900 mb-1">Admin Bulk Actions</h3>
                <p className="text-sm text-red-800">
                  These actions affect multiple listings at once. Use with caution.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <p className="text-sm text-primary">
              <strong>How to use:</strong> Select listings from the main admin dashboard, then use the bulk action bar that appears at the bottom of the screen.
            </p>
          </div>

          <div className="text-center py-8">
            <Eye size={64} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Bulk Actions Available</h3>
            <p className="text-gray-600 mb-6">
              Select listings in the main view to enable bulk operations
            </p>
            <button
              onClick={() => window.location.href = '/admin'}
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium"
            >
              Go to Admin Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-primary/10 rounded-lg p-6 border-l-4 border-primary">
        <h3 className="font-bold text-secondary mb-3 flex items-center gap-2">
          <Info size={20} />
          Tips for Successful Import
        </h3>
        <ul className="space-y-2 text-sm text-primary">
          <li className="flex items-start gap-2">
            <span className="text-primary flex-shrink-0">✓</span>
            <span><strong>Test with small batches:</strong> Start with 2-3 listings to verify formatting</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary flex-shrink-0">✓</span>
            <span><strong>Keep formatting consistent:</strong> Match the template exactly</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary flex-shrink-0">✓</span>
            <span><strong>Backup first:</strong> Always export before importing</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary flex-shrink-0">✓</span>
            <span><strong>Leave id blank for new listings:</strong> Only include id for updates</span>
          </li>
        </ul>
      </div>
    </div>
  );

  if (mode === 'modal') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
        <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
            <h2 className="text-2xl font-bold text-gray-900">Bulk Import/Export Tools</h2>
            {onClose && (
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            )}
          </div>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bulk Import/Export Tools</h1>
          <p className="text-gray-600">Manage multiple listings at once using CSV files</p>
        </div>
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {content}
        </div>
      </div>
    </div>
  );
}