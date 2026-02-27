'use client';

export interface AccountPreferences {
  marketing_opt_in: boolean;
  communication_email: boolean;
  communication_sms: boolean;
  communication_push: boolean;
}

interface CommunicationPreferencesCardProps {
  preferences: AccountPreferences;
  saving: boolean;
  onSave: () => void;
  onToggle: (field: keyof AccountPreferences, value: boolean) => void;
  variant?: 'brand' | 'blue';
}

export default function CommunicationPreferencesCard({
  preferences,
  saving,
  onSave,
  onToggle,
  variant = 'brand',
}: CommunicationPreferencesCardProps) {
  const isBrand = variant === 'brand';

  return (
    <div className={`bg-white rounded-xl shadow-md p-6 mb-8 border ${isBrand ? 'border-primary/20' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className={`text-xl font-semibold ${isBrand ? 'text-dark' : 'text-gray-900'}`}>Communication Preferences</h2>
          <p className={`text-sm ${isBrand ? 'text-dark/60' : 'text-gray-600'}`}>Manage account notifications and marketing messages.</p>
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className={`px-4 py-2 rounded-lg disabled:opacity-60 ${isBrand ? 'bg-primary text-light hover-primary' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>

      <div className="space-y-3">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={preferences.communication_email}
            onChange={(e) => onToggle('communication_email', e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300"
          />
          <span className={`text-sm ${isBrand ? 'text-dark' : 'text-gray-800'}`}>Receive account emails and listing activity updates.</span>
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={preferences.communication_sms}
            onChange={(e) => onToggle('communication_sms', e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300"
          />
          <span className={`text-sm ${isBrand ? 'text-dark' : 'text-gray-800'}`}>Receive SMS/text notifications (data rates may apply).</span>
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={preferences.communication_push}
            onChange={(e) => onToggle('communication_push', e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300"
          />
          <span className={`text-sm ${isBrand ? 'text-dark' : 'text-gray-800'}`}>Enable push notifications (web and future mobile app).</span>
        </label>

        <label className="flex items-start gap-3 pt-2 border-t border-gray-100">
          <input
            type="checkbox"
            checked={preferences.marketing_opt_in}
            onChange={(e) => onToggle('marketing_opt_in', e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300"
          />
          <span className={`text-sm ${isBrand ? 'text-dark' : 'text-gray-800'}`}>Receive marketing emails about new features, offers, and updates. (Optional)</span>
        </label>
      </div>
    </div>
  );
}