import express from 'express';
import { saveSignature } from '../saveSignature';

const router = express.Router();

router.post('/save-signature', async (req, res) => {
  const { base64, userId } = req.body;
  const savedPath = saveSignature(base64, userId);
  res.json({ path: savedPath });
});

export default router;