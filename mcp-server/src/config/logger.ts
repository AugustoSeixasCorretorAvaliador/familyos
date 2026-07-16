import pino from "pino";
import { env } from "./env";

export const logger = pino(
  {
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        "req.headers.authorization",
        "token",
        "jwt",
        "supabaseServiceRole",
        "googleClientSecret",
        "openaiApiKey",
      ],
      censor: "[REDACTED]",
    },
  },
  pino.destination(2),
);
