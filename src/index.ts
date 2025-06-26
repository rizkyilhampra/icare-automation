import express from "express";
import expressWinston from "express-winston";
import path from "path";
import dotenv from "dotenv";
import { initDb, getDb } from "./lib/sqlite";
import { registerCronJobs } from "./scheduler";
import { closeBrowser, initBrowser } from "./lib/browser";
import healthRouter from "./routes/health";
import patientsRouter from "./routes/patients"
import jobsRouter from "./routes/jobs";
import logger from "./logger";

process.env.TZ = "Asia/Makassar";

type StatsRow = { status: string; count: number };

dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.static(path.resolve(__dirname, "../public")));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(expressWinston.logger({ winstonInstance: logger }));

app.use("/health", healthRouter);
app.use("/jobs", jobsRouter);
app.use("/patients", patientsRouter);

app.get("/", (_req, res) => {
  res.sendFile(path.resolve(__dirname, "../public/index.html"));
});

app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = () => {
    const db = getDb();
    const stats = db
      .prepare("SELECT status, COUNT(*) as count FROM jobs GROUP BY status")
      .all() as StatsRow[];

    const summary: Record<string, number> = { pending: 0, done: 0, failed: 0 };
    for (const { status, count } of stats) summary[status] = count;
    res.write(`data: ${JSON.stringify(summary)}\n\n`);
  };
  const interval = setInterval(send, 5000);
  req.on("close", () => clearInterval(interval));
});

async function bootstrap() {
  try {
    await initDb();
    await initBrowser();
    registerCronJobs();

    const server = app.listen(PORT, () => {
      logger.info(`icare service running on port ${PORT}`);
    });

    const signals = ["SIGINT", "SIGTERM"];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, shutting down gracefully...`);
        await closeBrowser();
        server.close(() => {
          logger.info("Server has been closed.");
          process.exit(0);
        });
      });
    });
  } catch (err) {
    if (err instanceof Error) {
      logger.error(`Failed to start application: ${err.message}`, { 
        stack: err.stack,
        name: err.name 
      });
    } else {
      logger.error(`Failed to start application: ${String(err)}`);
    }
    process.exit(1);
  }
}

bootstrap();
