import { Database } from "bun:sqlite";
import fs from "fs";
import path from "path";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "prisma",
  "migration.sql"
);

class TestD1PreparedStatement {
  private stmt: string;
  private params: unknown[] = [];
  private db: Database;

  constructor(db: Database, sql: string) {
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

class TestD1Database {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  prepare(sql: string) {
    return new TestD1PreparedStatement(this.db, sql);
  }
}

export function createTestDb() {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");

  const migration = fs.readFileSync(MIGRATION_PATH, "utf-8");
  const statements = migration
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      db.exec(stmt);
    } catch {
      // ignore "already exists" errors from ALTER TABLE etc.
    }
  }

  return new TestD1Database(db) as unknown as D1Database;
}
