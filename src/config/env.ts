import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  clientOrigin?: string;
  googleOAuth: GoogleOAuthConfig;
  session: SessionConfig;
  database: DatabaseConfig;
  youtube: YouTubeConfig;
  spotlight: SpotlightConfig;
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface YouTubeConfig {
  apiKey: string;
}

export interface SpotlightConfig {
  handles: string[];
}

export interface SessionConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  cookieName: string;
  cookieSecure: boolean;
  cookieSameSite: "lax" | "strict" | "none";
  cookieDomain?: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error("Environment variable PORT must be a positive integer");
  }

  return parsed;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }

  return value;
}

function parseGoogleScopes(raw: string | undefined): string[] {
  const defaultScopes = ["openid", "profile", "email"];
  if (!raw) {
    return defaultScopes;
  }

  const scopes = raw
    .split(",")
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);

  return scopes.length > 0 ? scopes : defaultScopes;
}

function loadGoogleConfig(): GoogleOAuthConfig {
  return {
    clientId: requireEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    redirectUri: requireEnv("GOOGLE_REDIRECT_URI"),
    scopes: parseGoogleScopes(process.env.GOOGLE_AUTH_SCOPES),
  };
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }

  return fallback;
}

function parseSameSite(value: string | undefined): "lax" | "strict" | "none" {
  if (!value) {
    return "lax";
  }

  const normalized = value.toLowerCase();

  if (normalized === "lax" || normalized === "strict" || normalized === "none") {
    return normalized;
  }

  throw new Error(
    `Environment variable SESSION_COOKIE_SAMESITE must be one of lax|strict|none`,
  );
}

function loadSessionConfig(): SessionConfig {
  const sameSite = parseSameSite(process.env.SESSION_COOKIE_SAMESITE);
  const cookieDomain = process.env.SESSION_COOKIE_DOMAIN;

  const baseConfig: SessionConfig = {
    jwtSecret: requireEnv("JWT_SECRET"),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
    cookieName: process.env.SESSION_COOKIE_NAME ?? "ya_session",
    cookieSecure: parseBooleanEnv(
      process.env.SESSION_COOKIE_SECURE,
      process.env.NODE_ENV === "production",
    ),
    cookieSameSite: sameSite,
  };

  if (cookieDomain) {
    return { ...baseConfig, cookieDomain };
  }

  return baseConfig;
}

function loadDatabaseConfig(): DatabaseConfig {
  return {
    host: process.env.DB_HOST ?? "localhost",
    port: parsePort(process.env.DB_PORT, 5432),
    user: requireEnv("DB_USER"),
    password: requireEnv("DB_PASSWORD"),
    name: requireEnv("DB_NAME"),
  };
}

function loadYouTubeConfig(): YouTubeConfig {
  return {
    apiKey: requireEnv("YOUTUBE_API_KEY"),
  };
}

function parseHandles(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((handle) => handle.trim())
    .filter((handle) => handle.length > 0);
}

function loadSpotlightConfig(): SpotlightConfig {
  return {
    handles: parseHandles(process.env.SPOTLIGHT_CHANNEL_HANDLES),
  };
}

export function loadConfig(): AppConfig {
  const port = parsePort(process.env.PORT, 5001);

  const appConfig: AppConfig = {
    port,
    nodeEnv: process.env.NODE_ENV ?? "development",
    googleOAuth: loadGoogleConfig(),
    session: loadSessionConfig(),
    database: loadDatabaseConfig(),
    youtube: loadYouTubeConfig(),
    spotlight: loadSpotlightConfig(),
  };

  if (process.env.CLIENT_ORIGIN) {
    appConfig.clientOrigin = process.env.CLIENT_ORIGIN;
  }

  return appConfig;
}

export const config = loadConfig();
