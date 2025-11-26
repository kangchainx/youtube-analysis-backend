import jwt from "jsonwebtoken";
import { Router } from "express";
import { requireAuth } from "../middleware/authentication";
import { userService } from "../services";
import type { SessionRecord } from "../services/sessionService";
import type { User } from "../models/user";
import { AppError } from "../utils/appError";
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "../utils/password";

export const usersRouter = Router();

usersRouter.use(requireAuth);

// GET /users/me：返回当前登录用户的基本信息
usersRouter.get("/me", (req, res, next) => {
  try {
    const session = req.authSession;
    if (!session) {
      throw new AppError("需要先登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const profile = decodeGoogleProfile(session);
    const payload = buildUserPayload(session.user, {
      emailVerified: profile.emailVerified,
      fallbackName: profile.name,
      fallbackPicture: profile.picture,
    });

    res.json({ user: payload });
  } catch (error) {
    next(error);
  }
});

// PATCH /users/me：更新个人资料（昵称、头像、邮箱、密码），需要已登录
usersRouter.patch("/me", async (req, res, next) => {
  try {
    const session = req.authSession;
    if (!session) {
      throw new AppError("需要先登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    if (!req.body || typeof req.body !== "object") {
      throw new AppError("请求体格式不正确", {
        statusCode: 400,
        code: "INVALID_PROFILE_UPDATE",
      });
    }

    const record = req.body as Record<string, unknown>;
    const updates: {
      name?: string | null;
      picture?: string | null;
      email?: string;
      passwordHash?: string | null;
    } = {};
    let hasUpdates = false;

    if (Object.prototype.hasOwnProperty.call(record, "name")) {
      const value = record.name;
      if (value === null) {
        updates.name = null;
        hasUpdates = true;
      } else if (typeof value === "string") {
        updates.name = value.trim() === "" ? null : value.trim();
        hasUpdates = true;
      } else {
        throw new AppError("name 必须是字符串或 null", {
          statusCode: 400,
          code: "INVALID_PROFILE_UPDATE",
        });
      }
    }

    const applyAvatarUpdate = (value: unknown, field: "avatar" | "picture") => {
      if (value === null) {
        updates.picture = null;
        hasUpdates = true;
      } else if (typeof value === "string") {
        updates.picture = value.trim() === "" ? null : value.trim();
        hasUpdates = true;
      } else {
        throw new AppError(`${field} 必须是字符串或 null`, {
          statusCode: 400,
          code: "INVALID_PROFILE_UPDATE",
        });
      }
    };

    if (Object.prototype.hasOwnProperty.call(record, "avatar")) {
      applyAvatarUpdate(record.avatar, "avatar");
    } else if (Object.prototype.hasOwnProperty.call(record, "picture")) {
      applyAvatarUpdate(record.picture, "picture");
    }

    if (Object.prototype.hasOwnProperty.call(record, "email")) {
      const value = record.email;
      if (value === null) {
        throw new AppError("email 不能为 null", {
          statusCode: 400,
          code: "INVALID_EMAIL",
        });
      }

      if (typeof value !== "string") {
        throw new AppError("email 必须是字符串", {
          statusCode: 400,
          code: "INVALID_EMAIL",
        });
      }

      const normalized = value.trim().toLowerCase();
      if (normalized.length === 0) {
        throw new AppError("email 不能为空", {
          statusCode: 400,
          code: "INVALID_EMAIL",
        });
      }

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(normalized)) {
        throw new AppError("email 格式不正确", {
          statusCode: 400,
          code: "INVALID_EMAIL",
        });
      }

      const currentEmail = session.user.email.toLowerCase();
      if (normalized !== currentEmail) {
        const existing = await userService.findByEmail(normalized);
        if (existing && existing.id !== session.user.id) {
          throw new AppError("该邮箱已被使用", {
            statusCode: 409,
            code: "EMAIL_IN_USE",
          });
        }

        updates.email = normalized;
        hasUpdates = true;
      }
    }

    let newPassword: string | undefined;
    if (Object.prototype.hasOwnProperty.call(record, "password")) {
      const value = record.password;
      if (value === null || typeof value !== "string") {
        throw new AppError("password 必须是字符串", {
          statusCode: 400,
          code: "INVALID_PASSWORD",
        });
      }

      if (value.length < MIN_PASSWORD_LENGTH) {
        throw new AppError(`password 长度至少为 ${MIN_PASSWORD_LENGTH} 个字符`, {
          statusCode: 400,
          code: "INVALID_PASSWORD",
        });
      }

      newPassword = value;
    }

    let currentPassword: string | undefined;
    if (Object.prototype.hasOwnProperty.call(record, "currentPassword")) {
      const value = record.currentPassword;
      if (value === null || value === undefined) {
        currentPassword = undefined;
      } else if (typeof value === "string") {
        currentPassword = value;
      } else {
        throw new AppError("currentPassword 必须是字符串", {
          statusCode: 400,
          code: "INVALID_CURRENT_PASSWORD",
        });
      }
    }

    if (!newPassword && currentPassword !== undefined) {
      throw new AppError("未提供 password 时不能提交 currentPassword", {
        statusCode: 400,
        code: "CURRENT_PASSWORD_UNEXPECTED",
      });
    }

    if (newPassword) {
      const passwordRecord = await userService.findByIdWithPassword(session.user.id);
      if (!passwordRecord) {
        throw new AppError("无法加载当前用户", {
          statusCode: 500,
          code: "USER_LOOKUP_FAILED",
        });
      }

      const existingHash = passwordRecord.passwordHash;
      if (existingHash) {
        if (!currentPassword || currentPassword.length === 0) {
          throw new AppError("设置新密码需要提供当前密码", {
            statusCode: 400,
            code: "CURRENT_PASSWORD_REQUIRED",
          });
        }

        const matches = await verifyPassword(currentPassword, existingHash);
        if (!matches) {
          throw new AppError("当前密码不正确", {
            statusCode: 401,
            code: "CURRENT_PASSWORD_INVALID",
          });
        }
      }

      updates.passwordHash = await hashPassword(newPassword);
      hasUpdates = true;
    }

    if (!hasUpdates) {
      throw new AppError("未提供任何个人资料更新", {
        statusCode: 400,
        code: "NO_PROFILE_CHANGES",
      });
    }

    const updatedUser = await userService.updateProfile(session.user.id, updates);
    const nextSession: SessionRecord = {
      ...session,
      user: updatedUser,
    };
    req.authSession = nextSession;
    req.currentUser = updatedUser;

    const profile = decodeGoogleProfile(nextSession);
    const payload = buildUserPayload(updatedUser, {
      emailVerified: profile.emailVerified,
      fallbackName: profile.name,
      fallbackPicture: profile.picture,
    });

    res.json({ user: payload });
  } catch (error) {
    next(error);
  }
});

// POST /users/me/password：单独修改密码，校验当前密码并写入新 hash
usersRouter.post("/me/password", async (req, res, next) => {
  try {
    const session = req.authSession;
    if (!session) {
      throw new AppError("需要先登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    if (!req.body || typeof req.body !== "object") {
      throw new AppError("请求体格式不正确", {
        statusCode: 400,
        code: "INVALID_PASSWORD_UPDATE",
      });
    }

    const record = req.body as Record<string, unknown>;
    const passwordValue = record.password;
    const currentPasswordValue = record.currentPassword;

    if (typeof passwordValue !== "string") {
      throw new AppError("password 必须是字符串", {
        statusCode: 400,
        code: "INVALID_PASSWORD",
      });
    }

    if (passwordValue.length < MIN_PASSWORD_LENGTH) {
      throw new AppError(`password 长度至少为 ${MIN_PASSWORD_LENGTH} 个字符`, {
        statusCode: 400,
        code: "INVALID_PASSWORD",
      });
    }

    let currentPassword: string | undefined;
    if (currentPasswordValue !== undefined && currentPasswordValue !== null) {
      if (typeof currentPasswordValue !== "string") {
        throw new AppError("currentPassword 必须是字符串", {
          statusCode: 400,
          code: "INVALID_CURRENT_PASSWORD",
        });
      }
      currentPassword = currentPasswordValue;
    }

    const passwordRecord = await userService.findByIdWithPassword(session.user.id);
    if (!passwordRecord) {
      throw new AppError("无法加载当前用户", {
        statusCode: 500,
        code: "USER_LOOKUP_FAILED",
      });
    }

    const existingHash = passwordRecord.passwordHash;
    if (existingHash) {
      if (!currentPassword || currentPassword.length === 0) {
        throw new AppError("设置新密码需要提供当前密码", {
          statusCode: 400,
          code: "CURRENT_PASSWORD_REQUIRED",
        });
      }

      const matches = await verifyPassword(currentPassword, existingHash);
      if (!matches) {
        throw new AppError("当前密码不正确", {
          statusCode: 401,
          code: "CURRENT_PASSWORD_INVALID",
        });
      }
    }

    const nextHash = await hashPassword(passwordValue);
    await userService.updateProfile(session.user.id, { passwordHash: nextHash });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

interface DecodedProfile {
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

function decodeGoogleProfile(session: SessionRecord): DecodedProfile {
  const decoded = jwt.decode(session.tokens.idToken);
  if (!decoded || typeof decoded !== "object") {
    return { emailVerified: false };
  }

  const payload = decoded as Record<string, unknown>;

  const emailVerifiedValue = payload.email_verified;
  const emailVerified =
    typeof emailVerifiedValue === "boolean"
      ? emailVerifiedValue
      : typeof emailVerifiedValue === "string"
        ? emailVerifiedValue.toLowerCase() === "true"
        : false;

  const name =
    typeof payload.name === "string" && payload.name.length > 0
      ? payload.name
      : undefined;

  const picture =
    typeof payload.picture === "string" && payload.picture.length > 0
      ? payload.picture
      : undefined;

  return {
    emailVerified,
    ...(name ? { name } : {}),
    ...(picture ? { picture } : {}),
  };
}

interface UserPayloadOptions {
  emailVerified?: boolean;
  fallbackName?: string | undefined;
  fallbackPicture?: string | undefined;
}

interface UserPayload {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  picture?: string;
  avatarUrl?: string;
}

function buildUserPayload(user: User, options: UserPayloadOptions = {}): UserPayload {
  const name = user.displayName ?? options.fallbackName ?? null;
  const avatarUrl = user.avatarUrl ?? options.fallbackPicture;

  const payload: UserPayload = {
    id: user.id,
    email: user.email,
    name,
    emailVerified: options.emailVerified ?? false,
  };

  if (avatarUrl) {
    payload.picture = avatarUrl;
    payload.avatarUrl = avatarUrl;
  }

  return payload;
}
