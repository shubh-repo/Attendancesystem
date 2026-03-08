const fs = require('fs');
const path = require('path');

const teacherNavHtml = `    <!-- Bottom Navigation Bar -->
    <nav class="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 pb-6 pt-2 flex justify-around items-center max-w-[480px] mx-auto w-full">
        <a class="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500 hover:text-primary transition-colors" href="./dashboard.html" id="nav-home">
            <span class="material-symbols-outlined">home</span>
            <p class="text-[10px] font-bold uppercase">Home</p>
        </a>
        <a class="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500 hover:text-primary transition-colors" href="./attendance-history.html" id="nav-history">
            <span class="material-symbols-outlined">history</span>
            <p class="text-[10px] font-bold uppercase">History</p>
        </a>
        <a class="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500 hover:text-primary transition-colors" href="#" onclick="alert('Classes module coming soon!')">
            <span class="material-symbols-outlined">class</span>
            <p class="text-[10px] font-bold uppercase">Classes</p>
        </a>
        <a class="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500 hover:text-primary transition-colors" href="#" onclick="App.logout(); return false;">
            <span class="material-symbols-outlined">logout</span>
            <p class="text-[10px] font-bold uppercase">Logout</p>
        </a>
    </nav>`;

['dashboard.html', 'attendance-history.html'].forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // Replace everything from <nav to </nav>
    content = content.replace(/<nav[\s\S]*?<\/nav>/, teacherNavHtml);

    // Set active state based on file
    if (file === 'dashboard.html') {
        content = content.replace('text-slate-400 dark:text-slate-500 hover:text-primary transition-colors" href="./dashboard.html" id="nav-home"', 'text-primary" href="./dashboard.html" id="nav-home"');
        content = content.replace('<span class="material-symbols-outlined">home</span>', '<span class="material-symbols-outlined fill-[1]">home</span>');
    } else if (file === 'attendance-history.html') {
        content = content.replace('text-slate-400 dark:text-slate-500 hover:text-primary transition-colors" href="./attendance-history.html" id="nav-history"', 'text-primary" href="./attendance-history.html" id="nav-history"');
        content = content.replace('<span class="material-symbols-outlined">history</span>', '<span class="material-symbols-outlined fill-[1]">history</span>');
    }

    fs.writeFileSync(file, content);
});

console.log('Teacher bottom nav replaced globally');
