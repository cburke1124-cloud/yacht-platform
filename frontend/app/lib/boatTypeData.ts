import fs from 'fs';
import path from 'path';

export interface BoatType {
  id: string;
  slug: string;
  name: string;
  boatType: string;
  displayName: string;
  subtitle: string;
  heroImage: string;
  heroImageAlt: string;
  shortDescription: string;
  longDescription: string;
  whatToExpect: string[];
  bestFor: string[];
  order: number;
  published: boolean;
}

function loadBoatTypes(): BoatType[] {
  try {
    const dataPath = path.join(process.cwd(), 'public', 'data', 'boat_types.json');

    let fullPath = dataPath;
    if (!fs.existsSync(fullPath)) {
      fullPath = path.join(process.cwd(), '..', '..', 'backend', 'data', 'boat_types.json');
    }

    if (!fs.existsSync(fullPath)) {
      console.warn(`Boat types data not found at ${fullPath}`);
      return [];
    }

    const fileContent = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(fileContent) as BoatType[];
  } catch (error) {
    console.error('Error loading boat types:', error);
    return [];
  }
}

export function getBoatTypes(): BoatType[] {
  return loadBoatTypes()
    .filter((b) => b.published)
    .sort((a, b) => a.order - b.order);
}

export function getBoatTypeBySlug(slug: string): BoatType | undefined {
  return loadBoatTypes().find((b) => b.slug === slug);
}
