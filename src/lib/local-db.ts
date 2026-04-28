import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "local.db");

let _db: Database.Database | null = null;

function getLocalDb() {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  return _db;
}

// Initialize tables if they don't exist
function initTables() {
  const db = getLocalDb();
  const migration = fs.readFileSync(
    path.join(process.cwd(), "prisma", "migration.sql"),
    "utf-8"
  );

  // Split by semicolons and run each statement, ignoring errors for "already exists"
  const statements = migration
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      db.exec(stmt);
    } catch {
      // table already exists, ignore
    }
  }
}

// D1-compatible wrapper around better-sqlite3
class D1PreparedStatement {
  private stmt: string;
  private params: unknown[] = [];
  private db: Database.Database;

  constructor(db: Database.Database, sql: string) {
    this.db = db;
    this.stmt = sql;
  }

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async all<T>() {
    const rows = this.db.prepare(this.stmt).all(...this.params) as T[];
    return { results: rows };
  }

  async first<T>() {
    return (this.db.prepare(this.stmt).get(...this.params) as T) || null;
  }

  async run() {
    const info = this.db.prepare(this.stmt).run(...this.params);
    return {
      success: true,
      meta: { changes: info.changes, last_row_id: info.lastInsertRowid },
    };
  }
}

class LocalD1Database {
  private db: Database.Database;

  constructor() {
    this.db = getLocalDb();
    initTables();
  }

  prepare(sql: string) {
    return new D1PreparedStatement(this.db, sql);
  }
}

export function getLocalD1() {
  return new LocalD1Database() as unknown as D1Database;
}
