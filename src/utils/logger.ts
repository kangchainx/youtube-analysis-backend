import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import winston from "winston";
import { config } from "../config/env";

const logDirectory = config.logging.directory;
if (!existsSync(logDirectory)) {
  try {
    mkdirSync(logDirectory, { recursive: true });
  } catch (error) {
    console.error(`[logger] Failed to create log directory at ${logDirectory}`, error);
  }
}

const filePath = path.join(logDirectory, config.logging.fileName);

const baseFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ["message", "level", "timestamp", "label"] }),
);

export const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(baseFormat, winston.format.json()),
  transports: [
    new winston.transports.File({
      level: config.logging.fileLevel,
      filename: filePath,
      maxsize: config.logging.maxSizeMB * 1024 * 1024,
      maxFiles: config.logging.maxFiles,
      tailable: true,
    }),
    new winston.transports.Console({
      level: config.logging.consoleLevel,
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, stack, metadata }) => {
          const meta =
            metadata && Object.keys(metadata).length > 0
              ? ` ${JSON.stringify(metadata)}`
              : "";
          return stack
            ? `${timestamp} [${level}]: ${message}\n${stack}${meta}`
            : `${timestamp} [${level}]: ${message}${meta}`;
        }),
      ),
    }),
  ],
});
