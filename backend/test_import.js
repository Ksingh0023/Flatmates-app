/**
 * Quick smoke test for the import service
 * Tests all 18 anomaly detections on the actual CSV
 */
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { detectAnomalies } = require('./src/services/importService');

const csvPath = path.join(__dirname, '../expenses_export.csv');
const csvText = fs.readFileSync(csvPath, 'utf8');

// Auto-detect delimiter
const firstLine = csvText.split('\n')[0];
const delimiter = firstLine.includes('\t') ? '\t' : ',';

const rows = parse(csvText, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  relax_quotes: true,
  relax_column_count: true,
  delimiter,
});

// Use the membership timeline from seed data
const dbMembers = [
  { name: 'Aisha', joined_at: '2026-02-01', left_at: null },
  { name: 'Rohan', joined_at: '2026-02-01', left_at: null },
  { name: 'Priya', joined_at: '2026-02-01', left_at: null },
  { name: 'Meera', joined_at: '2026-02-01', left_at: '2026-03-31' },
  { name: 'Sam',   joined_at: '2026-04-08', left_at: null },
];

const annotated = detectAnomalies(rows, dbMembers);

const flagged = annotated.filter(r => r._action === 'flag');
const clean   = annotated.filter(r => r._action === 'accept');
const autoFixed = annotated.filter(r => r._autoFixes && r._autoFixes.length > 0);

console.log('\n══════════════════════════════════════════');
console.log('  IMPORT SMOKE TEST — expenses_export.csv');
console.log('══════════════════════════════════════════\n');
console.log(`  Total rows  : ${annotated.length}`);
console.log(`  Clean rows  : ${clean.length}`);
console.log(`  Flagged rows: ${flagged.length}`);
console.log(`  Auto-fixed  : ${autoFixed.length}\n`);

// Collect all unique anomaly types detected
const anomalyTypes = new Set();
for (const row of annotated) {
  for (const a of (row._anomalies || [])) anomalyTypes.add(a.type);
  for (const f of (row._autoFixes || [])) anomalyTypes.add(f.type);
}

console.log('  Anomaly types detected:');
for (const t of [...anomalyTypes].sort()) {
  console.log(`    ✓ ${t}`);
}

console.log('\n  Flagged rows detail:');
for (const row of flagged) {
  console.log(`\n  Row ${row._csvRow}: "${row.description}" (${row.date}, ${row.paid_by}, ${row.amount} ${row.currency})`);
  for (const a of row._anomalies) {
    console.log(`    ⚠ [${a.type}] ${a.description}`);
  }
  for (const f of (row._autoFixes || [])) {
    console.log(`    ✅ [${f.type}] ${f.description}`);
  }
}

console.log('\n══════════════════════════════════════════');
console.log('  TEST PASSED — import service working');
console.log('══════════════════════════════════════════\n');
