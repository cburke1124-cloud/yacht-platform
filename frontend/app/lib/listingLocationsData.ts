import { API_ROOT } from '@/app/lib/apiRoot';

export interface LocationFilters {
  country: string;
  state?: string;
  city?: string;
}

export interface LocationNode {
  type: 'country' | 'state' | 'city';
  path: string[];
  label: string;
  count: number;
  filters: LocationFilters;
  parentPath?: string[];
}

// Live, DB-driven — no static curation. A city/state/country automatically
// gets a page once it crosses the listing-count threshold on the backend
// (`GET /listings/locations`), and stops appearing if it later drops below
// it. Revalidated hourly to match how fast real inventory actually changes.
export async function fetchLocationNodes(): Promise<LocationNode[]> {
  try {
    const res = await fetch(`${API_ROOT}/listings/locations`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.locations ?? [];
  } catch {
    return [];
  }
}

export function getLocationByPath(nodes: LocationNode[], slugArray: string[]): LocationNode | undefined {
  const target = slugArray.join('/');
  return nodes.find((node) => node.path.join('/') === target);
}

export function getChildLocations(nodes: LocationNode[], parentPath: string[]): LocationNode[] {
  const target = parentPath.join('/');
  return nodes
    .filter((node) => node.parentPath?.join('/') === target)
    .sort((a, b) => b.count - a.count);
}

export function locationFiltersToQueryString(filters: LocationFilters): string {
  const params = new URLSearchParams();
  if (filters.country) params.set('country', filters.country);
  if (filters.state) params.set('state', filters.state);
  if (filters.city) params.set('city', filters.city);
  return params.toString();
}
