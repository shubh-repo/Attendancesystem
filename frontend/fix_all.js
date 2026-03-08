const fs = require('fs');

// ===========================
// Define correct nav blocks
// ===========================

const TEACHER_NAV = `    <!-- Bottom Navigation Bar -->
    <nav class="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-3 pb-8 pt-2 flex justify-around items-center max-w-[480px] mx-auto w-full">
        <a class="flex flex-col items-center flex-1 gap-1 NAV_HOME_CLASS" href="./dashboard.html">
            <span class="material-symbols-outlined NAV_HOME_FILL">home</span>
            <p class="text-[10px] font-bold uppercase">Home</p>
        </a>
        <a class="flex flex-col items-center flex-1 gap-1 NAV_HISTORY_CLASS" href="./attendance-history.html">
            <span class="material-symbols-outlined NAV_HISTORY_FILL">history</span>
            <p class="text-[10px] font-bold uppercase">History</p>
        </a>
        <a class="flex flex-col items-center flex-1 gap-1 NAV_PROFILE_CLASS" href="./profile.html">
            <span class="material-symbols-outlined NAV_PROFILE_FILL">person</span>
            <p class="text-[10px] font-bold uppercase">Profile</p>
        </a>
    </nav>`;

const ADMIN_NAV = `    <!-- Admin Bottom Navigation Bar -->
    <nav class="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-3 pb-8 pt-2 flex justify-around items-center max-w-[480px] mx-auto w-full">
        <a class="flex flex-col items-center flex-1 gap-1 ADMIN_NAV_DASH" href="./admin-dashboard.html">
            <span class="material-symbols-outlined ADMIN_DASH_FILL">dashboard</span>
            <p class="text-[10px] font-bold uppercase">Home</p>
        </a>
        <a class="flex flex-col items-center flex-1 gap-1 ADMIN_NAV_TEACHERS" href="./teacher-management.html">
            <span class="material-symbols-outlined ADMIN_TEACHERS_FILL">group</span>
            <p class="text-[10px] font-bold uppercase">Teachers</p>
        </a>
        <a class="flex flex-col items-center flex-1 gap-1 ADMIN_NAV_MONITOR" href="./attendance-monitoring.html">
            <span class="material-symbols-outlined ADMIN_MONITOR_FILL">analytics</span>
            <p class="text-[10px] font-bold uppercase">Monitor</p>
        </a>
        <a class="flex flex-col items-center flex-1 gap-1 text-red-500 hover:text-red-700 transition-colors" href="#" onclick="App.logout(); return false;">
            <span class="material-symbols-outlined">logout</span>
            <p class="text-[10px] font-bold uppercase">Sign Out</p>
        </a>
    </nav>`;

// Active states
const ACTIVE = 'text-primary';
const INACTIVE = 'text-slate-400 dark:text-slate-500 hover:text-primary transition-colors';

// Teacher pages
const teacherFiles = {
    'dashboard.html': 'home',
    'attendance-history.html': 'history',
    'profile.html': 'profile',
    'camera-screen.html': 'none',
    'status-screen.html': 'none'
};

// Admin pages
const adminFiles = {
    'admin-dashboard.html': 'dashboard',
    'teacher-management.html': 'teachers',
    'attendance-monitoring.html': 'monitor'
};

// ===========================
// Fix teacher pages
// ===========================
Object.entries(teacherFiles).forEach(([file, active]) => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');

    let nav = TEACHER_NAV;
    nav = nav.replace('NAV_HOME_CLASS', active === 'home' ? ACTIVE : INACTIVE);
    nav = nav.replace('NAV_HISTORY_CLASS', active === 'history' ? ACTIVE : INACTIVE);
    nav = nav.replace('NAV_PROFILE_CLASS', active === 'profile' ? ACTIVE : INACTIVE);
    nav = nav.replace('NAV_HOME_FILL', active === 'home' ? 'filled' : '');
    nav = nav.replace('NAV_HISTORY_FILL', active === 'history' ? 'filled' : '');
    nav = nav.replace('NAV_PROFILE_FILL', active === 'profile' ? 'filled' : '');

    // Replace existing nav block
    if (content.match(/<nav[\s\S]*?<\/nav>/)) {
        content = content.replace(/<nav[\s\S]*?<\/nav>/, nav);
    } else {
        // Insert before </body>
        content = content.replace('</body>', nav + '\n</body>');
    }

    // Ensure proper Material Icons font
    if (!content.includes('Material+Symbols+Outlined:opsz,wght,FILL,GRAD')) {
        content = content.replace(
            /<link[^>]*Material\+Symbols\+Outlined[^>]*>/g,
            '<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />'
        );
    }

    // [IMPORTANT] Also remove any duplicate static nav blocks left over
    content = content.replace(/\s*<!-- Bottom Navigation Bar -->\n\s*<!-- Bottom Navigation Bar -->/g, '\n<!-- Bottom Navigation Bar -->');

    fs.writeFileSync(file, content);
});

// ===========================
// Fix admin pages
// ===========================
Object.entries(adminFiles).forEach(([file, active]) => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');

    let nav = ADMIN_NAV;
    nav = nav.replace('ADMIN_NAV_DASH', active === 'dashboard' ? ACTIVE : INACTIVE);
    nav = nav.replace('ADMIN_NAV_TEACHERS', active === 'teachers' ? ACTIVE : INACTIVE);
    nav = nav.replace('ADMIN_NAV_MONITOR', active === 'monitor' ? ACTIVE : INACTIVE);
    nav = nav.replace('ADMIN_DASH_FILL', active === 'dashboard' ? 'filled' : '');
    nav = nav.replace('ADMIN_TEACHERS_FILL', active === 'teachers' ? 'filled' : '');
    nav = nav.replace('ADMIN_MONITOR_FILL', active === 'monitor' ? 'filled' : '');

    // Replace existing nav block (any nav)
    if (content.match(/<nav[\s\S]*?<\/nav>/)) {
        content = content.replace(/<nav[\s\S]*?<\/nav>/, nav);
    } else {
        content = content.replace('</body>', nav + '\n</body>');
    }

    // Ensure proper Material Icons font
    content = content.replace(
        /<link[^>]*Material\+Symbols\+Outlined[^>]*>/g,
        '<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />'
    );

    fs.writeFileSync(file, content);
});

console.log('All pages fixed: Teacher nav (3 items), Admin nav (4 items + logout), Icons font updated.');
