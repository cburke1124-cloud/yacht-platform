import { create } from 'zustand';
import { listingsApi } from '@/lib/api';

interface FavoritesState {
  savedIds: Set<number>;
  isLoaded: boolean;
  load: () => Promise<void>;
  toggle: (id: number) => Promise<void>;
  isSaved: (id: number) => boolean;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  savedIds: new Set(),
  isLoaded: false,

  load: async () => {
    try {
      const ids = await listingsApi.getSavedIds();
      set({ savedIds: new Set(ids), isLoaded: true });
    } catch {
      set({ isLoaded: true });
    }
  },

  toggle: async (id) => {
    const { savedIds } = get();
    const next = new Set(savedIds);
    if (next.has(id)) {
      next.delete(id);
      set({ savedIds: next });
      try { await listingsApi.unsaveListing(id); } catch { next.add(id); set({ savedIds: next }); }
    } else {
      next.add(id);
      set({ savedIds: next });
      try { await listingsApi.saveListing(id); } catch { next.delete(id); set({ savedIds: next }); }
    }
  },

  isSaved: (id) => get().savedIds.has(id),
}));
