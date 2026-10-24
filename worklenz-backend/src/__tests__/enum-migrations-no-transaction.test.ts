/**
 * Enum migrations must run outside a transaction.
 *
 * PostgreSQL refuses `ALTER TYPE ... ADD VALUE` inside a transaction
 * block, and node-pg-migrate wraps every migration in one unless the
 * migration opts out. These four migrations only add enum values, so
 * each must call `pgm.noTransaction()` before any `pgm.sql()`.
 * Without it the whole pending batch aborts at the first enum
 * migration and nothing after it (including the Client Portal
 * schema) is ever applied.
 */
const ENUM_MIGRATIONS = [
  "1790553600000_add_attachments_task_list_column",
  "1790652600000_add_comments_task_list_column",
  "1790676000000_add_polish_language_to_enum",
  "1790679600000_add_french_language_to_enum",
];

interface EnumMigrationPgm {
  noTransaction(): void;
  sql(statement: string): void;
}

function loadMigration(name: string): { up: (pgm: EnumMigrationPgm) => Promise<unknown> } {
  // Migration files are plain CommonJS with no side effects on require.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require(`../../database/pg-migrations/${name}.js`) as {
    up?: (pgm: EnumMigrationPgm) => Promise<unknown>;
  };
  if (typeof mod.up !== "function") {
    throw new Error(`Migration ${name} does not export an up() function`);
  }
  return { up: mod.up };
}

describe("enum migrations run outside a transaction", () => {
  it.each(ENUM_MIGRATIONS)(
    "%s calls pgm.noTransaction() before pgm.sql()",
    async (name) => {
      const calls: string[] = [];
      const pgm = {
        noTransaction: () => {
          calls.push("noTransaction");
        },
        sql: () => {
          calls.push("sql");
        },
      };
      await loadMigration(name).up(pgm);
      expect(calls).toEqual(["noTransaction", "sql"]);
    },
  );

  it("each enum migration up() issues exactly one ADD VALUE statement", async () => {
    for (const name of ENUM_MIGRATIONS) {
      const statements: string[] = [];
      const pgm = {
        noTransaction: () => undefined,
        sql: (sql: string) => {
          statements.push(sql);
        },
      };
      await loadMigration(name).up(pgm);
      expect(statements).toHaveLength(1);
      expect(statements[0]).toMatch(/ALTER TYPE/i);
      expect(statements[0]).toMatch(/ADD VALUE/i);
    }
  });
});
