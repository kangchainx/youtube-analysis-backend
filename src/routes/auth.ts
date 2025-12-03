import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import type ms from "ms";
import type { SignOptions } from "jsonwebtoken";
import type { CookieOptions } from "express";
import { Router } from "express";
import { config } from "../config/env";
import type { AuthorizationUrlOptions, GoogleTokens } from "../services/googleOAuth";
import {
  googleOAuthService,
  sessionService,
  userService,
  youtubeChannelService,
  userChannelService,
} from "../services";
import type { User } from "../models/user";
import { AppError } from "../utils/appError";
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "../utils/password";
import { parseDurationToMs } from "../utils/time";
import { extractSessionToken } from "../utils/sessionToken";

export const authRouter = Router();

function parseAuthorizationOptionsFromBody(
  body: unknown,
): AuthorizationUrlOptions {
  // 只挑选白名单字段，避免前端误传参数污染 OAuth 请求
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

function resolveSessionMaxAgeMs(tokens?: GoogleTokens): number | undefined {
  const configuredMs = parseDurationToMs(config.session.jwtExpiresIn);
  const googleExpiresInMs =
    typeof tokens?.expiryDate === "number" ? tokens.expiryDate - Date.now() : undefined;

  // 当没有 refresh_token 时，使用 Google 返回的访问令牌寿命与配置寿命的较小值
  if (!tokens?.refreshToken && typeof googleExpiresInMs === "number") {
    const clampedGoogleMs = Math.max(googleExpiresInMs, 0);
    if (typeof configuredMs === "number") {
      return Math.min(configuredMs, clampedGoogleMs);
    }
    return clampedGoogleMs;
  }

  return configuredMs ?? googleExpiresInMs;
}

function cookieOptions(includeMaxAge = true, tokens?: GoogleTokens): CookieOptions {
  const maxAge = resolveSessionMaxAgeMs(tokens);

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

function normalizeRevokeFlag(input: unknown): boolean {
  if (typeof input === "boolean") {
    return input;
  }

  if (typeof input === "string") {
    return input.toLowerCase() === "true";
  }

  return false;
}

function buildLocalIdToken(user: User): string {
  const payload: Record<string, unknown> = {
    iss: "local-auth",
    sub: user.id,
    email: user.email,
    email_verified: true,
  };

  if (user.displayName) {
    payload.name = user.displayName;
  }

  if (user.avatarUrl) {
    payload.picture = user.avatarUrl;
  }

  const options: SignOptions = {
    expiresIn: config.session.jwtExpiresIn as ms.StringValue,
  };

  return jwt.sign(payload, config.session.jwtSecret, options);
}

function buildLocalAuthTokens(user: User): GoogleTokens {
  const idToken = buildLocalIdToken(user);
  const expiryMs = parseDurationToMs(config.session.jwtExpiresIn);

  const tokens: GoogleTokens = {
    accessToken: `local-${randomUUID()}`,
    idToken,
    tokenType: "Bearer",
  };

  if (typeof expiryMs === "number") {
    tokens.expiryDate = Date.now() + expiryMs;
  }

  return tokens;
}

// POST /auth/register：创建本地账号并存储密码哈希
authRouter.post("/register", async (req, res, next) => {
  try {
    // 严格校验注册参数，尽早拦截脏数据
    if (!req.body || typeof req.body !== "object") {
      throw new AppError("Invalid request body", {
        statusCode: 400,
        code: "INVALID_REGISTER_REQUEST",
      });
    }

    const record = req.body as Record<string, unknown>;
    const nameValue = record.name;
    const emailValue = record.email;
    const passwordValue = record.password;

    if (typeof nameValue !== "string" || nameValue.trim().length === 0) {
      throw new AppError("name must be a non-empty string", {
        statusCode: 400,
        code: "INVALID_NAME",
      });
    }

    if (typeof emailValue !== "string") {
      throw new AppError("email must be a string", {
        statusCode: 400,
        code: "INVALID_EMAIL",
      });
    }

    const normalizedEmail = emailValue.trim().toLowerCase();
    if (normalizedEmail.length === 0) {
      throw new AppError("email must not be empty", {
        statusCode: 400,
        code: "INVALID_EMAIL",
      });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(normalizedEmail)) {
      throw new AppError("email format is invalid", {
        statusCode: 400,
        code: "INVALID_EMAIL",
      });
    }

    if (typeof passwordValue !== "string") {
      throw new AppError("password must be a string", {
        statusCode: 400,
        code: "INVALID_PASSWORD",
      });
    }

    if (passwordValue.length < MIN_PASSWORD_LENGTH) {
      throw new AppError(`password must be at least ${MIN_PASSWORD_LENGTH} characters long`, {
        statusCode: 400,
        code: "INVALID_PASSWORD",
      });
    }

    const existingUser = await userService.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new AppError("Email is already registered", {
        statusCode: 409,
        code: "EMAIL_IN_USE",
      });
    }

    const displayName = nameValue.trim();
    const passwordHash = await hashPassword(passwordValue);
    await userService.createLocalUser({
      email: normalizedEmail,
      displayName,
      passwordHash,
    });

    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /auth/login/password：本地邮箱+密码登录，发放会话与 JWT
authRouter.post("/login/password", async (req, res, next) => {
  try {
    // 保证 body 结构正确后再做密码对比
    if (!req.body || typeof req.body !== "object") {
      throw new AppError("Invalid request body", {
        statusCode: 400,
        code: "INVALID_LOGIN_REQUEST",
      });
    }

    const record = req.body as Record<string, unknown>;
    const emailValue = record.email;
    const passwordValue = record.password;

    if (typeof emailValue !== "string" || emailValue.trim().length === 0) {
      throw new AppError("email must be a non-empty string", {
        statusCode: 400,
        code: "INVALID_LOGIN_REQUEST",
      });
    }

    if (typeof passwordValue !== "string" || passwordValue.length === 0) {
      throw new AppError("password must be a non-empty string", {
        statusCode: 400,
        code: "INVALID_LOGIN_REQUEST",
      });
    }

    const email = emailValue.trim();
    const password = passwordValue;

    const lookup = await userService.findByEmailWithPassword(email);
    if (!lookup || !lookup.passwordHash) {
      throw new AppError("Invalid email or password", {
        statusCode: 401,
        code: "INVALID_CREDENTIALS",
      });
    }

    const matches = await verifyPassword(password, lookup.passwordHash);
    if (!matches) {
      throw new AppError("Invalid email or password", {
        statusCode: 401,
        code: "INVALID_CREDENTIALS",
      });
    }

    // 登录成功后生成本地 JWT 并落地 session
    const tokens = buildLocalAuthTokens(lookup.user);
    const sessionMaxAgeMs = resolveSessionMaxAgeMs(tokens);
    const sessionOptions =
      typeof sessionMaxAgeMs === "number" ? { expiresInMs: sessionMaxAgeMs } : undefined;
    const { token } = await sessionService.createSession(lookup.user, tokens, sessionOptions);

    const cookieConfig = cookieOptions(true, tokens);
    res.cookie(config.session.cookieName, token, cookieConfig);

    const avatarUrl = lookup.user.avatarUrl ?? null;

    res.json({
      user: {
        id: lookup.user.id,
        email: lookup.user.email,
        name: lookup.user.displayName,
        emailVerified: true,
        ...(avatarUrl ? { picture: avatarUrl, avatarUrl } : {}),
      },
      token,
      scope: null,
      expiresIn: sessionMaxAgeMs ?? config.session.jwtExpiresIn,
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/google/init：生成 Google OAuth 授权地址并返回给前端
authRouter.post("/google/init", (req, res, next) => {
  try {
    const options = parseAuthorizationOptionsFromBody(req.body);
    options.accessType = "offline";
    options.prompt = "consent";

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

// POST /auth/google/callback：处理 Google 回调，换取令牌后创建/更新用户及会话
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

    // 与 Google 交换授权码并同步频道、用户、会话
    const { tokens, profile } = await googleOAuthService.exchangeCodeForTokens(code);
    if (!tokens.refreshToken) {
      throw new AppError("Google 未返回 refresh_token，请使用 prompt=consent 重新授权", {
        statusCode: 400,
        code: "GOOGLE_REFRESH_TOKEN_REQUIRED",
      });
    }
    const channelSummaries = [];
    console.log("[auth/google/callback] access_token:", tokens.accessToken);

    const user = await userService.findOrCreateFromGoogleProfile(profile);
    await userChannelService.syncUserChannels(user.id, tokens.accessToken);
    const sessionMaxAgeMs = resolveSessionMaxAgeMs(tokens);
    const sessionOptions =
      typeof sessionMaxAgeMs === "number" ? { expiresInMs: sessionMaxAgeMs } : undefined;
    const { session, token } = await sessionService.createSession(user, tokens, sessionOptions);

    const cookieConfig = cookieOptions(true, tokens);
    res.cookie(config.session.cookieName, token, cookieConfig);

    const avatarUrl = user.avatarUrl ?? profile.picture ?? null;

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.displayName,
        emailVerified: profile.emailVerified,
        ...(avatarUrl ? { picture: avatarUrl, avatarUrl } : {}),
      },
      token,
      scope: tokens.scope ?? null,
      state:
        typeof req.body?.state === "string"
          ? req.body.state
          : typeof req.query.state === "string"
            ? req.query.state
            : undefined,
      expiresIn: sessionMaxAgeMs ?? config.session.jwtExpiresIn,
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/logout：退出登录，可选同时吊销 Google token
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

    // 若用户要求撤销，将刷新/访问令牌同时吊销
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
