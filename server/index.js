import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db/database.js';
import { initSocket } from './socket.js';
import apiRouter from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB schema & seed data
initDatabase();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

initSocket(io);

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Serve static frontend files if built
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

// Fallback for SPA routing
app.use((req, res, next) => {
  if (req.url.startsWith('/api') || req.url.startsWith('/socket.io')) return next();
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send('Server is running. Client is in development mode.');
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`⚓ Ship VS Ship Battle Server listening on http://localhost:${PORT}`);
});
