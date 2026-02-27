export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-soft py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-card p-8 mb-6">
          <h1 className="text-3xl font-bold text-secondary mb-2">YachtVersal API Documentation</h1>
          <p className="text-gray-600">Use your API key to access listings and related resources programmatically.</p>
        </div>

        <div className="glass-card p-8 mb-6">
          <h2 className="text-xl font-bold text-secondary mb-4">Authentication</h2>
          <p className="text-gray-700 mb-3">Include your API key as a Bearer token in the Authorization header.</p>
          <pre className="bg-secondary text-white rounded-lg p-4 overflow-x-auto text-sm">
{`Authorization: Bearer yvk_your_api_key_here`}
          </pre>
        </div>

        <div className="glass-card p-8 mb-6">
          <h2 className="text-xl font-bold text-secondary mb-4">Base URL</h2>
          <pre className="bg-soft rounded-lg p-4 border border-gray-200 overflow-x-auto text-sm text-secondary">
{`https://api.yachtversal.com/api`}
          </pre>
        </div>

        <div className="glass-card p-8 mb-6">
          <h2 className="text-xl font-bold text-secondary mb-4">Common Endpoints</h2>
          <div className="space-y-4 text-sm">
            <div className="border border-primary/10 rounded-lg p-4">
              <p className="font-semibold text-secondary">GET /listings</p>
              <p className="text-gray-600">Retrieve public active listings.</p>
            </div>
            <div className="border border-primary/10 rounded-lg p-4">
              <p className="font-semibold text-secondary">GET /listings/my-listings</p>
              <p className="text-gray-600">Retrieve your account listings.</p>
            </div>
            <div className="border border-primary/10 rounded-lg p-4">
              <p className="font-semibold text-secondary">POST /listings/import</p>
              <p className="text-gray-600">Import listings from CSV.</p>
            </div>
            <div className="border border-primary/10 rounded-lg p-4">
              <p className="font-semibold text-secondary">GET /listings/export</p>
              <p className="text-gray-600">Export your listings to CSV.</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-8">
          <h2 className="text-xl font-bold text-secondary mb-4">Quick Example</h2>
          <pre className="bg-secondary text-white rounded-lg p-4 overflow-x-auto text-sm">
{`curl https://api.yachtversal.com/api/listings \\
  -H "Authorization: Bearer yvk_your_api_key_here"`}
          </pre>
        </div>
      </div>
    </div>
  );
}
