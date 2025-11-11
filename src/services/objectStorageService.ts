import { Client as MinioClient } from "minio";
import type { ObjectStorageConfig } from "../config/env";

interface PresignedDownloadOptions {
  bucket?: string;
  expiresInSeconds?: number;
  responseContentType?: string;
  responseContentDisposition?: string;
}

export class ObjectStorageService {
  private readonly client: MinioClient;

  constructor(private readonly config: ObjectStorageConfig) {
    const baseOptions = {
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    };

    this.client = new MinioClient(
      config.region ? { ...baseOptions, region: config.region } : baseOptions,
    );
  }

  async getPresignedDownloadUrl(
    objectKey: string,
    options?: PresignedDownloadOptions,
  ): Promise<string> {
    const bucket = options?.bucket ?? this.config.bucket;
    const expiry = this.normalizeExpiry(
      options?.expiresInSeconds ?? this.config.presignedUrlExpirySeconds,
    );

    const respHeaders: Record<string, string> = {};
    if (options?.responseContentType) {
      respHeaders["response-content-type"] = options.responseContentType;
    }
    if (options?.responseContentDisposition) {
      respHeaders["response-content-disposition"] =
        options.responseContentDisposition;
    }

    const headersArg =
      Object.keys(respHeaders).length > 0 ? respHeaders : undefined;

    return this.client.presignedGetObject(
      bucket,
      objectKey,
      expiry,
      headersArg,
    );
  }

  private normalizeExpiry(value: number): number {
    const min = 1;
    const max = 7 * 24 * 60 * 60; // MinIO/S3 limit: 7 days
    if (!Number.isFinite(value)) {
      return this.config.presignedUrlExpirySeconds;
    }
    return Math.min(Math.max(Math.floor(value), min), max);
  }
}
