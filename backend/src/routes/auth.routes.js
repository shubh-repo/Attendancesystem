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
        const { mobile, passcode, password } = req.body;
        const enteredPassword = passcode || password;

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

        if (data.status === 'blocked') {
            return res.status(403).json({ error: 'Your account has been blocked by the administrator. Please contact school support.' });
        }

        // If teacher has a password set, verify it
        if (data.password) {
            if (!enteredPassword) {
                return res.status(401).json({ error: 'Password is required for your account' });
            }
            const isMatch = await bcrypt.compare(enteredPassword, data.password);
            if (!isMatch) {
                return res.status(401).json({ error: 'Incorrect password. Please try again.' });
            }
        }

        const token = jwt.sign({ id: data.id, role: 'teacher' }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: data.id,
                name: data.name,
                designation: data.designation,
                mobile: data.mobile,
                email: data.email || null,
                joining_date: data.joining_date || null,
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Admin Login — checks DB admin_credentials first, then falls back to .env
router.post('/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const adminUser = process.env.ADMIN_USERNAME || 'admin';

        if (username !== adminUser) {
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }

        // Check DB-stored password first (persists across restarts)
        let validPassword = false;
        const { data: creds } = await supabase.from('admin_credentials').select('password').eq('id', 1).single();
        if (creds?.password) {
            validPassword = password === creds.password || await bcrypt.compare(password, creds.password).catch(() => false);
        }
        // Fallback to .env
        if (!validPassword) {
            const envPass = process.env.ADMIN_PASSWORD || 'admin123';
            validPassword = password === envPass;
        }

        if (!validPassword) return res.status(401).json({ error: 'Invalid admin credentials' });

        const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });
        return res.json({ message: 'Admin login successful', token, user: { role: 'admin' } });
    } catch (err) {
        console.error('Admin login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Change own password — persists to .env file
router.post('/admin/change-password', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(403).json({ error: 'No token provided' });
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

        const { current_password, new_password } = req.body;
        if (!current_password || !new_password) return res.status(400).json({ error: 'Both current and new password are required' });

        // Verify current password — check DB first, fallback to env
        let currentValid = false;
        const { data: creds } = await supabase.from('admin_credentials').select('password').eq('id', 1).maybeSingle();
        if (creds?.password) {
            try {
                currentValid = current_password === creds.password || await bcrypt.compare(current_password, creds.password);
            } catch (e) { currentValid = false; }
        }
        if (!currentValid) {
            const envPass = process.env.ADMIN_PASSWORD || 'admin123';
            currentValid = current_password === envPass;
        }
        if (!currentValid) return res.status(401).json({ error: 'Current password is incorrect' });

        // Validate new password strength
        if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
        if (!/[A-Za-z]/.test(new_password)) return res.status(400).json({ error: 'Password must include a letter' });
        if (!/[0-9]/.test(new_password)) return res.status(400).json({ error: 'Password must include a number' });
        if (!/[^A-Za-z0-9]/.test(new_password)) return res.status(400).json({ error: 'Password must include a symbol (@, #, !, etc.)' });

        // 1. Update in-memory immediately
        process.env.ADMIN_PASSWORD = new_password;

        // 2. Write to .env file for persistence across restarts
        try {
            const fs = await import('fs');
            const path = await import('path');
            const { fileURLToPath } = await import('url');
            const __dir = path.default.dirname(fileURLToPath(import.meta.url));
            const envPath = path.default.resolve(__dir, '../../../.env');
            let envContent = fs.default.readFileSync(envPath, 'utf8');
            if (/^ADMIN_PASSWORD=.*/m.test(envContent)) {
                envContent = envContent.replace(/^ADMIN_PASSWORD=.*/m, `ADMIN_PASSWORD=${new_password}`);
            } else {
                envContent += `\nADMIN_PASSWORD=${new_password}`;
            }
            fs.default.writeFileSync(envPath, envContent, 'utf8');
        } catch (fsErr) {
            console.warn('Could not write to .env:', fsErr.message);
        }

        // 3. Also try DB (bonus persistence)
        try {
            await supabase.from('admin_credentials').upsert({ id: 1, password: new_password, updated_at: new Date() }, { onConflict: 'id' });
        } catch (e) { }

        res.json({ message: 'Admin password changed successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to change admin password' });
    }
});


// Teacher: Change own password — requires current password
router.post('/change-password', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(403).json({ error: 'No token provided' });
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }

        // Fetch teacher
        const { data: teacher, error: fetchErr } = await supabase.from('teachers').select('password').eq('id', decoded.id).single();
        if (fetchErr || !teacher) return res.status(404).json({ error: 'Teacher not found' });

        // Verify current password
        if (teacher.password) {
            const isMatch = await bcrypt.compare(current_password, teacher.password);
            if (!isMatch) return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Validate new password strength
        if (!new_password || new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
        if (!/[A-Za-z]/.test(new_password)) return res.status(400).json({ error: 'Password must include a letter' });
        if (!/[0-9]/.test(new_password)) return res.status(400).json({ error: 'Password must include a number' });
        if (!/[^A-Za-z0-9]/.test(new_password)) return res.status(400).json({ error: 'Password must include a symbol (@, #, !, etc.)' });

        const hashedPassword = await bcrypt.hash(new_password, 10);
        const { error } = await supabase.from('teachers').update({ password: hashedPassword }).eq('id', decoded.id);
        if (error) throw error;
        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to change password' });
    }
});

// Admin: Reset any teacher's password
router.post('/admin/reset-teacher-password', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(403).json({ error: 'No token provided' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

        const { teacher_id, new_password } = req.body;
        if (!teacher_id || !new_password) return res.status(400).json({ error: 'teacher_id and new_password required' });

        const hashedPassword = await bcrypt.hash(new_password, 10);
        const { error } = await supabase.from('teachers').update({ password: hashedPassword }).eq('id', teacher_id);
        if (error) throw error;

        res.json({ message: 'Teacher password reset successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to reset password' });
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
