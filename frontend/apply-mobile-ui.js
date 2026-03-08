import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const directoryPath = __dirname;

fs.readdir(directoryPath, (err, files) => {
    if (err) {
        return console.log('Unable to scan directory: ' + err);
    }

    files.forEach((file) => {
        if (path.extname(file) === '.html') {
            let filePath = path.join(directoryPath, file);
            let content = fs.readFileSync(filePath, 'utf8');

            // Replace the main wrapper div
            const targetDiv = 'class="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark group/design-root overflow-x-hidden"';
            const replacementDiv = 'class="relative flex h-auto min-h-screen w-full max-w-[480px] mx-auto shadow-2xl flex-col bg-background-light dark:bg-background-dark group/design-root overflow-x-hidden"';

            if (content.includes(targetDiv)) {
                content = content.replace(targetDiv, replacementDiv);
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Updated mobile wrapper in ${file}`);
            }

            // Ensure body has background color so the 480px wrapper stands out on desktop
            const targetBody = 'class="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased"';
            const replacementBody = 'class="bg-slate-100 dark:bg-slate-950 font-display text-slate-900 dark:text-slate-100 antialiased"';

            if (content.includes(targetBody)) {
                content = content.replace(targetBody, replacementBody);
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Updated body background in ${file}`);
            }
        }
    });
});
