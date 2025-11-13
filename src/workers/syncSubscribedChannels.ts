import { config } from "../config/env";
import { pool } from "../database/pool";
import { runSubscribedChannelsSyncOnce } from "../jobs/subscriptionSync";
import { configureProxyFromEnv, disableProxy } from "../utils/proxy";
import { logger } from "../utils/logger";

async function main(): Promise<void> {
  logger.info("[subscription-sync] Manual run started", {
    nodeEnv: config.nodeEnv,
  });

  const proxyEnabled = configureProxyFromEnv();
  try {
    if (proxyEnabled) {
      logger.info("[subscription-sync] Proxy enabled for outbound requests");
    }
    await runSubscribedChannelsSyncOnce();
  } finally {
    await pool.end();
    disableProxy();
  }
}

main().catch((error) => {
  logger.error("[subscription-sync] Manual run failed", { err: error });
  process.exitCode = 1;
});
