import Database from 'better-sqlite3';

// Fixture only — the payments service still runs on SQLite.
export const db = new Database('payments.db');
