import { randomUUID } from "crypto";
import type { Pool } from "pg";
import type { GoogleUserProfile } from "./googleOAuth";
import type { User } from "../models/user";

interface UserRow {
  id: string;
  google_id: string;
  email: string;
  display_name: string | null;
  created_at: Date;
  updated_at: Date;
}

export class UserService {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<User | undefined> {
    const result = await this.pool.query<UserRow>(
      `SELECT id, google_id, email, display_name, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      return undefined;
    }

    return mapUserRow(row);
  }

  async findByGoogleId(googleId: string): Promise<User | undefined> {
    const result = await this.pool.query<UserRow>(
      `SELECT id, google_id, email, display_name, created_at, updated_at
       FROM users
       WHERE google_id = $1`,
      [googleId],
    );

    const row = result.rows[0];
    if (!row) {
      return undefined;
    }

    return mapUserRow(row);
  }

  async findOrCreateFromGoogleProfile(profile: GoogleUserProfile): Promise<User> {
    const now = new Date();
    const userId = randomUUID();

    const result = await this.pool.query<UserRow>(
      `INSERT INTO users (id, google_id, email, display_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)
       ON CONFLICT (google_id)
       DO UPDATE SET
         email = EXCLUDED.email,
         display_name = COALESCE(EXCLUDED.display_name, users.display_name),
         updated_at = EXCLUDED.updated_at
       RETURNING id, google_id, email, display_name, created_at, updated_at`,
      [userId, profile.id, profile.email, profile.name ?? null, now],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Unable to create or retrieve user record");
    }

    return mapUserRow(row);
  }
}

function mapUserRow(row: UserRow): User {
  return {
    id: row.id,
    googleId: row.google_id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
