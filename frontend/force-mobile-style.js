import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const directoryPath = __dirname;
const mobileStyle = `\n    <style>
        body {
            max-width: 480px !important;
            margin: 0 auto !important;
            box-shadow: 0 0 40px rgba(0, 0, 0, 0.1) !important;
            position: relative;
            background-color: #f8fafc; /* To make the container stand out on PC */
        }
        @media (prefers-color-scheme: dark) {
            body {
                background-color: #0f172a;
                box-shadow: 0 0 40px rgba(0, 0, 0, 0.4) !important;
            }
        }
    </style>\n</head>`;

fs.readdir(directoryPath, (err, files) => {
    files.forEach((file) => {
        if (path.extname(file) === '.html') {
            let filePath = path.join(directoryPath, file);
            let content = fs.readFileSync(filePath, 'utf8');

            if (!content.includes('max-width: 480px !important')) {
                content = content.replace('</head>', mobileStyle);
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Injected strict mobile style into ${file}`);
            }
        }
    });
});
