import { startServer } from "./server";
import { logger } from "./config/logger";

startServer().catch((error) => {
  logger.error({ err: error }, "failed_to_start_mcp_server");
  process.exit(1);
});
