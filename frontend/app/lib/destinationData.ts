import fs from 'fs';
import path from 'path';

export interface WhatToExpect {
  [key: string]: string[];
}

export interface SearchFilters {
  operatingRegions?: string | string[];
  continent?: string;
  country?: string | string[];
  state?: string;
}

export interface Destination {
  id: string;
  slug: string;
  name: string;
  type: 'region' | 'subregion';
  displayName: string;
  subtitle: string;
  heroImage: string;
  heroImageAlt: string;
  shortDescription: string;
  longDescription: string;
  whatToExpect: string[];
  bestFor: string[];
  searchFilters: SearchFilters;
  order: number;
  published: boolean;
  parentRegion?: string;
  subRegions?: string[];
}


let destinationsCache: Destination[] = [];

function loadDestinations(): Destination[] {
  if (destinationsCache.length > 0) return destinationsCache;

  try {
    const dataPath = path.join(process.cwd(), 'public', 'data', 'charter_destinations.json');
    
    // Also try the backend data folder if public doesn't have it
    let fullPath = dataPath;
    if (!fs.existsSync(fullPath)) {
      fullPath = path.join(process.cwd(), '..', '..', 'backend', 'data', 'charter_destinations.json');
    }

    if (!fs.existsSync(fullPath)) {
      console.warn(`Destinations data not found at ${fullPath}`);
      return [];
    }

    const fileContent = fs.readFileSync(fullPath, 'utf-8');
    destinationsCache = JSON.parse(fileContent);
      return destinationsCache;
  } catch (error) {
    console.error('Error loading destinations:', error);
    return [];
  }
}

export function getDestinations(): Destination[] {
  return loadDestinations().filter(d => d.published);
}

export function getRegions(): Destination[] {
  return getDestinations()
    .filter(d => d.type === 'region')
    .sort((a, b) => a.order - b.order);
}

export function getDestinationBySlug(slug: string): Destination | undefined {
  const destinations = loadDestinations();
  return destinations.find(d => d.slug === slug);
}

export function getDestinationWithSubregions(parentSlug: string): Destination | undefined {
  const destinations = loadDestinations();
  const parent = destinations.find(d => d.slug === parentSlug && d.type === 'region');
  return parent;
}

export function getSubregionsForRegion(parentSlug: string): Destination[] {
  const destinations = loadDestinations();
  const parent = destinations.find(d => d.slug === parentSlug && d.type === 'region');
  if (!parent || !parent.subRegions) return [];

  const subregions = destinations.filter(
    d => d.type === 'subregion' && parent.subRegions?.includes(d.slug)
  );
  return subregions.sort((a, b) => (a.order || 999) - (b.order || 999));
}

export function getAllSubregions(): Destination[] {
  return loadDestinations().filter(d => d.type === 'subregion');
}

export function getRegionForSubregion(subregionSlug: string): Destination | undefined {
  const destinations = loadDestinations();
  const subregion = destinations.find(d => d.slug === subregionSlug && d.type === 'subregion');
  if (!subregion || !subregion.parentRegion) return undefined;
  return destinations.find(d => d.slug === subregion.parentRegion);
}

export function getSearchFiltersForDestination(destination: Destination): SearchFilters {
  return destination.searchFilters || {};
}
