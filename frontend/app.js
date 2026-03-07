const API_BASE = '/api';

const App = {
    token: localStorage.getItem('token'),
    user: JSON.parse(localStorage.getItem('user') || 'null'),

    async registerSW() {
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('/service-worker.js');
                console.log('SW Registered');
            } catch (error) {
                console.warn('SW Registration Failed', error);
            }
        }
    },

    setToken(token, user) {
        this.token = token;
        this.user = user;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
    },

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = './index.html'; // back to login
    },

    async fetchAPI(endpoint, options = {}) {
        const headers = { ...options.headers };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        if (!options.body || !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        const res = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Server error');
        return data;
    },

    checkAuth() {
        const path = window.location.pathname;
        const isLogin = path === '/' || path.includes('index.html');
        if (!this.token && !isLogin) {
            window.location.href = './index.html';
        } else if (this.token && isLogin) {
            if (this.user?.role === 'admin') {
                window.location.href = './admin-dashboard.html';
            } else {
                window.location.href = './dashboard.html';
            }
        }
    }
};

window.onload = () => {
    App.registerSW();
    App.checkAuth();
};
