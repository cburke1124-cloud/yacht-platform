'use client';

import { useState, useEffect } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/app/lib/apiRoot';

// ─── Statics ───────────────────────────────────────────────────────────────
const POWER_CLASSES = [
  'Motor Yacht', 'Mega Yacht', 'Trawler', 'Express Cruiser',
  'Sport Fisher', 'Center Console',
];
const SAIL_CLASSES = ['Sailing Yacht', 'Catamaran', 'Sloop', 'Ketch', 'Schooner'];
const ALL_CLASSES  = [...POWER_CLASSES, ...SAIL_CLASSES];

const PRICE_OPTIONS = [
  { label: 'Any Price',        min: '',        max: '' },
  { label: 'Under $50K',       min: '',        max: '50000' },
  { label: '$50K – $100K',     min: '50000',   max: '100000' },
  { label: '$100K – $250K',    min: '100000',  max: '250000' },
  { label: '$250K – $500K',    min: '250000',  max: '500000' },
  { label: '$500K – $1M',      min: '500000',  max: '1000000' },
  { label: '$1M – $5M',        min: '1000000', max: '5000000' },
  { label: '$5M+',             min: '5000000', max: '' },
];

// Shared compact select style
const SEL = [
  'h-10 px-3 text-sm rounded-lg border border-gray-200 bg-white',
  'text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/40',
  'cursor-pointer shrink-0',
].join(' ');

interface SearchBarProps {
  onSearch?: (filters: any) => void;
  showAIOption?: boolean; // kept for backwards compat, no longer used
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const router = useRouter();

  const [condition,  setCondition]  = useState('');
  const [propulsion, setPropulsion] = useState('');   // 'power' | 'sail' | ''
  const [boatType,   setBoatType]   = useState('');
  const [make,       setMake]       = useState('');
  const [priceKey,   setPriceKey]   = useState('Any Price');
  const [makes,      setMakes]      = useState<string[]>([]);

  // Fetch distinct makes from backend
  useEffect(() => {
    fetch(apiUrl('/listings/makes'))
      .then((r) => r.ok ? r.json() : [])
      .then((data: string[]) => setMakes(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // When propulsion changes, reset class if it no longer fits
  useEffect(() => {
    if (propulsion === 'power' && SAIL_CLASSES.includes(boatType)) setBoatType('');
    if (propulsion === 'sail'  && POWER_CLASSES.includes(boatType)) setBoatType('');
  }, [propulsion]); // eslint-disable-line react-hooks/exhaustive-deps

  const classOptions =
    propulsion === 'power' ? POWER_CLASSES :
    propulsion === 'sail'  ? SAIL_CLASSES  :
    ALL_CLASSES;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const price = PRICE_OPTIONS.find((p) => p.label === priceKey) ?? PRICE_OPTIONS[0];
    const params = new URLSearchParams();

    if (condition)       params.set('condition',  condition);
    if (propulsion && !boatType) params.set('propulsion', propulsion);
    if (boatType)        params.set('boat_type',  boatType);
    if (make)            params.set('make',       make);
    if (price.min)       params.set('min_price',  price.min);
    if (price.max)       params.set('max_price',  price.max);

    const qs = params.toString();

    if (onSearch) {
      onSearch(Object.fromEntries(params));
    } else {
      router.push(`/listings${qs ? `?${qs}` : ''}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className="w-full">
      <div
        className="flex items-center gap-2 flex-wrap sm:flex-nowrap bg-white rounded-xl shadow-md border border-gray-200 px-3 py-2"
        style={{ minHeight: 56 }}
      >
        {/* ── Condition ── */}
        <select value={condition} onChange={(e) => setCondition(e.target.value)} className={SEL} style={{ minWidth: 100 }}>
          <option value="">Condition</option>
          <option value="new">New</option>
          <option value="used">Used</option>
        </select>

        <span className="hidden sm:block text-gray-200 select-none">|</span>

        {/* ── Power / Sail ── */}
        <select value={propulsion} onChange={(e) => setPropulsion(e.target.value)} className={SEL} style={{ minWidth: 108 }}>
          <option value="">Power / Sail</option>
          <option value="power">Power</option>
          <option value="sail">Sail</option>
        </select>

        <span className="hidden sm:block text-gray-200 select-none">|</span>

        {/* ── Class ── */}
        <select value={boatType} onChange={(e) => setBoatType(e.target.value)} className={SEL} style={{ minWidth: 130 }}>
          <option value="">Class</option>
          {classOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <span className="hidden sm:block text-gray-200 select-none">|</span>

        {/* ── Manufacturer ── */}
        <select value={make} onChange={(e) => setMake(e.target.value)} className={SEL} style={{ minWidth: 140 }}>
          <option value="">Manufacturer</option>
          {makes.length === 0
            ? <option disabled>Loading…</option>
            : makes.map((m) => <option key={m} value={m}>{m}</option>)
          }
        </select>

        <span className="hidden sm:block text-gray-200 select-none">|</span>

        {/* ── Price ── */}
        <select value={priceKey} onChange={(e) => setPriceKey(e.target.value)} className={SEL} style={{ minWidth: 130 }}>
          {PRICE_OPTIONS.map((p) => (
            <option key={p.label} value={p.label}>{p.label}</option>
          ))}
        </select>

        {/* ── Search button ── */}
        <button
          type="submit"
          className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-semibold flex items-center gap-1.5 hover:opacity-90 transition shrink-0 ml-auto"
        >
          <Search size={15} />
          Search
        </button>

        {/* ── Advanced Search ── */}
        <button
          type="button"
          onClick={() => router.push('/listings')}
          className="h-10 px-3 rounded-lg text-xs font-medium text-gray-500 hover:text-primary hover:bg-gray-50 flex items-center gap-1 transition shrink-0 whitespace-nowrap border border-gray-200"
        >
          <SlidersHorizontal size={13} />
          Advanced Search
        </button>
      </div>
    </form>
  );
}
