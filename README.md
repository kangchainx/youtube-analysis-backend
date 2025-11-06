# YouTube Analysis Backend

Node.js REST API service designed to pair with a React, TypeScript, and Vite front-end for YouTube analytics features.

The backend provides Google OAuth 2.0 single sign-on, persists user and session data in PostgreSQL, and exposes a video export service that produces CSV or Excel files for download.

如果你喜欢这个项目或者它对你有帮助，请点亮一个 star，每一个 star 对我意义非凡。

If you enjoy this project or find it helpful, please consider giving it a star; each one means a great deal to me.

## Getting Started

```bash
npm install
npm run dev
```

By default the server listens on [http://localhost:5001](http://localhost:5001). Update `.env` based on `.env.example` if you need custom values.

## Docker

Build the production image from the repository root:

```bash
docker build -t youtube-analysis-backend .
```

Run the container in the background (exposes port 5001 by default) and load environment variables from `.env`:

```bash
docker run -d --name youtube-analysis-backend -p 5001:5001 --env-file .env youtube-analysis-backend
```

Override configuration by adjusting the port mapping (e.g. `-p 8080:5001`) or by appending `-e KEY=value` flags to supply alternate secrets and runtime values when needed.

### Environment variables

Copy `.env.example` to `.env` and adjust the following keys as needed:

- `PORT` — Optional HTTP port (defaults to 5001).
- `CLIENT_ORIGIN` — Front-end origin allowed via CORS (defaults to `http://localhost:5173`).
- `GOOGLE_CLIENT_ID` — OAuth 2.0 client ID from Google Cloud.
- `GOOGLE_CLIENT_SECRET` — OAuth 2.0 client secret.
- `GOOGLE_REDIRECT_URI` — Callback URL registered in Google (defaults to `http://localhost:5001/api/auth/google/callback`).
- `GOOGLE_AUTH_SCOPES` — Comma separated scopes (defaults to `openid,profile,email`).
- `JWT_SECRET` — Random string used to sign session JWTs (generate a strong secret!).
- `JWT_EXPIRES_IN` — Lifetime for issued session JWTs (e.g. `7d`).
- `SESSION_COOKIE_NAME` — Name for the HttpOnly session cookie (defaults to `ya_session`).
- `SESSION_COOKIE_SECURE` — `true` to issue secure cookies (recommended in production).
- `SESSION_COOKIE_SAMESITE` — Cookie same-site policy (`lax`/`strict`/`none`).
- `SESSION_COOKIE_DOMAIN` — Optional cookie domain override for production.
- `DB_HOST` — PostgreSQL host (defaults to `localhost`).
- `DB_PORT` — PostgreSQL port (defaults to `5432`).
- `DB_USER` — Database user.
- `DB_PASSWORD` — Database password.
- `DB_NAME` — Database name.

### Available scripts

- `npm run dev` — start the development server with hot reload via `ts-node-dev`.
- `npm run build` — type-check and emit production ready JavaScript into `dist/`.
- `npm start` — run the compiled server from `dist/`.

## API Overview

All routes are prefixed with `/api`.

| Method | Route                    | Description                                                          |
| ------ | ------------------------ | -------------------------------------------------------------------- |
| GET    | `/health`                | Service availability info                                            |
| GET    | `/videos`                | Example list endpoint                                                |
| POST   | `/videos`                | Example create endpoint                                              |
| GET    | `/videos/:id`            | Example detail endpoint                                              |
| POST   | `/auth/google/init`      | Generate a Google OAuth authorization URL plus front-end metadata    |
| POST   | `/auth/google/callback`  | Exchange Google authorization code, verify ID token, start a session |
| POST   | `/auth/login/password`   | Authenticate with username/password and issue a session              |
| POST   | `/auth/logout`           | Clear the active session, optionally revoke Google access            |
| GET    | `/users/me`              | Return the authenticated user's profile                              |
| PATCH  | `/users/me`              | Update name, email, avatar, or password for the authenticated user   |
| POST   | `/export/videos?format=` | Export videos to CSV (`format=csv`) or Excel (`format=excel`)        |

Replace the sample video routes with your domain specific logic as you integrate with YouTube data sources.

### Password-based authentication

- `POST /api/auth/login/password` expects `{"username": string, "password": string}` and responds with the same payload shape as the Google callback (`user`, `token`, `scope`, `expiresIn`). The username currently maps to the stored user email (case-insensitive). On success the session cookie is set using the same configuration as Google sign-in. Invalid credentials return HTTP 401 with a readable `message`.
- `PATCH /api/users/me` now accepts optional `name`, `email`, `avatar`, `password`, and (when updating the password) `currentPassword`. Unsubmitted fields remain unchanged. Password updates require at least 8 characters and, if a password is already set, the correct `currentPassword`. Email changes enforce uniqueness (case-insensitive) and must match a basic email format. Clearing the avatar can be done by sending `"avatar": null`.

> **Note:** Default database credentials in `.env.example` target a local PostgreSQL instance; update them to match your environment and ensure suitable security for production.

### Database schema

Create the `users` and `sessions` tables (or adjust them to include the columns below) before starting the server. Add the `avatar_url` and `password_hash` columns if you already have a deployed database so profile photos and local passwords can be persisted:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
```

Example full DDL for a fresh install:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  id_token TEXT NOT NULL,
  scope TEXT,
  token_type TEXT,
  expiry_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);

CREATE TABLE IF NOT EXISTS spotlight_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle TEXT UNIQUE NOT NULL,
  channel_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  total_views NUMERIC,
  total_subscribers NUMERIC,
  order_index INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spotlight_channels_active_order
  ON spotlight_channels (order_index, updated_at DESC)
  WHERE is_active = TRUE;
```

## Project Structure

```
src/
  app.ts              // Express app factory
  server.ts           // Entry point for the HTTP server
  config/env.ts       // Environment variable parsing
  middleware/         // Common Express middlewares (errors, etc.)
  models/user.ts      // Lightweight user model
  routes/auth.ts      // Google SSO endpoints
  routes/export.ts    // Video export endpoints
  routes/             // REST route definitions
  services/           // Auth, Google, session helpers
  utils/              // Shared utilities (time, errors)
```

Feel free to extend this structure with services, repositories, or additional modules as requirements evolve.
