'use client';

import { useState, useRef, useEffect } from 'react';
import { Trash2, Archive, Eye, EyeOff, CheckSquare, Square, X } from 'lucide-react';

interface BulkActionsBarProps {
  selectedIds: number[];
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkStatusChange: (status: string) => void;
  onBulkFeatured?: (featured: boolean) => void;
}

export function BulkActionsBar({
  selectedIds,
  totalCount,
  onSelectAll,
  onClearSelection,
  onBulkDelete,
  onBulkStatusChange,
  onBulkFeatured
}: BulkActionsBarProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showStatusMenu) return;
    const handler = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showStatusMenu]);

  if (selectedIds.length === 0) return null;

  const allSelected = selectedIds.length === totalCount && totalCount > 0;

  return (
    <>
      {/* Bulk Actions Sticky Bar */}
      <div className="sticky top-16 z-40 bg-gradient-to-r bg-secondary text-light shadow-lg border-b-4 border-secondary/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Left side - Selection info */}
            <div className="flex items-center gap-4">
              <button
                onClick={allSelected ? onClearSelection : onSelectAll}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                {allSelected ? <Square size={18} /> : <CheckSquare size={18} />}
                <span className="font-medium">
                  {allSelected ? 'Deselect All' : `Select All (${totalCount})`}
                </span>
              </button>
              
              <div className="text-white/90">
                <span className="font-bold text-xl">{selectedIds.length}</span>
                <span className="ml-2">listing{selectedIds.length !== 1 ? 's' : ''} selected</span>
              </div>
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-3">
              {/* Change Status */}
              <div className="relative" ref={statusMenuRef}>
                <button
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                >
                  <Eye size={18} />
                  Change Status
                </button>

                {showStatusMenu && (
                  <div className="absolute top-full right-0 mt-0 w-52 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
                    <button
                      onClick={() => { onBulkStatusChange('active'); setShowStatusMenu(false); }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 text-gray-900 flex items-center gap-2"
                    >
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      Set to Active
                    </button>
                    <button
                      onClick={() => { onBulkStatusChange('draft'); setShowStatusMenu(false); }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 text-gray-900 flex items-center gap-2"
                    >
                      <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                      Set to Draft
                    </button>
                    <button
                      onClick={() => { onBulkStatusChange('pending'); setShowStatusMenu(false); }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 text-gray-900 flex items-center gap-2"
                    >
                      <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                      Set to Pending
                    </button>
                    <button
                      onClick={() => { onBulkStatusChange('sold'); setShowStatusMenu(false); }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 text-gray-900 flex items-center gap-2"
                    >
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      Set to Sold
                    </button>
                    <button
                      onClick={() => { onBulkStatusChange('archived'); setShowStatusMenu(false); }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 text-gray-900 flex items-center gap-2"
                    >
                      <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                      Set to Archived
                    </button>
                  </div>
                )}
              </div>

              {/* Feature/Unfeature */}
              {onBulkFeatured && (
                <button
                  onClick={() => onBulkFeatured(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white hover:bg-yellow-600 rounded-lg transition-colors font-medium"
                >
                  ⭐ Feature
                </button>
              )}

              {/* Archive/Delete */}
              <button
                onClick={() => setShowConfirmDelete(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-medium"
              >
                <Trash2 size={18} />
                Archive
              </button>

              {/* Clear Selection */}
              <button
                onClick={onClearSelection}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                <X size={18} />
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Archive Listings?</h3>
            </div>

            <p className="text-gray-600 mb-6">
              Are you sure you want to archive <strong>{selectedIds.length}</strong> listing{selectedIds.length !== 1 ? 's' : ''}? 
              They will be moved to archived status but not permanently deleted.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onBulkDelete();
                  setShowConfirmDelete(false);
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Archive {selectedIds.length} Listing{selectedIds.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Checkbox component for individual listings
export function ListingCheckbox({ 
  id, 
  checked, 
  onChange 
}: { 
  id: number; 
  checked: boolean; 
  onChange: (id: number) => void;
}) {
  return (
    <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onChange(id)}
        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
      />
    </div>
  );
}

// Hook to manage bulk selection state
export function useBulkSelection(totalItems: number) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const toggleSelection = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    );
  };

  const selectAll = (ids: number[]) => {
    setSelectedIds(ids);
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const isSelected = (id: number) => selectedIds.includes(id);

  return {
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
    hasSelection: selectedIds.length > 0
  };
}