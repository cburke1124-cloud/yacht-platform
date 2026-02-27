import { useState, useEffect } from 'react';

export function APIKeysPage() {
  const [apiKeys, setApiKeys] = useState([]);
  
  useEffect(() => {
    fetch('/api/api-keys', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    .then(res => res.json())
    .then(data => setApiKeys(data));
  }, []);
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">API Keys</h1>
      
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <p className="text-sm text-yellow-700">
          ⚠️ Your API key was sent to your email when you registered. 
          For security, it cannot be displayed again. If you lost it, generate a new one.
        </p>
      </div>
      
      <div className="space-y-4">
        {apiKeys.map(key => (
          <div key={key.id} className="bg-white p-4 rounded-lg shadow">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{key.name}</h3>
                <p className="text-sm text-gray-600">
                  Prefix: <code className="bg-gray-100 px-2 py-1 rounded">{key.key_prefix}...</code>
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Created: {new Date(key.created_at).toLocaleDateString()}
                </p>
              </div>
              
              <div className="text-right">
                <span className={`px-2 py-1 rounded text-xs ${key.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {key.is_active ? 'Active' : 'Inactive'}
                </span>
                <p className="text-xs text-gray-500 mt-2">
                  Rate Limit: {key.rate_limit}/hour
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
