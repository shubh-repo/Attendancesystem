import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

// Teacher Login
router.post('/login', async (req, res) => {
    try {
        const { mobile } = req.body;

        if (!mobile) {
            return res.status(400).json({ error: 'Mobile number is required' });
        }

        const { data, error } = await supabase
            .from('teachers')
            .select('*')
            .eq('mobile', mobile)
            .single();

        if (error || !data) {
            return res.status(401).json({ error: 'Invalid credentials or teacher not found' });
        }

        const token = jwt.sign({ id: data.id, role: 'teacher' }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: data.id,
                name: data.name,
                designation: data.designation
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin Login (Hardcoded for simplicity or can use a separate table, using hardcoded env for now)
router.post('/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Basic hardcoded admin check
        const adminUser = process.env.ADMIN_USERNAME || 'admin';
        const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

        if (username === adminUser && password === adminPass) {
            const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });

            return res.json({
                message: 'Admin login successful',
                token,
                user: { role: 'admin' }
            });
        }

        return res.status(401).json({ error: 'Invalid admin credentials' });
    } catch (err) {
        console.error('Admin login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(403).json({ error: 'No token provided' });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Unauthorized' });
        req.user = decoded;
        next();
    });
};

export default router;
