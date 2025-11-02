import {
  OAuth2Client,
  type GenerateAuthUrlOpts,
  type TokenPayload,
} from "google-auth-library";
import type { GoogleOAuthConfig } from "../config/env";

export interface GoogleTokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  scope?: string;
  expiryDate?: number;
  tokenType?: string;
}

export interface GoogleUserProfile {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  locale?: string;
}

export interface AuthorizationUrlOptions {
  state?: string;
  prompt?: "none" | "consent" | "select_account";
  accessType?: "online" | "offline";
  includeGrantedScopes?: boolean;
  hd?: string;
}

export interface ExchangeResult {
  tokens: GoogleTokens;
  profile: GoogleUserProfile;
}

export class GoogleOAuthService {
  private readonly client: OAuth2Client;
  private static readonly allowedIssuers = new Set([
    "https://accounts.google.com",
    "accounts.google.com",
  ]);

  constructor(private readonly config: GoogleOAuthConfig) {
    this.client = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.redirectUri,
    );
  }

  generateAuthorizationUrl(options?: AuthorizationUrlOptions): string {
    const params: GenerateAuthUrlOpts = {
      access_type: options?.accessType ?? "offline",
      scope: this.config.scopes,
    };

    if (options?.state) {
      params.state = options.state;
    }
    if (options?.prompt) {
      params.prompt = options.prompt;
    }
    if (typeof options?.includeGrantedScopes === "boolean") {
      params.include_granted_scopes = options.includeGrantedScopes;
    }
    if (options?.hd) {
      params.hd = options.hd;
    }

    return this.client.generateAuthUrl(params);
  }

  async exchangeCodeForTokens(code: string): Promise<ExchangeResult> {
    const { tokens } = await this.client.getToken(code);
    if (!tokens.id_token) {
      throw new Error("Google response is missing id_token");
    }
    if (!tokens.access_token) {
      throw new Error("Google response is missing access_token");
    }

    const normalized: GoogleTokens = {
      accessToken: tokens.access_token,
      idToken: tokens.id_token,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      ...(tokens.scope ? { scope: tokens.scope } : {}),
      ...(typeof tokens.expiry_date === "number"
        ? { expiryDate: tokens.expiry_date }
        : {}),
      ...(tokens.token_type ? { tokenType: tokens.token_type } : {}),
    };

    const profile = await this.verifyIdToken(normalized.idToken);

    return {
      tokens: normalized,
      profile,
    };
  }

  async verifyIdToken(idToken: string): Promise<GoogleUserProfile> {
    const loginTicket = await this.client.verifyIdToken({
      idToken,
      audience: this.config.clientId,
    });

    const payload = loginTicket.getPayload();
    if (!payload) {
      throw new Error("Unable to parse Google ID token payload");
    }

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new Error("Google ID token payload is missing the subject identifier");
    }

    if (typeof payload.email !== "string" || payload.email.length === 0) {
      throw new Error("Google ID token payload does not include an email");
    }

    if (
      payload.iss &&
      !GoogleOAuthService.allowedIssuers.has(payload.iss.toLowerCase())
    ) {
      throw new Error(`Unexpected Google token issuer: ${payload.iss}`);
    }

    return this.mapProfile(payload);
  }

  async revokeToken(token: string): Promise<void> {
    await this.client.revokeToken(token);
  }

  private mapProfile(payload: TokenPayload): GoogleUserProfile {
    const id = payload.sub as string;
    const email = payload.email as string;

    return {
      id,
      email,
      emailVerified: payload.email_verified ?? false,
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.given_name ? { givenName: payload.given_name } : {}),
      ...(payload.family_name ? { familyName: payload.family_name } : {}),
      ...(payload.picture ? { picture: payload.picture } : {}),
      ...(payload.locale ? { locale: payload.locale } : {}),
    };
  }
}
