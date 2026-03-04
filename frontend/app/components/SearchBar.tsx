'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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

function fmtLength(v: number): string {
  return `${v} ft`;
}

// ─── Dual range slider (generic) ─────────────────────────────────────────
interface SliderProps {
  min: number;
  max: number;
  low: number;
  high: number;
  onLow: (v: number) => void;
  onHigh: (v: number) => void;
  label: (low: number, high: number) => string;
  step?: number;
}

function DualRangeSlider({ min, max, low, high, onLow, onHigh, label, step = 1 }: SliderProps) {
  const trackRef  = useRef<HTMLDivElement>(null);
  const dragging  = useRef<'low' | 'high' | null>(null);
  const range = max - min || 1;
  const pct   = (v: number) => ((v - min) / range) * 100;

  const valueFromPointer = useCallback((clientX: number): number => {
    const el = trackRef.current;
    if (!el) return min;
    const { left, width } = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - left) / width));
    return Math.round((min + ratio * range) / step) * step;
  }, [min, range, step]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragging.current) return;
    const val = valueFromPointer(e.clientX);
    if (dragging.current === 'low'  && val < high) onLow(val);
    if (dragging.current === 'high' && val > low)  onHigh(val);
  }, [valueFromPointer, low, high, onLow, onHigh]);

  const onPointerUp = useCallback(() => {
    dragging.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup',   onPointerUp);
  }, [onPointerMove]);

  const startDrag = (which: 'low' | 'high') => (e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = which;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup',   onPointerUp);
  };

  const HANDLE = 14;

  return (
    <div className="flex flex-col justify-center shrink-0" style={{ width: 190 }}>
      <div
        className="text-center"
        style={{ fontSize: 11, color: '#10214F', fontFamily: 'Poppins, sans-serif', marginBottom: 4, fontWeight: 600, letterSpacing: '0.01em' }}
      >
        {label(low, high)}
      </div>
      <div
        ref={trackRef}
        style={{ position: 'relative', height: HANDLE, margin: `0 ${HANDLE / 2}px`, cursor: 'default' }}
      >
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 3, marginTop: -1.5, background: '#E5E7EB', borderRadius: 2 }} />
        <div style={{ position: 'absolute', top: '50%', marginTop: -1.5, height: 3, left: `${pct(low)}%`, width: `${pct(high) - pct(low)}%`, background: '#01BBDC', borderRadius: 2 }} />
        <div onPointerDown={startDrag('low')} style={{ position: 'absolute', top: '50%', left: `${pct(low)}%`, transform: 'translate(-50%, -50%)', width: HANDLE, height: HANDLE, borderRadius: '50%', background: '#01BBDC', border: '2px solid #FFFFFF', boxShadow: '0 1px 4px rgba(0,0,0,0.25)', cursor: 'grab', zIndex: 3, touchAction: 'none' }} />
        <div onPointerDown={startDrag('high')} style={{ position: 'absolute', top: '50%', left: `${pct(high)}%`, transform: 'translate(-50%, -50%)', width: HANDLE, height: HANDLE, borderRadius: '50%', background: '#01BBDC', border: '2px solid #FFFFFF', boxShadow: '0 1px 4px rgba(0,0,0,0.25)', cursor: 'grab', zIndex: 3, touchAction: 'none' }} />
      </div>
    </div>
  );
}

function PriceRangeSlider({ min, max, low, high, onLow, onHigh }: Omit<SliderProps, 'label' | 'step'>) {
  return <DualRangeSlider min={min} max={max} low={low} high={high} onLow={onLow} onHigh={onHigh} label={(l, h) => `${fmtPrice(l)} – ${fmtPrice(h)}`} step={Math.round((max - min) / 200) || 1} />;
}

function LengthRangeSlider({ min, max, low, high, onLow, onHigh }: Omit<SliderProps, 'label' | 'step'>) {
  return <DualRangeSlider min={min} max={max} low={low} high={high} onLow={onLow} onHigh={onHigh} label={(l, h) => `${fmtLength(l)} – ${fmtLength(h)}`} step={1} />;
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
  const [lenMin,     setLenMin]     = useState(20);
  const [lenMax,     setLenMax]     = useState(300);
  const [lowLen,     setLowLen]     = useState(20);
  const [highLen,    setHighLen]    = useState(300);
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
    if (lowVal  > rangeMin) params.set('min_price',  String(lowVal));
    if (highVal < rangeMax) params.set('max_price',  String(highVal));
    if (lowLen  > lenMin)   params.set('min_length', String(lowLen));
    if (highLen < lenMax)   params.set('max_length', String(highLen));

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

        <span className="hidden sm:block text-gray-200 select-none">|</span>

        {/* ── Length Range Slider ── */}
        <LengthRangeSlider
          min={lenMin} max={lenMax}
          low={lowLen} high={highLen}
          onLow={setLowLen} onHigh={setHighLen}
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
