import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema";

const { Pool } = pg;

export const pool = process.env.DATABASE_URL 
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

export const db = pool ? drizzle(pool, { schema }) : null;

export function getDb() {
  if (!db) {
    throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
  }
  return db;
}
