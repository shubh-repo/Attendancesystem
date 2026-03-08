const fs = require('fs');
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.html'));

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // Fix overly wide fixed bottom navs
    content = content.replace(/class="([^"]*?bottom-0[^"]*?fixed[^"]*?|fixed[^"]*?bottom-0[^"]*?)"/g, (match, classes) => {
        if (!classes.includes('max-w-[480px]') && (classes.includes('w-full') || classes.includes('left-0'))) {
            return `class="${classes} max-w-[480px] mx-auto"`;
        }
        return match;
    });

    // Fix sticky bottom navs
    content = content.replace(/class="([^"]*?sticky[^"]*?bottom-0[^"]*?)"/g, (match, classes) => {
        if (!classes.includes('max-w-[480px]') && classes.includes('w-full')) {
            return `class="${classes} max-w-[480px] mx-auto"`;
        }
        return match;
    });

    // Fix sticky headers overflowing
    content = content.replace(/class="([^"]*?sticky[^"]*?top-0[^"]*?)"/g, (match, classes) => {
        if (!classes.includes('max-w-[480px]')) {
            // Only if it has w-full or isn't restricted by a parent container, though sticky usually spans whole width context.
            return `class="${classes} max-w-[480px] mx-auto w-full"`;
        }
        return match;
    });

    // Wire up the menu buttons
    content = content.replace(/onclick="alert\('Sidebar Menu Coming Soon!'\)"/g, `onclick="App.toggleSidebar()"`);

    fs.writeFileSync(file, content);
});
console.log('Layout patched for 480px max-width boundary and sidebar hooked up.');
