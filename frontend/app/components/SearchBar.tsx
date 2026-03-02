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

// Shared compact select style
const SEL = [
  'h-10 px-3 text-sm rounded-lg border border-gray-200 bg-white',
  'text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/40',
  'cursor-pointer shrink-0',
].join(' ');

// ─── Price helpers ─────────────────────────────────────────────────────────
function fmtPrice(v: number): string {
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `$${m % 1 === 0 ? m : m.toFixed(1)}M`;
  }
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v.toLocaleString()}`;
}

// ─── Dual range slider ─────────────────────────────────────────────────────
interface SliderProps {
  min: number;
  max: number;
  low: number;
  high: number;
  onLow: (v: number) => void;
  onHigh: (v: number) => void;
}

function PriceRangeSlider({ min, max, low, high, onLow, onHigh }: SliderProps) {
  const range = max - min || 1;
  const pct   = (v: number) => ((v - min) / range) * 100;

  const handleLow = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    if (v < high) onLow(v);
  };
  const handleHigh = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    if (v > low) onHigh(v);
  };

  const thumbStyle: React.CSSProperties = {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer',
    margin: 0,
    padding: 0,
    pointerEvents: 'auto',
    WebkitAppearance: 'none',
  };

  return (
    <div className="flex flex-col justify-center shrink-0" style={{ width: 180 }}>
      {/* Label */}
      <div
        className="text-center"
        style={{ fontSize: 11, color: '#10214F', fontFamily: 'Poppins, sans-serif', marginBottom: 3, fontWeight: 500 }}
      >
        {fmtPrice(low)} &ndash; {fmtPrice(high)}
      </div>

      {/* Track container */}
      <div className="relative" style={{ height: 20, pointerEvents: 'none' }}>
        {/* grey base track */}
        <div
          style={{
            position: 'absolute', top: 8, left: 0, right: 0,
            height: 4, background: '#E5E7EB', borderRadius: 2,
          }}
        />
        {/* cyan active track */}
        <div
          style={{
            position: 'absolute', top: 8,
            left: `${pct(low)}%`,
            right: `${100 - pct(high)}%`,
            height: 4, background: '#01BBDC', borderRadius: 2,
          }}
        />
        {/* left end-cap dot */}
        <div style={{ position: 'absolute', top: 6, left: 0, width: 8, height: 8, borderRadius: '50%', background: pct(low) <= 2 ? '#01BBDC' : '#E5E7EB', zIndex: 1 }} />
        {/* right end-cap dot */}
        <div style={{ position: 'absolute', top: 6, right: 0, width: 8, height: 8, borderRadius: '50%', background: pct(high) >= 98 ? '#01BBDC' : '#E5E7EB', zIndex: 1 }} />
        {/* low thumb */}
        <input
          type="range" min={min} max={max} step={Math.round(range / 200) || 1}
          value={low} onChange={handleLow}
          style={{ ...thumbStyle, zIndex: low > max - range * 0.1 ? 5 : 3 }}
        />
        {/* high thumb */}
        <input
          type="range" min={min} max={max} step={Math.round(range / 200) || 1}
          value={high} onChange={handleHigh}
          style={{ ...thumbStyle, zIndex: 4 }}
        />
      </div>
    </div>
  );
}

interface SearchBarProps {
  onSearch?: (filters: any) => void;
  showAIOption?: boolean;
  squareTop?: boolean;
}

export default function SearchBar({ onSearch, squareTop }: SearchBarProps) {
  const router = useRouter();

  const [condition,  setCondition]  = useState('');
  const [propulsion, setPropulsion] = useState('');   // 'power' | 'sail' | ''
  const [boatType,   setBoatType]   = useState('');
  const [make,       setMake]       = useState('');
  const [rangeMin,   setRangeMin]   = useState(0);
  const [rangeMax,   setRangeMax]   = useState(10_000_000);
  const [lowVal,     setLowVal]     = useState(0);
  const [highVal,    setHighVal]    = useState(10_000_000);
  const [makes,      setMakes]      = useState<string[]>([]);

  // Fetch distinct makes from backend
  useEffect(() => {
    fetch(apiUrl('/listings/makes'))
      .then((r) => r.ok ? r.json() : [])
      .then((data: string[]) => setMakes(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Fetch live price range from backend
  useEffect(() => {
    fetch(apiUrl('/listings/price-range'))
      .then((r) => r.ok ? r.json() : null)
      .then((data: { min: number; max: number } | null) => {
        if (data) {
          const lo = Math.floor(data.min / 1000) * 1000;
          const hi = Math.ceil(data.max / 1000) * 1000;
          setRangeMin(lo);
          setRangeMax(hi);
          setLowVal(lo);
          setHighVal(hi);
        }
      })
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
    const params = new URLSearchParams();

    if (condition)       params.set('condition',  condition);
    if (propulsion && !boatType) params.set('propulsion', propulsion);
    if (boatType)        params.set('boat_type',  boatType);
    if (make)            params.set('make',       make);
    if (lowVal  > rangeMin) params.set('min_price', String(lowVal));
    if (highVal < rangeMax) params.set('max_price', String(highVal));

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
        className="flex items-center gap-2 flex-wrap sm:flex-nowrap bg-white shadow-md border border-gray-200 px-3 py-2"
        style={{
          minHeight: 56,
          borderRadius: squareTop ? '0 0 12px 12px' : 12,
          ...(squareTop ? { borderTop: 'none' } : {}),
        }}
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

        {/* ── Type ── */}
        <select value={boatType} onChange={(e) => setBoatType(e.target.value)} className={SEL} style={{ minWidth: 130 }}>
          <option value="">Type</option>
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

        {/* ── Price Range Slider ── */}
        <span className="hidden sm:block text-gray-200 select-none">|</span>
        <PriceRangeSlider
          min={rangeMin} max={rangeMax}
          low={lowVal}   high={highVal}
          onLow={setLowVal} onHigh={setHighVal}
        />

        {/* ── Search button (directly after slider) ── */}
        <button
          type="submit"
          className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-semibold flex items-center gap-1.5 hover:opacity-90 transition shrink-0"
        >
          <Search size={15} />
          Search
        </button>

        {/* ── Advanced Search (far right) ── */}
        <button
          type="button"
          onClick={() => router.push('/listings')}
          className="h-10 px-3 rounded-lg text-xs font-medium text-gray-500 hover:text-primary hover:bg-gray-50 flex items-center gap-1 transition shrink-0 whitespace-nowrap border border-gray-200 ml-auto"
        >
          <SlidersHorizontal size={13} />
          Advanced Search
        </button>
      </div>
    </form>
  );
}
