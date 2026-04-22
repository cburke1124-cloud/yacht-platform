'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ChevronRight, X, Check, AlertCircle } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

const authHeaders = () => ({
  Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`,
});
const jsonHeaders = () => ({
  'Content-Type': 'application/json',
  ...authHeaders(),
});

interface Make {
  id: number;
  name: string;
  slug: string;
  country?: string;
  propulsion: string;
  active: boolean;
}

interface Model {
  id: number;
  make_id: number;
  name: string;
  boat_type?: string;
  propulsion?: string;
  length_ft?: number;
  min_year?: number;
  max_year?: number;
  active: boolean;
}

const PROPULSION_OPTIONS = ['both', 'power', 'sail'];
const BOAT_TYPES = [
  'Motor Yacht', 'Mega Yacht', 'Trawler', 'Express Cruiser', 'Sport Fisher',
  'Center Console', 'Sailing Yacht', 'Catamaran', 'Sloop', 'Ketch', 'Schooner',
];

function Toast({ ok, msg, onClose }: { ok: boolean; msg: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {ok ? <Check size={15} /> : <AlertCircle size={15} />}
      {msg}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X size={13} /></button>
    </div>
  );
}

// ── Make form modal ──────────────────────────────────────────────────────────
function MakeModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Make;
  onSave: (data: Partial<Make>) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [country, setCountry] = useState(initial?.country ?? '');
  const [propulsion, setPropulsion] = useState(initial?.propulsion ?? 'both');
  const [active, setActive] = useState(initial?.active ?? true);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ name, country: country || undefined, propulsion, active });
    setSaving(false);
  };

  const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10214F]';
  const lbl = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#10214F]">{initial ? 'Edit Make' : 'Add Make'}</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={lbl}>Name *</label>
            <input required className={inp} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Country</label>
            <input className={inp} value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. Italy" />
          </div>
          <div>
            <label className={lbl}>Propulsion</label>
            <select className={inp} value={propulsion} onChange={e => setPropulsion(e.target.value)}>
              {PROPULSION_OPTIONS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm text-gray-700">Active</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-[#10214F] text-white hover:bg-[#1a3470] disabled:opacity-60">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Model form modal ─────────────────────────────────────────────────────────
function ModelModal({
  makeId,
  initial,
  onSave,
  onClose,
}: {
  makeId: number;
  initial?: Model;
  onSave: (data: Partial<Model>) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [boatType, setBoatType] = useState(initial?.boat_type ?? '');
  const [propulsion, setPropulsion] = useState(initial?.propulsion ?? '');
  const [lengthFt, setLengthFt] = useState(initial?.length_ft?.toString() ?? '');
  const [minYear, setMinYear] = useState(initial?.min_year?.toString() ?? '');
  const [maxYear, setMaxYear] = useState(initial?.max_year?.toString() ?? '');
  const [active, setActive] = useState(initial?.active ?? true);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      make_id: makeId,
      name,
      boat_type: boatType || undefined,
      propulsion: propulsion || undefined,
      length_ft: lengthFt ? Number(lengthFt) : undefined,
      min_year: minYear ? Number(minYear) : undefined,
      max_year: maxYear ? Number(maxYear) : undefined,
      active,
    });
    setSaving(false);
  };

  const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10214F]';
  const lbl = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#10214F]">{initial ? 'Edit Model' : 'Add Model'}</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={lbl}>Model Name *</label>
            <input required className={inp} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Boat Type</label>
              <select className={inp} value={boatType} onChange={e => setBoatType(e.target.value)}>
                <option value="">— Any —</option>
                {BOAT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Propulsion</label>
              <select className={inp} value={propulsion} onChange={e => setPropulsion(e.target.value)}>
                <option value="">— Any —</option>
                <option value="power">Power</option>
                <option value="sail">Sail</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Length (ft)</label>
              <input type="number" step="0.1" className={inp} value={lengthFt} onChange={e => setLengthFt(e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Min Year</label>
              <input type="number" className={inp} value={minYear} onChange={e => setMinYear(e.target.value)} placeholder="1980" />
            </div>
            <div>
              <label className={lbl}>Max Year</label>
              <input type="number" className={inp} value={maxYear} onChange={e => setMaxYear(e.target.value)} placeholder="—" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm text-gray-700">Active</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-[#10214F] text-white hover:bg-[#1a3470] disabled:opacity-60">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main tab ─────────────────────────────────────────────────────────────────
export default function AdminCatalogTab() {
  const [makes, setMakes] = useState<Make[]>([]);
  const [selectedMake, setSelectedMake] = useState<Make | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [loadingMakes, setLoadingMakes] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [makeModal, setMakeModal] = useState<{ open: boolean; item?: Make }>({ open: false });
  const [modelModal, setModelModal] = useState<{ open: boolean; item?: Model }>({ open: false });
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const showToast = (ok: boolean, msg: string) => setToast({ ok, msg });

  // Load all makes (include inactive)
  const loadMakes = async () => {
    setLoadingMakes(true);
    try {
      const res = await fetch(apiUrl('/catalog/makes?show_all=1'), { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMakes(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoadingMakes(false);
    }
  };

  // Load models for selected make (include inactive)
  const loadModels = async (makeId: number) => {
    setLoadingModels(true);
    try {
      const res = await fetch(apiUrl(`/catalog/models?make_id=${makeId}&show_all=1`), { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setModels(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => { loadMakes(); }, []);
  useEffect(() => { if (selectedMake) loadModels(selectedMake.id); }, [selectedMake]);

  // ── Make operations ──
  const saveMake = async (data: Partial<Make>, existingId?: number) => {
    const url = existingId ? apiUrl(`/catalog/makes/${existingId}`) : apiUrl('/catalog/makes');
    const method = existingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: jsonHeaders(), body: JSON.stringify(data) });
    if (res.ok) {
      showToast(true, existingId ? 'Make updated' : 'Make created');
      setMakeModal({ open: false });
      await loadMakes();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(false, err.detail || 'Failed to save make');
    }
  };

  const deleteMake = async (make: Make) => {
    if (!confirm(`Delete make "${make.name}" and ALL its models? This cannot be undone.`)) return;
    const res = await fetch(apiUrl(`/catalog/makes/${make.id}`), { method: 'DELETE', headers: authHeaders() });
    if (res.ok) {
      showToast(true, `"${make.name}" deleted`);
      if (selectedMake?.id === make.id) { setSelectedMake(null); setModels([]); }
      await loadMakes();
    } else {
      showToast(false, 'Delete failed');
    }
  };

  // ── Model operations ──
  const saveModel = async (data: Partial<Model>, existingId?: number) => {
    const url = existingId ? apiUrl(`/catalog/models/${existingId}`) : apiUrl('/catalog/models');
    const method = existingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: jsonHeaders(), body: JSON.stringify(data) });
    if (res.ok) {
      showToast(true, existingId ? 'Model updated' : 'Model created');
      setModelModal({ open: false });
      if (selectedMake) await loadModels(selectedMake.id);
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(false, err.detail || 'Failed to save model');
    }
  };

  const deleteModel = async (model: Model) => {
    if (!confirm(`Delete model "${model.name}"?`)) return;
    const res = await fetch(apiUrl(`/catalog/models/${model.id}`), { method: 'DELETE', headers: authHeaders() });
    if (res.ok) {
      showToast(true, `"${model.name}" deleted`);
      if (selectedMake) await loadModels(selectedMake.id);
    } else {
      showToast(false, 'Delete failed');
    }
  };

  const visibleMakes = showInactive ? makes : makes.filter(m => m.active);
  const visibleModels = showInactive ? models : models.filter(m => m.active);

  return (
    <div className="space-y-0">
      {toast && <Toast ok={toast.ok} msg={toast.msg} onClose={() => setToast(null)} />}
      {makeModal.open && (
        <MakeModal
          initial={makeModal.item}
          onSave={(d) => saveMake(d, makeModal.item?.id)}
          onClose={() => setMakeModal({ open: false })}
        />
      )}
      {modelModal.open && selectedMake && (
        <ModelModal
          makeId={selectedMake.id}
          initial={modelModal.item}
          onSave={(d) => saveModel(d, modelModal.item?.id)}
          onClose={() => setModelModal({ open: false })}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Make / Model Catalog</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage the canonical list of yacht makes and their models.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="w-4 h-4 rounded" />
          Show inactive
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        {/* ── Makes column ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-sm font-semibold text-gray-700">Makes ({visibleMakes.length})</span>
            <button
              onClick={() => setMakeModal({ open: true })}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-[#10214F] text-white hover:bg-[#1a3470]"
            >
              <Plus size={12} /> Add Make
            </button>
          </div>
          {loadingMakes ? (
            <div className="p-6 text-sm text-gray-400 text-center">Loading…</div>
          ) : visibleMakes.length === 0 ? (
            <div className="p-6 text-sm text-gray-400 text-center">No makes found.</div>
          ) : (
            <ul className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {visibleMakes.map(make => (
                <li
                  key={make.id}
                  onClick={() => setSelectedMake(make)}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors ${selectedMake?.id === make.id ? 'bg-blue-50 border-l-2 border-[#10214F]' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {make.name}
                      {!make.active && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">inactive</span>}
                    </div>
                    <div className="text-xs text-gray-400">{make.propulsion} {make.country ? `· ${make.country}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); setMakeModal({ open: true, item: make }); }}
                      className="p-1 rounded hover:bg-gray-200 text-gray-500"
                      title="Edit"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); deleteMake(make); }}
                      className="p-1 rounded hover:bg-red-100 text-red-500"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                    <ChevronRight size={14} className="text-gray-300" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Models column ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-sm font-semibold text-gray-700">
              {selectedMake ? `Models for ${selectedMake.name} (${visibleModels.length})` : 'Models'}
            </span>
            {selectedMake && (
              <button
                onClick={() => setModelModal({ open: true })}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-[#10214F] text-white hover:bg-[#1a3470]"
              >
                <Plus size={12} /> Add Model
              </button>
            )}
          </div>
          {!selectedMake ? (
            <div className="p-10 text-sm text-gray-400 text-center">← Select a make to view its models</div>
          ) : loadingModels ? (
            <div className="p-6 text-sm text-gray-400 text-center">Loading…</div>
          ) : visibleModels.length === 0 ? (
            <div className="p-6 text-sm text-gray-400 text-center">No models yet. Click "Add Model" to create one.</div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Name</th>
                    <th className="text-left px-4 py-2 font-medium">Type</th>
                    <th className="text-left px-4 py-2 font-medium">Prop.</th>
                    <th className="text-left px-4 py-2 font-medium">Len.</th>
                    <th className="text-left px-4 py-2 font-medium">Years</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleModels.map(model => (
                    <tr key={model.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {model.name}
                        {!model.active && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">inactive</span>}
                      </td>
                      <td className="px-4 py-2 text-gray-500">{model.boat_type || '—'}</td>
                      <td className="px-4 py-2 text-gray-500">{model.propulsion || '—'}</td>
                      <td className="px-4 py-2 text-gray-500">{model.length_ft ? `${model.length_ft} ft` : '—'}</td>
                      <td className="px-4 py-2 text-gray-500">
                        {model.min_year ? `${model.min_year}–${model.max_year ?? 'present'}` : '—'}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => setModelModal({ open: true, item: model })}
                            className="p-1 rounded hover:bg-gray-200 text-gray-500"
                            title="Edit"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => deleteModel(model)}
                            className="p-1 rounded hover:bg-red-100 text-red-500"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
