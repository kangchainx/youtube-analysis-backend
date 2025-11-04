import { config } from "../config/env";
import { pool } from "../database/pool";
import { GoogleOAuthService } from "./googleOAuth";
import { SessionService } from "./sessionService";
import { UserService } from "./userService";

export const googleOAuthService = new GoogleOAuthService(config.googleOAuth);
export const userService = new UserService(pool);
export const sessionService = new SessionService(config.session, pool);
