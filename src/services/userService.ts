import { randomUUID } from "crypto";
import type { Pool } from "pg";
import type { GoogleUserProfile } from "./googleOAuth";
import type { User } from "../models/user";

interface UserRow {
  id: string;
  google_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
}

interface UserWithPasswordRow extends UserRow {
  password_hash: string | null;
}

export class UserService {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<User | undefined> {
    const result = await this.pool.query<UserRow>(
      `SELECT id, google_id, email, display_name, avatar_url, created_at, updated_at
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
      `SELECT id, google_id, email, display_name, avatar_url, created_at, updated_at
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

  async findByEmail(email: string): Promise<User | undefined> {
    const result = await this.pool.query<UserRow>(
      `SELECT id, google_id, email, display_name, avatar_url, created_at, updated_at
       FROM users
       WHERE LOWER(email) = LOWER($1)`,
      [email],
    );

    const row = result.rows[0];
    if (!row) {
      return undefined;
    }

    return mapUserRow(row);
  }

  async findByEmailWithPassword(
    email: string,
  ): Promise<{ user: User; passwordHash: string | null } | undefined> {
    const result = await this.pool.query<UserWithPasswordRow>(
      `SELECT id,
              google_id,
              email,
              display_name,
              avatar_url,
              password_hash,
              created_at,
              updated_at
       FROM users
       WHERE LOWER(email) = LOWER($1)`,
      [email],
    );

    const row = result.rows[0];
    if (!row) {
      return undefined;
    }

    return {
      user: mapUserRow(row),
      passwordHash: row.password_hash,
    };
  }

  async findByIdWithPassword(
    id: string,
  ): Promise<{ user: User; passwordHash: string | null } | undefined> {
    const result = await this.pool.query<UserWithPasswordRow>(
      `SELECT id,
              google_id,
              email,
              display_name,
              avatar_url,
              password_hash,
              created_at,
              updated_at
       FROM users
       WHERE id = $1`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      return undefined;
    }

    return {
      user: mapUserRow(row),
      passwordHash: row.password_hash,
    };
  }

  async createLocalUser(params: {
    email: string;
    displayName: string | null;
    passwordHash: string;
  }): Promise<User> {
    const now = new Date();
    const userId = randomUUID();
    const googleId = `local-${randomUUID()}`;

    const result = await this.pool.query<UserRow>(
      `INSERT INTO users (
         id,
         google_id,
         email,
         display_name,
         avatar_url,
         password_hash,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING id, google_id, email, display_name, avatar_url, created_at, updated_at`,
      [
        userId,
        googleId,
        params.email,
        params.displayName,
        null,
        params.passwordHash,
        now,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Unable to create user");
    }

    return mapUserRow(row);
  }

  async findOrCreateFromGoogleProfile(profile: GoogleUserProfile): Promise<User> {
    const now = new Date();
    const userId = randomUUID();

    const result = await this.pool.query<UserRow>(
      `INSERT INTO users (id, google_id, email, display_name, avatar_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT (google_id)
       DO UPDATE SET
         email = EXCLUDED.email,
         display_name = COALESCE(EXCLUDED.display_name, users.display_name),
         avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
         updated_at = EXCLUDED.updated_at
       RETURNING id, google_id, email, display_name, avatar_url, created_at, updated_at`,
      [
        userId,
        profile.id,
        profile.email,
        profile.name ?? null,
        profile.picture ?? null,
        now,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Unable to create or retrieve user record");
    }

    return mapUserRow(row);
  }

  async updateProfile(
    id: string,
    updates: {
      name?: string | null;
      picture?: string | null;
      email?: string;
      passwordHash?: string | null;
    },
  ): Promise<User> {
    const assignments: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      assignments.push(`display_name = $${assignments.length + 1}`);
      values.push(updates.name);
    }

    if (updates.picture !== undefined) {
      assignments.push(`avatar_url = $${assignments.length + 1}`);
      values.push(updates.picture);
    }

    if (updates.email !== undefined) {
      assignments.push(`email = $${assignments.length + 1}`);
      values.push(updates.email);
    }

    if (updates.passwordHash !== undefined) {
      assignments.push(`password_hash = $${assignments.length + 1}`);
      values.push(updates.passwordHash);
    }

    if (assignments.length === 0) {
      throw new Error("No user profile updates provided");
    }

    const updatedAtIndex = assignments.length + 1;
    assignments.push(`updated_at = $${updatedAtIndex}`);
    const now = new Date();
    values.push(now);

    const idIndex = assignments.length + 1;
    values.push(id);

    const result = await this.pool.query<UserRow>(
      `UPDATE users
       SET ${assignments.join(", ")}
       WHERE id = $${idIndex}
       RETURNING id, google_id, email, display_name, avatar_url, created_at, updated_at`,
      values,
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Unable to update user profile");
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
    avatarUrl: row.avatar_url,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
