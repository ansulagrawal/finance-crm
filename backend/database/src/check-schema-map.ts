/**
 * Asserts that `docs/SCHEMA-MAP.md` accounts for every legacy table and every entity.
 *
 * The map is the contract the entity layer and the additive migration are written
 * against, so a table that silently drops out of it is a table nobody decided about.
 * Run via `bun run check:schema-map` (and re-run after adding an entity or
 * regenerating `database/legacy-baseline/legacy-schema.sql`).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const BASELINE = join(ROOT, 'database/legacy-baseline/legacy-schema.sql');
const ENTITIES = join(ROOT, 'database/src/entities');
const MAP = join(ROOT, '..', 'docs/be-schema-map.md');

function allFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? allFiles(join(dir, e.name))
      : e.name.endsWith('.entity.ts')
        ? [join(dir, e.name)]
        : [],
  );
}

function matchAll(text: string, re: RegExp): string[] {
  return [...text.matchAll(re)].map((m) => m[1]);
}

const legacyTables = new Set(
  matchAll(readFileSync(BASELINE, 'utf8'), /^CREATE TABLE `([^`]+)`/gm),
);

const entityTables = new Set(
  allFiles(ENTITIES).flatMap((f) =>
    matchAll(readFileSync(f, 'utf8'), /@Entity\('([^']+)'\)/g),
  ),
);

// Every `backticked` identifier inside the map's tables. Deliberately loose: it only
// has to be a superset of the two name sets for coverage to hold.
const mapped = new Set(matchAll(readFileSync(MAP, 'utf8'), /`([a-z0-9_]+)`/g));

const missingLegacy = [...legacyTables].filter((t) => !mapped.has(t)).sort();
const missingEntity = [...entityTables].filter((t) => !mapped.has(t)).sort();

if (missingLegacy.length > 0 || missingEntity.length > 0) {
  if (missingLegacy.length > 0) {
    console.error(
      `docs/SCHEMA-MAP.md does not mention ${missingLegacy.length} legacy table(s):\n  ${missingLegacy.join('\n  ')}`,
    );
  }
  if (missingEntity.length > 0) {
    console.error(
      `docs/SCHEMA-MAP.md does not mention ${missingEntity.length} entity table(s):\n  ${missingEntity.join('\n  ')}`,
    );
  }
  process.exit(1);
}

console.log(
  `docs/SCHEMA-MAP.md covers all ${legacyTables.size} legacy tables and all ${entityTables.size} entities.`,
);
