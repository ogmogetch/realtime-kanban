import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function waitForDb(retries = 20, delayMs = 500): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

const MIGRATIONS: Array<{ name: string; sql: string }> = [
  {
    name: '002_user_profile',
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_color TEXT NOT NULL DEFAULT '#6366f1';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS background TEXT;
    `,
  },
  {
    name: '003_board_background',
    sql: `
      ALTER TABLE boards ADD COLUMN IF NOT EXISTS background TEXT;
      ALTER TABLE boards ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';
    `,
  },
  {
    name: '004_card_assignees',
    sql: `
      CREATE TABLE IF NOT EXISTS card_assignees (
        card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (card_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_card_assignees_card ON card_assignees(card_id);
    `,
  },
  {
    name: '005_card_events',
    sql: `
      CREATE TABLE IF NOT EXISTS card_events (
        id         TEXT PRIMARY KEY,
        card_id    TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        board_id   TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
        kind       TEXT NOT NULL,
        meta       JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_card_events_card ON card_events(card_id, created_at DESC);
    `,
  },
];

export async function runMigrations(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  for (const m of MIGRATIONS) {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM schema_migrations WHERE name = $1`,
      [m.name]
    );
    if ((rowCount ?? 0) > 0) continue;
    console.log(`[db] applying migration ${m.name}`);
    await pool.query(m.sql);
    await pool.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [m.name]);
  }
}
