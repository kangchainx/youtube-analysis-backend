import http from "http";
import { createApp } from "./app";
import { config } from "./config/env";
import { configureProxyFromEnv } from "./utils/proxy";
import { logger } from "./utils/logger";

const app = createApp(
  config.clientOrigin ? { clientOrigin: config.clientOrigin } : undefined,
);
const server = http.createServer(app);

const proxyEnabled = configureProxyFromEnv();
if (proxyEnabled) {
  logger.info(
    "[proxy] ENABLE_FETCH_PROXY active – routing outbound fetch traffic through configured proxy",
  );
}

server.listen(config.port, () => {
  logger.info(`Server ready on http://localhost:${config.port}`);
});

function gracefulShutdown(signal: NodeJS.Signals) {
  logger.info(`Received ${signal}. Closing server...`);
  server.close(() => {
    logger.info("Server closed gracefully.");
    process.exit(0);
  });
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { err: error });
  process.exit(1);
});
