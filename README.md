# YouTube Analysis Backend

Node.js REST API service designed to pair with a React, TypeScript, and Vite front-end for YouTube analytics features.

The backend provides Google OAuth 2.0 single sign-on, persists user and session data in PostgreSQL, and exposes a video export service that produces CSV or Excel files for download.

## Getting Started

```bash
npm install
npm run dev
```

By default the server listens on [http://localhost:5001](http://localhost:5001). Update `.env` based on `.env.example` if you need custom values.

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
| POST   | `/auth/logout`           | Clear the active session, optionally revoke Google access            |
| POST   | `/export/videos?format=` | Export videos to CSV (`format=csv`) or Excel (`format=excel`)        |

Replace the sample video routes with your domain specific logic as you integrate with YouTube data sources.

> **Note:** Default database credentials in `.env.example` target a local PostgreSQL instance; update them to match your environment and ensure suitable security for production.

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
