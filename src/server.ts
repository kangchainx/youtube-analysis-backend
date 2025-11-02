import http from "http";
import { createApp } from "./app";
import { config } from "./config/env";

const app = createApp(
  config.clientOrigin ? { clientOrigin: config.clientOrigin } : undefined,
);
const server = http.createServer(app);

server.listen(config.port, () => {
  console.log(`Server ready on http://localhost:${config.port}`);
});

function gracefulShutdown(signal: NodeJS.Signals) {
  console.log(`\nReceived ${signal}. Closing server...`);
  server.close(() => {
    console.log("Server closed gracefully.");
    process.exit(0);
  });
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
