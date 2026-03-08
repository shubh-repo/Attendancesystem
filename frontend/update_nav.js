const fs = require('fs');

const teacherHtmlFiles = ['dashboard.html', 'attendance-history.html', 'camera-screen.html', 'status-screen.html', 'profile.html'];

const teacherNavHtml = `    <!-- Bottom Navigation Bar -->
    <nav class="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-3 pb-8 pt-2 flex justify-between items-center max-w-[480px] mx-auto w-full">
        <a class="flex flex-col items-center flex-1 gap-1 text-slate-400 dark:text-slate-500 hover:text-primary transition-colors" href="./dashboard.html" id="nav-home">
            <span class="material-symbols-outlined">home</span>
            <p class="text-[10px] font-bold uppercase">Home</p>
        </a>
        <a class="flex flex-col items-center flex-1 gap-1 text-slate-400 dark:text-slate-500 hover:text-primary transition-colors" href="./attendance-history.html" id="nav-history">
            <span class="material-symbols-outlined">history</span>
            <p class="text-[10px] font-bold uppercase">History</p>
        </a>
        <a class="flex flex-col items-center flex-1 gap-1 text-slate-400 dark:text-slate-500 hover:text-primary transition-colors" href="#" onclick="alert('Classes tab will be used for selecting which class you are teaching today. Coming Soon!')">
            <span class="material-symbols-outlined">school</span>
            <p class="text-[10px] font-bold uppercase">Classes</p>
        </a>
        <a class="flex flex-col items-center flex-1 gap-1 text-slate-400 dark:text-slate-500 hover:text-primary transition-colors" href="./profile.html" id="nav-profile">
            <span class="material-symbols-outlined">person</span>
            <p class="text-[10px] font-bold uppercase">Profile</p>
        </a>
    </nav>`;

teacherHtmlFiles.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');

    // Replace existing nav
    if (content.match(/<nav[\s\S]*?<\/nav>/)) {
        content = content.replace(/<nav[\s\S]*?<\/nav>/, teacherNavHtml);

        // Default active states
        if (file === 'dashboard.html') {
            content = content.replace('text-slate-400 dark:text-slate-500 hover:text-primary transition-colors" href="./dashboard.html" id="nav-home"', 'text-primary" href="./dashboard.html" id="nav-home"');
            content = content.replace('<span class="material-symbols-outlined">home</span>', '<span class="material-symbols-outlined fill-[1]">home</span>');
        } else if (file === 'attendance-history.html') {
            content = content.replace('text-slate-400 dark:text-slate-500 hover:text-primary transition-colors" href="./attendance-history.html" id="nav-history"', 'text-primary" href="./attendance-history.html" id="nav-history"');
            content = content.replace('<span class="material-symbols-outlined">history</span>', '<span class="material-symbols-outlined fill-[1]">history</span>');
        } else if (file === 'profile.html') {
            content = content.replace('text-slate-400 dark:text-slate-500 hover:text-primary transition-colors" href="./profile.html" id="nav-profile"', 'text-primary" href="./profile.html" id="nav-profile"');
            content = content.replace('<span class="material-symbols-outlined">person</span>', '<span class="material-symbols-outlined fill-[1]">person</span>');
        }

        fs.writeFileSync(file, content);
    }
});
console.log('Replaced bottom nav for Teachers: Linking Profile.html, keeping padding large enough to prevent text cutoff.');
