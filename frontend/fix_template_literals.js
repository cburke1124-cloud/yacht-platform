const fs = require('fs');
const p = 'app/listings/[id]/page.tsx';
let s = fs.readFileSync(p, 'utf8');
const before = s;
// Remove newlines between ternary ? and opening template/backref
// Remove newlines immediately after opening backtick when followed by ${
s = s.replace(/`\s*\r?\n\s*(?=\$\{)/g, '`');
// Also remove spurious newlines between template variable parts caused by wrapping (e.g. listing.length_\nfeet)
s = s.replace(/_\s*\r?\n\s*/g, '_');
if (s === before) {
  console.log('no changes');
} else {
  fs.writeFileSync(p, s, 'utf8');
  console.log('patched');
}
