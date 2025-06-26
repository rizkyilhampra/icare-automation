import { Router } from 'express';
import { fetchTodayPatients } from '../services/simrsService';

const router = Router();

router.get('/', async (_req, res) => {
    try {
        const patients = await fetchTodayPatients();
        res.json({
            ok: true,
            data: patients,
        });
    } catch (err) {
        res.status(500).json({ ok: false, message: (err as Error).message });
    }
});

export default router; 
