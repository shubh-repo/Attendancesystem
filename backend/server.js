import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import './src/cron/midnightJob.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import authRoutes from './src/routes/auth.routes.js';
import adminRoutes from './src/routes/admin.routes.js';
import attendanceRoutes from './src/routes/attendance.routes.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/attendance', attendanceRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'active', message: 'API is running' });
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Fallback for HTML5 history routing
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.originalUrl.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    } else {
        next();
    }
});

// Final 404 handler for APIs
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
