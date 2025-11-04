import type { Request } from "express";
import { config } from "../config/env";

export function extractSessionToken(req: Request): string | undefined {
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
