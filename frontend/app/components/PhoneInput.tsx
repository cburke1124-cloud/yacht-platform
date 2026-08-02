'use client';

import PhoneInputWithCountry, { isValidPhoneNumber, type Value } from 'react-phone-number-input/min';
import 'react-phone-number-input/style.css';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
  label?: string;
  placeholder?: string;
  defaultCountry?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Shared phone input: country-flag picker + live formatting, backed by
 * libphonenumber-js. Emits a plain E.164 string via onChange (never an
 * event), matching this codebase's existing `(value) => setX({...x, phone:
 * value})` form-state pattern so call sites need no state-shape changes.
 */
export default function PhoneInput({
  value,
  onChange,
  id,
  required = false,
  label,
  placeholder = 'Phone number',
  defaultCountry = 'US',
  className = '',
  disabled = false,
}: PhoneInputProps) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-dark mb-1.5">
          {label}
        </label>
      )}
      <PhoneInputWithCountry
        id={id}
        international
        defaultCountry={defaultCountry as any}
        placeholder={placeholder}
        value={value}
        onChange={(next?: Value) => onChange(next || '')}
        disabled={disabled}
        required={required}
        className="yv-phone-input"
        numberInputProps={{
          className: 'w-full px-4 py-3 border-0 focus:outline-none focus:ring-0 bg-transparent',
        }}
      />
    </div>
  );
}

export { isValidPhoneNumber };
