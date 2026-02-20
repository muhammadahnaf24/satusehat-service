import winston from "winston";
import path from "path";

const consoleFormat = winston.format.printf(
  ({ level, message, timestamp, stack }) => {
    const logMessage = stack || message;
    return `${timestamp} [${level}]: ${logMessage}`;
  },
);

export const logger = winston.createLogger({
  level: "info",

  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: "bridging-satusehat" },
  transports: [
    new winston.transports.File({
      filename: path.join("logs", "error.log"),
      level: "error",
    }),
    new winston.transports.File({
      filename: path.join("logs", "combined.log"),
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: false }),
        consoleFormat,
      ),
    }),
  );
}
