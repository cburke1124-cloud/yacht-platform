"use client";

import BulkImportExportTools from "@/app/components/BulkImportExportTools";

export default function BulkToolsPage() {
  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-dark mb-2">Bulk Import & Export Tools</h1>
          <p className="text-dark/70">
            Manage your listings in bulk with our powerful import and export tools
          </p>
        </div>

        {/* Component */}
        <BulkImportExportTools 
          mode="standalone"
          userRole="dealer"
        />
      </div>
    </div>
  );
}