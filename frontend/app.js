const API_BASE = '/api';

// Global styles for page transition animations (no transform on body to preserve 'fixed' positioning)
const globalStyles = document.createElement('style');
globalStyles.textContent = `
    body { animation: pageFadeIn 0.1s ease-out forwards; }
    @keyframes pageFadeIn { 
        0% { opacity: 0; } 
        100% { opacity: 1; } 
    }
    button, a { transition: all 0.2s ease-in-out; }
    button:active, a:active { transform: scale(0.96); }
`;
document.head.appendChild(globalStyles);
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
        window.location.replace('./index.html'); // replace history to prevent back button bug
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

        // Safely parse response body
        const text = await res.text();
        let data = {};
        if (text) {
            try {
                data = JSON.parse(text);
            } catch {
                if (!res.ok) throw new Error(`Server error (${res.status}): ${text.substring(0, 100)}`);
                return text;
            }
        }
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        return data;
    },

    checkAuth() {
        const path = window.location.pathname;
        const isTeacherLogin = path === '/' || path.includes('index.html');
        const isAdminLogin = path.includes('admin-login.html');
        const isAnyLogin = isTeacherLogin || isAdminLogin;

        if (!this.token && !isAnyLogin) {
            // Not logged in, not on a login page → go to login
            document.body.style.visibility = 'hidden';
            window.location.replace('./index.html');
        } else if (this.token && isTeacherLogin) {
            // Already logged in, on teacher login page → redirect to correct dashboard
            document.body.style.visibility = 'hidden';
            if (this.user?.role === 'admin') {
                window.location.replace('./admin-dashboard.html');
            } else {
                window.location.replace('./dashboard.html');
            }
        } else if (this.token && isAdminLogin && this.user?.role === 'admin') {
            // Already logged in as ADMIN and on admin-login → skip to admin dashboard
            document.body.style.visibility = 'hidden';
            window.location.replace('./admin-dashboard.html');
        }
        // Teacher on admin-login.html: do nothing, let them try to log in as admin
    },

    toggleSidebar() {
        let sidebar = document.getElementById('app-sidebar');
        let overlay = document.getElementById('app-sidebar-overlay');

        if (!sidebar) {
            overlay = document.createElement('div');
            overlay.id = 'app-sidebar-overlay';
            overlay.className = 'absolute inset-0 bg-black/50 z-40 opacity-0 transition-opacity duration-300';
            overlay.onclick = () => App.toggleSidebar();

            sidebar = document.createElement('div');
            sidebar.id = 'app-sidebar';
            sidebar.className = 'absolute top-0 left-0 h-full w-[280px] max-w-[85%] bg-white dark:bg-slate-900 z-50 transform -translate-x-full transition-transform duration-300 shadow-2xl flex flex-col';

            sidebar.innerHTML = `
                <div class="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <h2 class="font-bold text-lg text-slate-900 dark:text-white">Menu</h2>
                    <button onclick="App.toggleSidebar()" class="text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full p-1 transition-colors flex items-center justify-center">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="p-4 flex flex-col gap-2 flex-1">
                    <a href="./dashboard.html" class="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors">
                        <span class="material-symbols-outlined">home</span>
                        <span class="font-medium">Dashboard</span>
                    </a>
                    <a href="./attendance-history.html" class="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors">
                        <span class="material-symbols-outlined">history</span>
                        <span class="font-medium">Attendance History</span>
                    </a>
                    <a href="./profile.html" class="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors">
                        <span class="material-symbols-outlined">person</span>
                        <span class="font-medium">My Profile</span>
                    </a>
                </div>
                <div class="p-4 border-t border-slate-200 dark:border-slate-800">
                    <button onclick="App.logout()" class="flex items-center gap-3 p-3 w-full rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left">
                        <span class="material-symbols-outlined">logout</span>
                        <span class="font-medium">Sign Out</span>
                    </button>
                </div>
            `;

            document.body.appendChild(overlay);
            document.body.appendChild(sidebar);
            sidebar.offsetHeight; // trigger reflow
        }

        const isOpen = sidebar.style.transform === 'translateX(0%)';

        if (isOpen) {
            sidebar.style.transform = 'translateX(-100%)';
            overlay.style.opacity = '0';
            setTimeout(() => {
                sidebar.style.display = 'none';
                overlay.style.display = 'none';
            }, 300);
        } else {
            sidebar.style.display = 'flex';
            overlay.style.display = 'block';
            setTimeout(() => {
                sidebar.style.transform = 'translateX(0%)';
                overlay.style.opacity = '1';
            }, 10);
        }
    }
};

// Handle bfcache (browser back/forward cache)
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        App.checkAuth();
    }
});

window.onload = () => {
    App.registerSW();
    App.checkAuth();
};

// Inject global smooth animations for the entire app
(function injectAppAnimations() {
    const style = document.createElement('style');
    style.textContent = `
        /* Fade in on page load */
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
        }
        @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.95); }
            to   { opacity: 1; transform: scale(1); }
        }
        main, header { animation: fadeIn 0.25s ease-out; }
        section, .card-animate { animation: fadeInUp 0.3s ease-out both; }

        /* Stagger children */
        section:nth-child(1) { animation-delay: 0.05s; }
        section:nth-child(2) { animation-delay: 0.1s; }
        section:nth-child(3) { animation-delay: 0.15s; }
        section:nth-child(4) { animation-delay: 0.2s; }

        /* Button press feel */
        button:not(:disabled), a { transition: transform 0.1s, opacity 0.1s; }
        button:active:not(:disabled) { transform: scale(0.97); opacity: 0.85; }

        /* Nav icon hover */
        nav a span { transition: transform 0.2s; }
        nav a:hover span { transform: scale(1.15); }

        /* Modal slide up */
        #addTeacherModal > div, #resetPasswordModal > div,
        #changePasswordModal > div {
            animation: slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes slideUp {
            from { transform: translateY(40px); opacity: 0; }
            to   { transform: translateY(0); opacity: 1; }
        }

        /* Card hover lift */
        .bg-white.rounded-xl, .dark\\:bg-slate-900.rounded-xl,
        .bg-white.rounded-2xl, .dark\\:bg-slate-800.rounded-xl {
            transition: box-shadow 0.2s, transform 0.2s;
        }
        /* Prefer reduced motion */
        @media (prefers-reduced-motion: reduce) {
            *, ::before, ::after {
                animation-duration: 0.01ms !important;
                transition-duration: 0.01ms !important;
            }
        }
    `;
    document.head.appendChild(style);
})();
