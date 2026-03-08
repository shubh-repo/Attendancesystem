const fs = require('fs');
const path = require('path');

const dir = __dirname;

const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    let content = fs.readFileSync(path.join(dir, file), 'utf8');

    // 1. Fix back buttons (arrow_back) to go to previous page or dashboard
    let backButtonRegex1 = /<div([^>]*?)>\s*<span class="material-symbols-outlined[^"]*?">arrow_back<\/span>\s*<\/div>/g;
    content = content.replace(backButtonRegex1, (match, attrs) => {
        // Find what dashboard to link to based on filename
        let target = file.startsWith('admin') || file === 'teacher-management.html' || file === 'monthly-export.html' || file === 'attendance-monitoring.html'
            ? './admin-dashboard.html' : './dashboard.html';

        // If it's already an 'a' tag or button with onclick, skip (though regex looks for div)
        if (attrs.includes('onclick') || attrs.includes('href')) return match;
        return `<a href="${target}" ${attrs}>\n                <span class="material-symbols-outlined">arrow_back</span>\n            </a>`;
    });

    // 2. Fix Teacher Dashboard bottom nav
    if (file === 'dashboard.html' || file === 'attendance-history.html') {
        content = content.replace(/href="#"(\s*onclick="App.logout\(\)")?/g, (match, logout) => {
            if (logout) return match; // Keep logout
            return 'href="#"'; // Placeholder for next step
        });

        // Specific replaces
        content = content.replace(/href="#"(.*?)>(\s*<span class="material-symbols.*?">home<\/span>)/g, 'href="./dashboard.html"$1>$2');
        content = content.replace(/href="#"(.*?)>(\s*<span class="material-symbols.*?">history<\/span>)/g, 'href="./attendance-history.html"$1>$2');
        content = content.replace(/href="#"(.*?)>(\s*<span class="material-symbols.*?">class<\/span>)/g, 'href="#" onclick="alert(\'Classes module coming soon!\')"$1>$2');

        // Fix Top Menu Button
        content = content.replace(/<div([^>]*?)>\s*<span class="material-symbols-outlined">menu<\/span>\s*<\/div>/,
            `<button onclick="alert('Sidebar Menu Coming Soon!')" $1>\n            <span class="material-symbols-outlined">menu</span>\n        </button>`);
    }

    // 3. Fix Admin Top Menu / Back buttons
    if (file.startsWith('admin') || file === 'teacher-management.html' || file === 'attendance-monitoring.html') {
        content = content.replace(/<button([^>]*?)>\s*<span class="material-symbols-outlined">notifications<\/span>\s*<\/button>/,
            `<button onclick="alert('Notifications Coming Soon')" $1>\n                <span class="material-symbols-outlined">notifications</span>\n            </button>`);
    }

    fs.writeFileSync(path.join(dir, file), content, 'utf8');
    console.log(`Processed ${file}`);
});
