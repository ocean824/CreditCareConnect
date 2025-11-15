import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import { setupRoutes } from './routes';
import { setupSwagger } from './swagger';
import { connectDB } from './db.mongo';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json());
setupRoutes(app);
setupSwagger(app);

connectDB();

app.listen(PORT, () => {
  console.log(`🚀 API Server running at http://localhost:${PORT}`);
});