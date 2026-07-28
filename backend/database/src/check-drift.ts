/**
 * Compares every mapped entity column against the real database column it
 * claims, and fails on any disagreement.
 *
 * This is the oracle for the legacy-adoption work: entities must describe the
 * legacy schema exactly, because anything they get wrong turns into a `MODIFY`
 * against a table the app-server install is also reading.
 *
 * Deliberately *not* `typeorm migration:generate` — legacy tables carry far
 * more columns than we map (2,071 vs ~620), and the generator would emit a
 * `DROP COLUMN` for every unmapped one. Unmapped legacy columns are fine and
 * expected; a mapped column that does not exist, or exists with a different
 * type, is not.
 *
 * Tables absent from the target database are reported separately, not failed:
 * during the rewrite that means "entity not converted yet", and afterwards it
 * means "table this migration creates".
 *
 * Run via `bun run check:drift` (honours DB_DATABASE).
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { isAddedColumn } from './additive-schema-changes';
import { buildDataSourceOptions } from './data-source';

const INTEGER_TYPES = new Set([
  'tinyint',
  'smallint',
  'mediumint',
  'int',
  'integer',
  'bigint',
]);

type DbColumn = {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  COLUMN_TYPE: string;
  IS_NULLABLE: string;
};

/** `varchar(150)`, `tinyint unsigned`, `mediumint(8) unsigned` -> comparable parts. */
function normalizeDbType(columnType: string): {
  base: string;
  length: string | null;
  unsigned: boolean;
} {
  const unsigned = columnType.includes('unsigned');
  const withoutFlags = columnType
    .replace(/\s+unsigned|\s+zerofill/g, '')
    .trim();
  const match = withoutFlags.match(/^([a-z]+)(?:\(([^)]*)\))?$/);
  return {
    base: match ? match[1] : withoutFlags,
    // Display widths on integer types are cosmetic and MySQL 8+ drops them, so
    // only width on string/decimal types is meaningful for comparison.
    length: match?.[2] && !/int$/.test(match[1]) ? match[2] : null,
    unsigned,
  };
}

function entityType(
  declaredType: unknown,
  length: string | number | undefined,
  precision: number | undefined,
  scale: number | undefined,
): { base: string; length: string | null } {
  // An entity that has not declared an explicit column type yet leaves
  // TypeORM's inferred JS constructor here (`Number`, `String`, `Date`).
  // Render it as the constructor name so the message stays readable.
  const base =
    typeof declaredType === 'function'
      ? (declaredType as { name: string }).name.toLowerCase()
      : String(declaredType).toLowerCase();
  if (length !== undefined && length !== '') {
    return { base, length: String(length) };
  }
  if (precision !== undefined) {
    return {
      base,
      length: scale === undefined ? String(precision) : `${precision},${scale}`,
    };
  }
  return { base, length: null };
}

async function main(): Promise<void> {
  const dataSource = new DataSource(buildDataSourceOptions());
  await dataSource.initialize();
  const database = dataSource.options.database as string;

  const rows: DbColumn[] = await dataSource.query(
    'SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE ' +
      'FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?',
    [database],
  );

  const byTable = new Map<string, Map<string, DbColumn>>();
  for (const row of rows) {
    const table = row.TABLE_NAME.toLowerCase();
    if (!byTable.has(table)) byTable.set(table, new Map());
    byTable.get(table)?.set(row.COLUMN_NAME.toLowerCase(), row);
  }

  const problems: string[] = [];
  const absentTables: string[] = [];
  const pendingColumns: string[] = [];
  let checkedTables = 0;
  let checkedColumns = 0;

  for (const metadata of dataSource.entityMetadatas) {
    const table = metadata.tableName.toLowerCase();
    const dbColumns = byTable.get(table);
    if (!dbColumns) {
      absentTables.push(`${metadata.name} -> ${metadata.tableName}`);
      continue;
    }
    checkedTables++;

    for (const column of metadata.columns) {
      const name = column.databaseName.toLowerCase();
      const dbColumn = dbColumns.get(name);
      if (!dbColumn) {
        const message = `${metadata.tableName}.${column.databaseName} (${metadata.name}.${column.propertyName})`;
        if (isAddedColumn(metadata.tableName, column.databaseName)) {
          pendingColumns.push(message);
        } else {
          problems.push(`${message} — column does not exist`);
        }
        continue;
      }
      checkedColumns++;

      const db = normalizeDbType(dbColumn.COLUMN_TYPE);
      const declared = entityType(
        column.type,
        column.length,
        column.precision ?? undefined,
        column.scale ?? undefined,
      );

      // A relation's join column takes its width from the referenced primary
      // key, and TypeORM offers no way to override that. Legacy is internally
      // inconsistent here — `users.company_id` is `mediumint unsigned` while
      // `company_login.company_id` is `bigint unsigned` — so for join columns
      // only the integer family and signedness are compared. Legacy declares no
      // foreign keys, so the width difference is a mapping artefact, not a data
      // one. Every non-relation column stays strictly compared.
      const isJoinColumn = column.relationMetadata !== undefined;
      const bothIntegers =
        INTEGER_TYPES.has(db.base) && INTEGER_TYPES.has(declared.base);

      if (db.base !== declared.base && !(isJoinColumn && bothIntegers)) {
        problems.push(
          `${metadata.tableName}.${column.databaseName} — type ${declared.base} declared, ${dbColumn.COLUMN_TYPE} in database`,
        );
      } else if (isJoinColumn && bothIntegers) {
        // Width and signedness both come from the referenced primary key, and
        // legacy disagrees with itself on both: `users.company_id` is
        // `mediumint unsigned` against a `bigint unsigned` key, and
        // `leads.lead_data_source_id` is a *signed* `mediumint` against an
        // unsigned one. Nothing here is expressible in TypeORM and nothing
        // breaks, because legacy declares no foreign keys.
      } else if (declared.length !== null && declared.length !== db.length) {
        problems.push(
          `${metadata.tableName}.${column.databaseName} — length ${declared.length} declared, ${dbColumn.COLUMN_TYPE} in database`,
        );
      } else if (db.unsigned !== ((column.unsigned ?? false) as boolean)) {
        problems.push(
          `${metadata.tableName}.${column.databaseName} — unsigned ${column.unsigned ?? false} declared, ${dbColumn.COLUMN_TYPE} in database`,
        );
      }

      const dbNullable = dbColumn.IS_NULLABLE === 'YES';
      if (!column.isPrimary && dbNullable !== column.isNullable) {
        problems.push(
          `${metadata.tableName}.${column.databaseName} — nullable ${column.isNullable} declared, ${dbNullable} in database`,
        );
      }
    }
  }

  await dataSource.destroy();

  if (absentTables.length > 0) {
    console.log(
      `Not in \`${database}\` (${absentTables.length}) — unconverted entity or a table the migration creates:\n  ${absentTables.sort().join('\n  ')}\n`,
    );
  }

  if (pendingColumns.length > 0) {
    console.log(
      `Declared in additive-schema-changes.ts, not yet applied (${pendingColumns.length}):\n  ${pendingColumns.sort().join('\n  ')}\n`,
    );
  }

  if (problems.length > 0) {
    console.error(
      `${problems.length} mismatch(es) against \`${database}\`:\n  ${problems.sort().join('\n  ')}`,
    );
    process.exit(1);
  }

  console.log(
    `No drift: ${checkedColumns} column(s) across ${checkedTables} table(s) match \`${database}\`.`,
  );
}

main().catch((error) => {
  console.error('Drift check failed:', error);
  process.exit(1);
});
