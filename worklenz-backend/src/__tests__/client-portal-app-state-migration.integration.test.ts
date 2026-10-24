import { randomUUID } from 'crypto';
import { Pool } from 'pg';

interface Migration {
  up(pgm: { sql(statement: string): void }): void;
  down(pgm: { sql(statement: string): void }): void;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const migration: Migration = require('../../database/pg-migrations/1791454074122_client-portal-client-app-state');
const integration = process.env.TEST_CLIENT_PORTAL_MIGRATION_DATABASE_URL ? describe : describe.skip;

// Migration 1791454074122 must reconcile the legacy v1 notification-reads
// table (client_id, organization_team_id, notification_type, reference_id)
// with the v2 shape ((notification_id, contact_id) PK) without losing rows.
// This must point to a disposable database. Application DB_* credentials
// are never used.
integration('Client Portal app-state migration (legacy reads table)', () => {
  const schema = `cp_appstate_${randomUUID().replace(/-/g, '')}`;
  let pool: Pool;
  let admin: Pool;

  const apply = async (direction: 'up' | 'down') => {
    const statements: string[] = [];
    migration[direction]({ sql: statement => { statements.push(statement); } });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const sql of statements) await client.query(sql);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  };

  const columnNames = async (table: string): Promise<string[]> => {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
      [schema, table],
    );
    return rows.map((r: { column_name: string }) => r.column_name);
  };

  const tableExists = async (table: string): Promise<boolean> => {
    const { rows } = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
      [schema, table],
    );
    return rows.length > 0;
  };

  const seedParents = async () => {
    await admin.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    // Parent tables referenced by the migration's foreign keys. The
    // notifications stub carries the metadata column the project index
    // expression reads, mirroring the production table.
    await pool.query(`
      CREATE TABLE teams(id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
      CREATE TABLE clients(id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
      CREATE TABLE client_contacts(id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
      CREATE TABLE client_portal_notifications(id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), metadata JSONB);
      CREATE TABLE projects(id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
      CREATE TABLE client_portal_threads(id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
    `);
  };

  const seedLegacyV1Table = async () => {
    await pool.query(`
      CREATE TABLE client_portal_notification_reads (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        organization_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        notification_type VARCHAR(50) NOT NULL,
        reference_id UUID NOT NULL,
        read_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(client_id, organization_team_id, notification_type, reference_id)
      );
      INSERT INTO client_portal_notification_reads
        (client_id, organization_team_id, notification_type, reference_id)
      SELECT (SELECT id FROM clients LIMIT 1),
             (SELECT id FROM teams LIMIT 1),
             'request', uuid_generate_v4();
    `);
  };

  beforeEach(async () => {
    admin = new Pool({ connectionString: process.env.TEST_CLIENT_PORTAL_MIGRATION_DATABASE_URL });
    await admin.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({
      connectionString: process.env.TEST_CLIENT_PORTAL_MIGRATION_DATABASE_URL,
      options: `-c search_path=${schema},public`,
    });
    await seedParents();
    await pool.query(`INSERT INTO teams DEFAULT VALUES`);
    await pool.query(`INSERT INTO clients DEFAULT VALUES`);
  });

  afterEach(async () => {
    if (pool) await pool.end();
    if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); }
  });

  it('preserves a v1-shaped table under a legacy name and builds the v2 shape', async () => {
    await seedLegacyV1Table();
    await apply('up');

    expect(await tableExists('client_portal_notification_reads_legacy_v1')).toBe(true);
    expect(await tableExists('client_portal_notification_reads')).toBe(true);
    // Legacy row is preserved verbatim.
    const legacy = await pool.query(`SELECT notification_type FROM client_portal_notification_reads_legacy_v1`);
    expect(legacy.rows).toHaveLength(1);
    expect(legacy.rows[0].notification_type).toBe('request');
    // v2 shape carries the per-person key columns.
    expect(await columnNames('client_portal_notification_reads')).toEqual(
      expect.arrayContaining(['notification_id', 'contact_id', 'read_at']),
    );
    expect(await columnNames('client_portal_notification_reads')).not.toContain('client_id');
    // Companion tables are created.
    expect(await tableExists('client_portal_thread_client_reads')).toBe(true);
    expect(await tableExists('client_contact_notification_prefs')).toBe(true);
  });

  it('creates the v2 shape when the table is absent and no legacy backup', async () => {
    await apply('up');

    expect(await tableExists('client_portal_notification_reads')).toBe(true);
    expect(await tableExists('client_portal_notification_reads_legacy_v1')).toBe(false);
    expect(await columnNames('client_portal_notification_reads')).toEqual(
      expect.arrayContaining(['notification_id', 'contact_id', 'read_at']),
    );
  });

  it('leaves an already v2-shaped table alone and is rerunnable', async () => {
    await pool.query(`
      CREATE TABLE client_portal_notification_reads (
        notification_id UUID NOT NULL,
        contact_id UUID NOT NULL,
        read_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (notification_id, contact_id)
      );
    `);
    await apply('up');
    await apply('up');

    expect(await tableExists('client_portal_notification_reads_legacy_v1')).toBe(false);
    expect(await columnNames('client_portal_notification_reads')).toEqual(
      expect.arrayContaining(['notification_id', 'contact_id', 'read_at']),
    );
  });

  it('down drops the v2 tables but keeps the legacy backup', async () => {
    await seedLegacyV1Table();
    await apply('up');
    await apply('down');

    expect(await tableExists('client_portal_notification_reads')).toBe(false);
    expect(await tableExists('client_portal_thread_client_reads')).toBe(false);
    expect(await tableExists('client_contact_notification_prefs')).toBe(false);
    // History is preserved, not silently dropped with the v2 tables.
    expect(await tableExists('client_portal_notification_reads_legacy_v1')).toBe(true);
    const legacy = await pool.query(`SELECT COUNT(*)::int AS n FROM client_portal_notification_reads_legacy_v1`);
    expect(legacy.rows[0].n).toBe(1);
  });
});
