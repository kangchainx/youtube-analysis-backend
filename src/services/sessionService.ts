import jwt, { type SignOptions } from "jsonwebtoken";
import { randomUUID } from "crypto";
import type { Pool } from "pg";
import type { SessionConfig } from "../config/env";
import type { GoogleTokens } from "./googleOAuth";
import type { User } from "../models/user";
import { AppError } from "../utils/appError";

export interface SessionRecord {
  id: string;
  user: User;
  tokens: GoogleTokens;
  createdAt: string;
  updatedAt: string;
}

export interface SessionJwtPayload extends jwt.JwtPayload {
  sid: string;
  sub: string;
}

interface SessionWithUserRow {
  session_id: string;
  access_token: string;
  refresh_token: string | null;
  id_token: string;
  scope: string | null;
  token_type: string | null;
  expiry_date: Date | null;
  session_created_at: Date;
  session_updated_at: Date;
  user_id: string;
  user_google_id: string;
  user_email: string;
  user_display_name: string | null;
  user_avatar_url: string | null;
  user_created_at: Date;
  user_updated_at: Date;
}

export class SessionService {
  constructor(
    private readonly config: SessionConfig,
    private readonly pool: Pool,
  ) {}

  async createSession(user: User, tokens: GoogleTokens): Promise<{
    session: SessionRecord;
    token: string;
  }> {
    const now = new Date();
    const sessionId = randomUUID();

    await this.pool.query(
      `INSERT INTO sessions (
         id,
         user_id,
         access_token,
         refresh_token,
         id_token,
         scope,
         token_type,
         expiry_date,
         created_at,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
      [
        sessionId,
        user.id,
        tokens.accessToken,
        tokens.refreshToken ?? null,
        tokens.idToken,
        tokens.scope ?? null,
        tokens.tokenType ?? null,
        tokens.expiryDate ? new Date(tokens.expiryDate) : null,
        now,
      ],
    );

    const normalizedTokens: GoogleTokens = {
      accessToken: tokens.accessToken,
      idToken: tokens.idToken,
      ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
      ...(tokens.scope ? { scope: tokens.scope } : {}),
      ...(tokens.tokenType ? { tokenType: tokens.tokenType } : {}),
      ...(tokens.expiryDate ? { expiryDate: tokens.expiryDate } : {}),
    };

    const session: SessionRecord = {
      id: sessionId,
      user,
      tokens: normalizedTokens,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const token = this.signSessionJwt(session);
    return { session, token };
  }

  async invalidate(sessionId: string): Promise<void> {
    await this.pool.query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
  }

  async verifyToken(token: string): Promise<SessionRecord> {
    try {
      const payload = jwt.verify(
        token,
        this.config.jwtSecret,
      ) as SessionJwtPayload;

      if (!payload.sid || typeof payload.sid !== "string") {
        throw new AppError("Session token missing sid", {
          statusCode: 401,
          code: "INVALID_SESSION",
        });
      }

      const session = await this.fetchSessionById(payload.sid);
      if (!session) {
        throw new AppError("Session expired or invalid", {
          statusCode: 401,
          code: "SESSION_EXPIRED",
        });
      }

      if (payload.sub !== session.user.id) {
        throw new AppError("Session user mismatch", {
          statusCode: 401,
          code: "SESSION_INVALID_SUBJECT",
        });
      }

      return session;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Invalid session token", {
        statusCode: 401,
        code: "INVALID_SESSION_TOKEN",
      });
    }
  }

  private async fetchSessionById(sessionId: string): Promise<SessionRecord | undefined> {
    const result = await this.pool.query<SessionWithUserRow>(
      `SELECT
         s.id AS session_id,
         s.access_token,
         s.refresh_token,
         s.id_token,
         s.scope,
         s.token_type,
         s.expiry_date,
         s.created_at AS session_created_at,
         s.updated_at AS session_updated_at,
         u.id AS user_id,
         u.google_id AS user_google_id,
         u.email AS user_email,
         u.display_name AS user_display_name,
         u.avatar_url AS user_avatar_url,
         u.created_at AS user_created_at,
         u.updated_at AS user_updated_at
       FROM sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [sessionId],
    );

    const row = result.rows[0];
    if (!row) {
      return undefined;
    }

    return mapSessionWithUserRow(row);
  }

  private signSessionJwt(session: SessionRecord): string {
    const payload: SessionJwtPayload = {
      sid: session.id,
      sub: session.user.id,
    };

    const options: SignOptions = {};
    options.expiresIn = this.config.jwtExpiresIn as NonNullable<SignOptions["expiresIn"]>;

    return jwt.sign(payload, this.config.jwtSecret, options);
  }
}

function mapSessionWithUserRow(row: SessionWithUserRow): SessionRecord {
  const tokens: GoogleTokens = {
    accessToken: row.access_token,
    idToken: row.id_token,
    ...(row.refresh_token ? { refreshToken: row.refresh_token } : {}),
    ...(row.scope ? { scope: row.scope } : {}),
    ...(row.token_type ? { tokenType: row.token_type } : {}),
    ...(row.expiry_date ? { expiryDate: row.expiry_date.getTime() } : {}),
  };

  const user: User = {
    id: row.user_id,
    googleId: row.user_google_id,
    email: row.user_email,
    displayName: row.user_display_name,
    avatarUrl: row.user_avatar_url,
    createdAt: row.user_created_at.toISOString(),
    updatedAt: row.user_updated_at.toISOString(),
  };

  return {
    id: row.session_id,
    user,
    tokens,
    createdAt: row.session_created_at.toISOString(),
    updatedAt: row.session_updated_at.toISOString(),
  };
}
