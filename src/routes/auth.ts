import type { CookieOptions, Request } from "express";
import { Router } from "express";
import { config } from "../config/env";
import {
  GoogleOAuthService,
  type AuthorizationUrlOptions,
} from "../services/googleOAuth";
import { UserService } from "../services/userService";
import { SessionService } from "../services/sessionService";
import { AppError } from "../utils/appError";
import { parseDurationToMs } from "../utils/time";
import { pool } from "../database/pool";

export const authRouter = Router();

const googleOAuthService = new GoogleOAuthService(config.googleOAuth);
const userService = new UserService(pool);
const sessionService = new SessionService(config.session, pool);

function parseAuthorizationOptionsFromBody(
  body: unknown,
): AuthorizationUrlOptions {
  if (!body || typeof body !== "object") {
    return {};
  }

  const record = body as Record<string, unknown>;
  const options: AuthorizationUrlOptions = {};

  if (typeof record.state === "string") {
    options.state = record.state;
  }

  if (typeof record.prompt === "string") {
    const prompt = record.prompt;
    if (prompt === "none" || prompt === "consent" || prompt === "select_account") {
      options.prompt = prompt;
    }
  }

  if (typeof record.accessType === "string") {
    const accessType = record.accessType;
    if (accessType === "online" || accessType === "offline") {
      options.accessType = accessType;
    }
  }

  if (typeof record.includeGrantedScopes === "boolean") {
    options.includeGrantedScopes = record.includeGrantedScopes;
  } else if (typeof record.includeGrantedScopes === "string") {
    options.includeGrantedScopes = record.includeGrantedScopes === "true";
  }

  if (typeof record.hd === "string" && record.hd.length > 0) {
    options.hd = record.hd;
  }

  return options;
}

function cookieOptions(includeMaxAge = true): CookieOptions {
  const maxAge = parseDurationToMs(config.session.jwtExpiresIn) ?? undefined;

  const options: CookieOptions = {
    httpOnly: true,
    sameSite: config.session.cookieSameSite,
    secure: config.session.cookieSecure,
  };

  if (config.session.cookieDomain) {
    options.domain = config.session.cookieDomain;
  }

  if (includeMaxAge && typeof maxAge === "number") {
    options.maxAge = maxAge;
  }

  return options;
}

function extractSessionToken(req: Request): string | undefined {
  const authorization = req.headers.authorization;
  if (authorization && authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  const cookieToken = req.cookies?.[config.session.cookieName];
  if (typeof cookieToken === "string" && cookieToken.length > 0) {
    return cookieToken;
  }

  if (typeof req.body?.token === "string") {
    return req.body.token;
  }

  return undefined;
}

function normalizeRevokeFlag(input: unknown): boolean {
  if (typeof input === "boolean") {
    return input;
  }

  if (typeof input === "string") {
    return input.toLowerCase() === "true";
  }

  return false;
}

authRouter.post("/google/init", (req, res, next) => {
  try {
    const options = parseAuthorizationOptionsFromBody(req.body);
    const url = googleOAuthService.generateAuthorizationUrl(options);
    res.json({
      authorizationUrl: url,
      clientId: config.googleOAuth.clientId,
      redirectUri: config.googleOAuth.redirectUri,
      scopes: config.googleOAuth.scopes,
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/google/callback", async (req, res, next) => {
  try {
    const code =
      typeof req.body?.code === "string"
        ? req.body.code
        : typeof req.query.code === "string"
          ? req.query.code
          : undefined;
    if (!code) {
      throw new AppError("Missing authorization code", {
        statusCode: 400,
        code: "MISSING_AUTH_CODE",
      });
    }

    const { tokens, profile } =
      await googleOAuthService.exchangeCodeForTokens(code);

    const user = await userService.findOrCreateFromGoogleProfile(profile);
    const { session, token } = await sessionService.createSession(user, tokens);

    const cookieConfig = cookieOptions(true);
    res.cookie(config.session.cookieName, token, cookieConfig);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.displayName,
        emailVerified: profile.emailVerified,
      },
      token,
      scope: tokens.scope ?? null,
      state:
        typeof req.body?.state === "string"
          ? req.body.state
          : typeof req.query.state === "string"
            ? req.query.state
            : undefined,
      expiresIn: config.session.jwtExpiresIn,
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const token = extractSessionToken(req);
    if (!token) {
      throw new AppError("Session token is required to log out", {
        statusCode: 401,
        code: "SESSION_TOKEN_REQUIRED",
      });
    }

    const session = await sessionService.verifyToken(token);

    const shouldRevoke =
      normalizeRevokeFlag(req.body?.revoke) ||
      normalizeRevokeFlag(req.query.revoke);

    if (shouldRevoke) {
      const revokeToken =
        session.tokens.refreshToken ?? session.tokens.accessToken;
      if (revokeToken) {
        try {
          await googleOAuthService.revokeToken(revokeToken);
        } catch (error) {
          console.warn("Failed to revoke Google token", error);
        }
      }
    }

    await sessionService.invalidate(session.id);
    res.clearCookie(config.session.cookieName, cookieOptions(false));

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
