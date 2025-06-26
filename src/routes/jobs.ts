import { Router } from "express";
import { getDb } from "../lib/sqlite";

const router = Router();

router.get("/", (_req, res) => {
  const jobs = getDb()
    .prepare("SELECT * FROM jobs ORDER BY created_at DESC LIMIT 100")
    .all();
  res.json(jobs);
});

export default router;

