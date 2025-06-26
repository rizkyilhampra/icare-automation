import winston from "winston";
import path from "path";
import fs from "fs";

const LOG_DIR = path.join(process.cwd(), "logs");

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const timezoneFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const tzTimestamp = new Date().toLocaleString('en-CA', {
    timeZone: 'Asia/Makassar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/,/, '');

  const log = {
    level,
    timestamp: tzTimestamp,
    message,
    ...meta
  };
  return JSON.stringify(log);
});

const jsonFormat = winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.metadata({
    fillExcept: ["message", "level", "timestamp", "label"],
  }),
  timezoneFormat
);

const fileFormat = winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  winston.format.metadata({
    fillExcept: ["message", "level", "timestamp", "label"],
  }),
  winston.format.printf((info) => {
    const { timestamp, level, message, metadata, stack } = info;
    const metaStr =
      metadata && typeof metadata === "object" && Object.keys(metadata).length
        ? JSON.stringify(metadata)
        : "";
    const errorStack = stack ? `\n${stack}` : "";
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}${errorStack}`;
  })
);

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: "HH:mm:ss.SSS" }),
  winston.format.printf((info) => {
    const { timestamp, level, message, metadata } = info;
    const metaStr = metadata &&
      typeof metadata === "object" &&
      metadata !== null &&
      Object.keys(metadata).length
      ? ` ${JSON.stringify(metadata)}`
      : "";
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

const isContainer = process.env.CONTAINER === "true" || fs.existsSync("/.dockerenv");
const isDevelopment = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";

const loggingStrategy = {
  console: true,
  files: process.env.LOG_TO_FILE
    ? process.env.LOG_TO_FILE === "true"
    : !isContainer,
  useJsonFormat: isProduction,
  useColorsInConsole: isDevelopment,
};

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: loggingStrategy.useColorsInConsole ? consoleFormat :
      loggingStrategy.useJsonFormat ? jsonFormat : fileFormat,
    level: process.env.CONSOLE_LOG_LEVEL || (isDevelopment ? "debug" : "info"),
  }),
];

if (loggingStrategy.files) {
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, "error.log"),
      level: "error",
      format: loggingStrategy.useJsonFormat ? jsonFormat : fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true,
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, "combined.log"),
      format: loggingStrategy.useJsonFormat ? jsonFormat : fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true,
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  defaultMeta: {
    service: process.env.SERVICE_NAME || "icare",
    environment: process.env.NODE_ENV || "development",
    version: process.env.APP_VERSION || "unknown",
  },
  transports,
  exitOnError: false,
});

if (loggingStrategy.files) {
  logger.exceptions.handle(
    new winston.transports.File({
      filename: path.join(LOG_DIR, "exceptions.log"),
      format: loggingStrategy.useJsonFormat ? jsonFormat : fileFormat,
      maxsize: 5242880,
      maxFiles: 3,
    })
  );

  logger.rejections.handle(
    new winston.transports.File({
      filename: path.join(LOG_DIR, "rejections.log"),
      format: loggingStrategy.useJsonFormat ? jsonFormat : fileFormat,
      maxsize: 5242880,
      maxFiles: 3,
    })
  );
}

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Promise rejection", {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString(),
  });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", {
    error: error.message,
    stack: error.stack,
  });
});

logger.info(`Logger initialized for ${isContainer ? 'Container' : 'Direct Node'} deployment`);
logger.info(`File logging: ${loggingStrategy.files ? 'enabled' : 'disabled'}`);
logger.info(`Format: ${loggingStrategy.useJsonFormat ? 'JSON' : 'Human-readable'}`);

export const logWithContext = (level: string, message: string, context: Record<string, any> = {}) => {
  logger.log(level, message, context);
};

export const logError = (error: Error, context: Record<string, any> = {}) => {
  logger.error(error.message, {
    ...context,
    stack: error.stack,
    name: error.name,
  });
};

export const logJobFailure = (jobId: string | number, attempt: number, error: string | Error, context: Record<string, any> = {}) => {
  const errorMessage = error instanceof Error ? error.message : error;
  logger.error(`Job ${jobId} attempt ${attempt} failed`, {
    jobId,
    attempt,
    error: errorMessage,
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  });
};

export default logger;
