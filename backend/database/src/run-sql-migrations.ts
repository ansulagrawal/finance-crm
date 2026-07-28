/**
 * Runs the plain-SQL files in `database/sql-migrations/` against a real
 * MySQL/MariaDB database — the single source of truth for this backend's
 * schema, replacing the old TypeORM migration file. Every file in that
 * directory is also valid to paste directly into phpMyAdmin or any other
 * MySQL client; this script is a convenience runner, not a dependency of
 * the files themselves.
 *
 * Usage (`bun run migrate` in `database/`, or `bun src/run-sql-migrations.ts`
 * directly):
 *   --init          run sql-migrations/init.sql only (the legacy baseline,
 *                    onto a brand-new empty database)
 *   --mN            run m1.sql through mN.sql, in order (e.g. --m4 runs
 *                    m1, m2, m3, m4)
 *   --mA-mB         run mA.sql through mB.sql, in order, WITHOUT the ones
 *                    before mA (e.g. --m2-m4 runs m2, m3, m4 only — use
 *                    this to resume a run that already applied m1 earlier)
 *   (no flags)      defaults to --m1
 *   --init --mN     run init.sql, then m1.sql through mN.sql
 *
 * Connects via the same DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_DATABASE
 * env vars as data-source.ts (dotenv-loaded from the same two paths).
 *
 * --- Idempotency (mN.sql/mN.down.sql only, not init.sql) ---
 *
 * Every item in an mN.sql file is safe to run against a database that
 * already has some or all of it — different real environments can be in
 * different starting states (e.g. UAT was found missing a primary key
 * prod/dev already have). Real MySQL does NOT support the `ADD COLUMN IF
 * NOT EXISTS` shorthand (confirmed: it's MariaDB-only, fails with a syntax
 * error on real MySQL 8/9) — so ADD COLUMN/ADD PRIMARY KEY/ADD CONSTRAINT
 * items check `information_schema` themselves and build the real
 * statement as dynamic SQL (`SET`/`PREPARE`/`EXECUTE`/`DEALLOCATE`) only
 * when the target is actually missing. `CREATE TABLE`/`DROP TABLE ... IF
 * [NOT] EXISTS` are native and portable, no dynamic SQL needed there.
 *
 * Each item is one blank-line-separated "block", led by a `-- TARGET:
 * <KIND> <descriptor>` comment (`COLUMN table.column`, `TABLE table`,
 * `PRIMARY_KEY table`, `CONSTRAINT table.constraintName`, `AUTO_INCREMENT
 * table.column`, or `TRIGGER name`) that this script parses to know what
 * to existence-check —
 * required on every block. A block's physical statements (there can be
 * several, for the dynamic-SQL ones) all run in sequence. `TRIGGER` is
 * the one kind that can't use the dynamic-SQL check-then-PREPARE pattern
 * — real MySQL's prepared-statement protocol explicitly rejects `CREATE
 * TRIGGER` ("not supported in the prepared statement protocol yet",
 * confirmed) — so a trigger block is instead an unconditional `DROP
 * TRIGGER IF EXISTS` followed by a plain `CREATE TRIGGER`, which reaches
 * the same idempotent end state without needing PREPARE at all.
 *
 * --- Revert-on-failure ---
 *
 * MySQL auto-commits every DDL statement (`CREATE TABLE`, `ALTER TABLE`,
 * ...) even inside a transaction — there is no real `ROLLBACK` for schema
 * changes in MySQL. What this script does instead, for the --mN/--mA-mB
 * path only (not --init, see init.sql's own header for why): before
 * running a file's blocks, it snapshots whether each block's TARGET
 * already existed. If a later block fails, it undoes every PRECEDING
 * block in that file that this run actually changed (skipping ones whose
 * target already existed before this run started — those predate this
 * invocation and are not this run's to touch), using `mK.down.sql`'s
 * block at the mirrored position (down-file blocks are the up-file's
 * exact reverse, in reverse order — see that file's header), then does
 * the same for every earlier mI.sql this same invocation had already
 * fully applied, in reverse file order. This restores the database to
 * its state before this invocation started — it cannot undo anything
 * from a previous, separate invocation.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import mysql from 'mysql2/promise';

loadEnv({ path: `${__dirname}/../.env` });
loadEnv({ path: `${__dirname}/../../.env` });

const SQL_DIR = join(__dirname, '..', 'sql-migrations');

/**
 * Splits a file into individual statements on the top-level statement
 * delimiter only (normally `;`, see the `DELIMITER` handling below) — a
 * naive `sql.split(';')` breaks on any `;` inside a quoted string (e.g. a
 * column `COMMENT '1=>salaried;2=>self-employed'`, which init.sql's real
 * legacy columns actually contain), fragmenting one CREATE TABLE into
 * several invalid partial statements. Tracks single/double/backtick-quote
 * state (with `''`/backtick-doubling and backslash escapes handled) and
 * only splits on the delimiter when not inside one.
 *
 * Also understands phpMyAdmin's `DELIMITER $$ ... $$ DELIMITER ;` trick
 * (init.sql has one real trigger wrapped this way) — `DELIMITER` is a
 * client-side-only directive, not real SQL, so a `DELIMITER <token>` line
 * (recognized only between statements, never inside a quote) switches the
 * top-level split token to `<token>` until the next `DELIMITER` line, and
 * is itself dropped rather than sent to the server. This lets a CREATE
 * TRIGGER/PROCEDURE body's own internal `;`s pass through untouched while
 * `$$` (or whatever token) closes the statement instead.
 */
function parseStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let quoteChar: string | null = null;
  let delimiter = ';';

  for (const rawLine of sql.split('\n')) {
    const trimmed = rawLine.trim();
    if (trimmed === '' || trimmed.startsWith('--')) continue;

    if (quoteChar === null && current.trim() === '') {
      const delimiterMatch = /^DELIMITER\s+(\S+)$/i.exec(trimmed);
      if (delimiterMatch) {
        delimiter = delimiterMatch[1];
        continue;
      }
    }

    const line = `${rawLine}\n`;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (quoteChar) {
        current += ch;
        if (ch === '\\' && quoteChar !== '`') {
          i++;
          if (i < line.length) current += line[i];
          continue;
        }
        if (ch === quoteChar) {
          if (line[i + 1] === quoteChar) {
            current += quoteChar;
            i++;
            continue;
          }
          quoteChar = null;
        }
        continue;
      }

      if (ch === "'" || ch === '"' || ch === '`') {
        quoteChar = ch;
        current += ch;
        continue;
      }

      if (line.startsWith(delimiter, i)) {
        const trimmedStatement = current.trim();
        if (trimmedStatement.length > 0) statements.push(trimmedStatement);
        current = '';
        i += delimiter.length - 1;
        continue;
      }

      current += ch;
    }
  }

  const trailing = current.trim();
  if (trailing.length > 0) statements.push(trailing);

  return statements;
}

type Target =
  | { kind: 'COLUMN'; table: string; column: string }
  | { kind: 'TABLE'; table: string }
  | { kind: 'PRIMARY_KEY'; table: string }
  | { kind: 'CONSTRAINT'; table: string; constraint: string }
  | { kind: 'AUTO_INCREMENT'; table: string; column: string }
  | { kind: 'TRIGGER'; name: string };

type Block = {
  target: Target;
  statements: string[];
};

function describeTarget(target: Target): string {
  switch (target.kind) {
    case 'TABLE':
      return `TABLE ${target.table}`;
    case 'COLUMN':
      return `COLUMN ${target.table}.${target.column}`;
    case 'PRIMARY_KEY':
      return `PRIMARY_KEY ${target.table}`;
    case 'CONSTRAINT':
      return `CONSTRAINT ${target.table}.${target.constraint}`;
    case 'AUTO_INCREMENT':
      return `AUTO_INCREMENT ${target.table}.${target.column}`;
    case 'TRIGGER':
      return `TRIGGER ${target.name}`;
  }
}

function parseTarget(comment: string): Target {
  const match =
    /^TARGET:\s+(COLUMN|TABLE|PRIMARY_KEY|CONSTRAINT|AUTO_INCREMENT|TRIGGER)\s+(\S+)$/.exec(
      comment.trim(),
    );
  if (!match) {
    throw new Error(`Malformed "-- TARGET:" comment: ${comment}`);
  }
  const [, kind, descriptor] = match;
  if (kind === 'TABLE' || kind === 'PRIMARY_KEY') {
    return { kind, table: descriptor };
  }
  if (kind === 'TRIGGER') {
    return { kind, name: descriptor };
  }
  const dot = descriptor.indexOf('.');
  if (dot === -1) {
    throw new Error(
      `TARGET ${kind} needs a "table.name" descriptor, got: ${descriptor}`,
    );
  }
  const table = descriptor.slice(0, dot);
  const name = descriptor.slice(dot + 1);
  if (kind === 'COLUMN') return { kind, table, column: name };
  if (kind === 'AUTO_INCREMENT') return { kind, table, column: name };
  return { kind: 'CONSTRAINT', table, constraint: name };
}

/**
 * Splits a file into blank-line-separated blocks, each parsed as a
 * `{ target, statements }` pair per the module doc comment. A chunk with
 * no real SQL in it (comment-only, e.g. this file's own header) is
 * skipped rather than requiring a TARGET it has no use for.
 */
function parseBlocks(sql: string): Block[] {
  const chunks = sql
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  const blocks: Block[] = [];
  for (const chunk of chunks) {
    const statements = parseStatements(chunk);
    if (statements.length === 0) continue;

    const targetLine = chunk
      .split('\n')
      .find((line) => line.trim().startsWith('-- TARGET:'));
    if (!targetLine) {
      throw new Error(
        `Block missing "-- TARGET:" comment:\n${chunk.slice(0, 200)}`,
      );
    }
    blocks.push({
      target: parseTarget(targetLine.trim().replace(/^--\s*/, '')),
      statements,
    });
  }
  return blocks;
}

async function targetExists(
  connection: mysql.Connection,
  target: Target,
): Promise<boolean> {
  const query = (sql: string, params: string[]) =>
    connection
      .query(sql, params)
      .then(([rows]) => (rows as { c: number }[])[0].c > 0);

  switch (target.kind) {
    case 'TABLE':
      return query(
        'SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE table_schema = DATABASE() AND table_name = ?',
        [target.table],
      );
    case 'COLUMN':
      return query(
        'SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
        [target.table, target.column],
      );
    case 'PRIMARY_KEY':
      return query(
        "SELECT COUNT(*) AS c FROM information_schema.TABLE_CONSTRAINTS WHERE table_schema = DATABASE() AND table_name = ? AND constraint_type = 'PRIMARY KEY'",
        [target.table],
      );
    case 'CONSTRAINT':
      return query(
        'SELECT COUNT(*) AS c FROM information_schema.TABLE_CONSTRAINTS WHERE table_schema = DATABASE() AND table_name = ? AND constraint_name = ?',
        [target.table, target.constraint],
      );
    case 'AUTO_INCREMENT':
      return query(
        "SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? AND EXTRA LIKE '%auto_increment%'",
        [target.table, target.column],
      );
    case 'TRIGGER':
      return query(
        'SELECT COUNT(*) AS c FROM information_schema.TRIGGERS WHERE trigger_schema = DATABASE() AND trigger_name = ?',
        [target.name],
      );
  }
}

function readBlocks(name: string): Block[] {
  return parseBlocks(readFileSync(join(SQL_DIR, `${name}.sql`), 'utf8'));
}

/**
 * Reverts the first `succeededCount` blocks of a file, in reverse order,
 * skipping any whose target already existed before this run (not this
 * run's to touch) — see the module doc comment's "Revert-on-failure"
 * section for the full explanation of why `existedBefore` gates this.
 */
async function revertBlocks(
  connection: mysql.Connection,
  downBlocks: Block[],
  existedBefore: boolean[],
  succeededCount: number,
  label: string,
): Promise<void> {
  const total = downBlocks.length;
  for (let i = succeededCount - 1; i >= 0; i--) {
    if (existedBefore[i]) {
      console.log(
        `  [${label}] skip (${total - i}/${total}) ${describeTarget(downBlocks[total - 1 - i].target)} — already existed before this run`,
      );
      continue;
    }
    const downBlock = downBlocks[total - 1 - i];
    console.log(
      `  [${label}] (${total - i}/${total}) ${describeTarget(downBlock.target)}`,
    );
    for (const statement of downBlock.statements) {
      await connection.query(statement);
    }
  }
}

type ParsedArgs = {
  init: boolean;
  start: number | null;
  end: number | null;
};

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = { init: false, start: null, end: null };
  for (const arg of argv) {
    if (arg === '--init') {
      result.init = true;
      continue;
    }
    const range = arg.match(/^--m(\d+)-m(\d+)$/);
    if (range) {
      result.start = Number(range[1]);
      result.end = Number(range[2]);
      continue;
    }
    const single = arg.match(/^--m(\d+)$/);
    if (single) {
      result.start = 1;
      result.end = Number(single[1]);
      continue;
    }
    throw new Error(`Unrecognized argument: ${arg}`);
  }
  if (result.start === null && !result.init) {
    // No flags at all -> default to m1 only.
    result.start = 1;
    result.end = 1;
  }
  if (
    result.start !== null &&
    result.end !== null &&
    result.start > result.end
  ) {
    throw new Error(`Range start m${result.start} is after end m${result.end}`);
  }
  return result;
}

function migrationNames(start: number, end: number): string[] {
  const names: string[] = [];
  for (let i = start; i <= end; i++) names.push(`m${i}`);
  return names;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const requestedNames =
    args.start !== null && args.end !== null
      ? migrationNames(args.start, args.end)
      : [];

  // Fail fast on missing files before touching the database at all.
  const filesPresent = new Set(readdirSync(SQL_DIR));
  for (const name of requestedNames) {
    if (!filesPresent.has(`${name}.sql`)) {
      throw new Error(`${name}.sql not found in database/sql-migrations/`);
    }
    if (!filesPresent.has(`${name}.down.sql`)) {
      throw new Error(`${name}.down.sql not found in database/sql-migrations/`);
    }
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? 'finance_crm_backend',
    multipleStatements: false,
  });

  try {
    if (args.init) {
      console.log('Running init.sql...');
      const statements = parseStatements(
        readFileSync(join(SQL_DIR, 'init.sql'), 'utf8'),
      );
      try {
        for (const [index, statement] of statements.entries()) {
          console.log(
            `  [init] (${index + 1}/${statements.length}) ${statement.slice(0, 100)}${statement.length > 100 ? '...' : ''}`,
          );
          await connection.query(statement);
        }
      } catch (error) {
        console.error(
          '\ninit.sql failed partway through. There is no automatic revert ' +
            "for the baseline install (see init.sql's header) — drop this " +
            'database and start over with a fresh empty one before retrying.',
        );
        throw error;
      }
      console.log('init.sql applied successfully.\n');
    }

    const completedFiles: {
      name: string;
      downBlocks: Block[];
      existedBefore: boolean[];
    }[] = [];

    for (const name of requestedNames) {
      const upBlocks = readBlocks(name);
      const downBlocks = readBlocks(`${name}.down`);
      if (downBlocks.length !== upBlocks.length) {
        throw new Error(
          `${name}.sql has ${upBlocks.length} block(s) but ${name}.down.sql has ${downBlocks.length} — they must match for revert to work. Fix the down file before running this.`,
        );
      }

      console.log(`Running ${name}.sql...`);
      const existedBefore: boolean[] = [];
      for (const block of upBlocks) {
        existedBefore.push(await targetExists(connection, block.target));
      }

      let succeeded = 0;
      try {
        for (const [index, block] of upBlocks.entries()) {
          const note = existedBefore[index] ? ' (already exists, no-op)' : '';
          console.log(
            `  [${name}] (${index + 1}/${upBlocks.length}) ${describeTarget(block.target)}${note}`,
          );
          for (const statement of block.statements) {
            await connection.query(statement);
          }
          succeeded++;
        }
      } catch (error) {
        console.error(
          `\n${name}.sql failed on block ${succeeded + 1}/${upBlocks.length}. Reverting...`,
        );
        try {
          await revertBlocks(
            connection,
            downBlocks,
            existedBefore,
            succeeded,
            `${name}.down (partial)`,
          );
        } catch (revertError) {
          console.error(
            `\nFAILED TO FULLY REVERT ${name}.sql — the database is now in ` +
              'an inconsistent state and needs manual inspection.',
          );
          throw revertError;
        }

        for (const previous of [...completedFiles].reverse()) {
          console.error(`Reverting previously-applied ${previous.name}.sql...`);
          await revertBlocks(
            connection,
            previous.downBlocks,
            previous.existedBefore,
            previous.downBlocks.length,
            `${previous.name}.down (full)`,
          );
        }

        console.error(
          `\nReverted everything this run applied (${[...completedFiles.map((f) => f.name), name].join(', ')}). ` +
            'Database is back to its state before this invocation started.',
        );
        throw error;
      }

      completedFiles.push({ name, downBlocks, existedBefore });
      console.log(`${name}.sql applied successfully.\n`);
    }

    console.log('All requested migrations applied successfully.');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(
    '\nMigration run failed:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
