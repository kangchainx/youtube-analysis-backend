import type { User } from "../models/user";
import type { SessionRecord } from "../services/sessionService";

declare global {
  namespace Express {
    interface Request {
      authSession?: SessionRecord;
      currentUser?: User;
    }
  }
}

export {};
