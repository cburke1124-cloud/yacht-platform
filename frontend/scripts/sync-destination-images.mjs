import fs from 'fs';
import path from 'path';

const root = process.cwd();
const dataPath = path.join(root, 'public', 'data', 'charter_destinations.json');
const imagesDir = path.join(root, 'public', 'images', 'destinations');
const sourceDir = path.join(root, 'destination-image-drop');

if (!fs.existsSync(dataPath)) {
  console.error(`Missing data file: ${dataPath}`);
  process.exit(1);
}

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

if (!fs.existsSync(sourceDir)) {
  fs.mkdirSync(sourceDir, { recursive: true });
  console.log(`Created drop folder: ${sourceDir}`);
}

const destinations = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

const expected = destinations
  .map((d) => path.basename(d.heroImage || ''))
  .filter(Boolean);

if (expected.length === 0) {
  console.log('No heroImage entries found in charter_destinations.json');
  process.exit(0);
}

const sourceFiles = new Map(
  fs.readdirSync(sourceDir).map((f) => [f.toLowerCase(), f])
);

let copied = 0;
const missing = [];

for (const fileName of expected) {
  const key = fileName.toLowerCase();
  const sourceName = sourceFiles.get(key);

  if (!sourceName) {
    missing.push(fileName);
    continue;
  }

  const src = path.join(sourceDir, sourceName);
  const dest = path.join(imagesDir, fileName);
  fs.copyFileSync(src, dest);
  copied += 1;
}

console.log(`Copied ${copied}/${expected.length} destination images into public/images/destinations`);

if (missing.length > 0) {
  console.log('\nMissing files (add these to destination-image-drop):');
  for (const name of missing) {
    console.log(`- ${name}`);
  }
  process.exitCode = 2;
} else {
  console.log('All destination hero images are present.');
}
