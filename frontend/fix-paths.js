const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.html') || f === 'app.js');
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/href="\/(.*?)"/g, 'href="./$1"');
    content = content.replace(/src="\/(.*?)"/g, 'src="./$1"');
    content = content.replace(/window\.location\.href\s*=\s*'\/([^']+)'/g, "window.location.href = './$1'");
    fs.writeFileSync(f, content);
    console.log('Updated', f);
});
