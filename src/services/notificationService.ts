import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

export interface NotificationRecord {
  id: string;
  userId: string;
  msgType: string;
  msgStatus: string;
  msgTitle: string | null;
  msgContent: string | null;
  isDelete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedNotifications {
  notifications: NotificationRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface NotificationRow {
  id: string;
  user_id: string;
  msg_type: string;
  msg_status: string;
  msg_title: string | null;
  msg_content: string | null;
  is_delete: boolean;
  created_at: Date;
  updated_at: Date;
}

interface CreateNotificationParams {
  userId: string;
  msgType: string;
  msgStatus: string;
  msgTitle?: string | null;
  msgContent?: string | null;
}

interface ListOptions {
  page: number;
  pageSize: number;
  msgStatus?: string;
}

type NotificationListener = (notification: NotificationRecord) => void;

export class NotificationService {
  private readonly emitter = new EventEmitter();

  constructor(private readonly pool: Pool) {
    this.emitter.setMaxListeners(0);
  }

  async createNotification(
    params: CreateNotificationParams,
  ): Promise<NotificationRecord> {
    const id = randomUUID();
    const now = new Date();
    const { rows } = await this.pool.query<NotificationRow>(
      `
      INSERT INTO notifications (
        id,
        user_id,
        msg_type,
        msg_status,
        msg_title,
        msg_content,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      RETURNING
        id,
        user_id,
        msg_type,
        msg_status,
        msg_title,
        msg_content,
        is_delete,
        created_at,
        updated_at
      `,
      [
        id,
        params.userId,
        params.msgType,
        params.msgStatus,
        params.msgTitle ?? null,
        params.msgContent ?? null,
        now,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to insert notification");
    }
    const record = this.mapRow(row);
    this.emit(record);
    return record;
  }

  async listNotifications(
    userId: string,
    options: ListOptions,
  ): Promise<PaginatedNotifications> {
    const page = Math.max(1, options.page);
    const pageSize = Math.max(1, options.pageSize);
    const offset = (page - 1) * pageSize;
    const whereClauses = ["user_id = $1", "is_delete = FALSE"];
    const whereParams: string[] = [userId];

    if (options.msgStatus) {
      whereParams.push(options.msgStatus);
      whereClauses.push(`msg_status = $${whereParams.length}`);
    }

    const whereSql = whereClauses.join(" AND ");
    const listParams: Array<string | number> = [
      ...whereParams,
      pageSize,
      offset,
    ];

    const [listResult, countResult] = await Promise.all([
      this.pool.query<NotificationRow>(
        `
        SELECT
          id,
          user_id,
          msg_type,
          msg_status,
          msg_title,
          msg_content,
          is_delete,
          created_at,
          updated_at
        FROM notifications
        WHERE ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${whereParams.length + 1}
        OFFSET $${whereParams.length + 2}
        `,
        listParams,
      ),
      this.pool.query<{ count: string }>(
        `
        SELECT COUNT(*) AS count
          FROM notifications
         WHERE ${whereSql}
        `,
        whereParams,
      ),
    ]);

    const total = Number.parseInt(countResult.rows[0]?.count ?? "0", 10) || 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    return {
      notifications: listResult.rows.map((row) => this.mapRow(row)),
      page,
      pageSize,
      total,
      totalPages,
    };
  }

  async markNotificationRead(
    userId: string,
    notificationId: string,
  ): Promise<NotificationRecord | null> {
    const { rows } = await this.pool.query<NotificationRow>(
      `
      UPDATE notifications
         SET msg_status = 'read',
             updated_at = NOW()
       WHERE id = $1
         AND user_id = $2
         AND is_delete = FALSE
      RETURNING
        id,
        user_id,
        msg_type,
        msg_status,
        msg_title,
        msg_content,
        is_delete,
        created_at,
        updated_at
      `,
      [notificationId, userId],
    );

    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async markAllNotificationsRead(userId: string): Promise<number> {
    const result = await this.pool.query(
      `
      UPDATE notifications
         SET msg_status = 'read',
             updated_at = NOW()
       WHERE user_id = $1
         AND is_delete = FALSE
         AND msg_status <> 'read'
      `,
      [userId],
    );

    return result.rowCount ?? 0;
  }

  onNotification(userId: string, listener: NotificationListener): () => void {
    const eventName = this.eventName(userId);
    this.emitter.on(eventName, listener);
    return () => {
      this.emitter.off(eventName, listener);
    };
  }

  private emit(notification: NotificationRecord): void {
    this.emitter.emit(this.eventName(notification.userId), notification);
  }

  private eventName(userId: string): string {
    return `notifications:${userId}`;
  }

  private mapRow(row: NotificationRow): NotificationRecord {
    return {
      id: row.id,
      userId: row.user_id,
      msgType: row.msg_type,
      msgStatus: row.msg_status,
      msgTitle: row.msg_title,
      msgContent: row.msg_content,
      isDelete: row.is_delete,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
