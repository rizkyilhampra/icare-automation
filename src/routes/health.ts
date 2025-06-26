import { Router } from 'express';
import { getDb } from '../lib/sqlite';

const router = Router();

router.get('/', (_req, res) => {
  try {
    getDb();
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: (err as Error).message });
  }
});

export default router; 