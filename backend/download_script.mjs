import fs from 'fs';
import https from 'https';
import path from 'path';

const screens = [
    { "title": "Dashboard", "url": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzdlMzIzMjgwOGEzNzQ2MzA4MjE3YTU5NmE4YmU2M2E0EgsSBxDOreLcuxIYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzMwNzgyNjgwMDY0NjU3NjYyMQ&filename=&opi=89354086" },
    { "title": "Teacher Management", "url": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2FkZWJiMjhlNjNmYzRmZDY4OThlOTlhYTNjNWUzZjU3EgsSBxDOreLcuxIYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzMwNzgyNjgwMDY0NjU3NjYyMQ&filename=&opi=89354086" },
    { "title": "Admin Dashboard", "url": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzE4MDk0ZDA1NDE1NjQyMTE5MjQzODNiN2M4YjBiZTk5EgsSBxDOreLcuxIYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzMwNzgyNjgwMDY0NjU3NjYyMQ&filename=&opi=89354086" },
    { "title": "Login Page", "url": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2FhYmI1NjNkMzg0ZDQ1MjM5OTRiYjM3MDllNGVmOTFjEgsSBxDOreLcuxIYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzMwNzgyNjgwMDY0NjU3NjYyMQ&filename=&opi=89354086" },
    { "title": "GPS Location Warning", "url": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzY0NDNiN2YzZWRjNTQ3OWY4ZTFiNGRlNzcyNWEyYWFjEgsSBxDOreLcuxIYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzMwNzgyNjgwMDY0NjU3NjYyMQ&filename=&opi=89354086" },
    { "title": "Attendance Monitoring", "url": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzIzNTI5YzViNTMwMTRmODJiMmJhMjliZGVmNTgwNWU1EgsSBxDOreLcuxIYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzMwNzgyNjgwMDY0NjU3NjYyMQ&filename=&opi=89354086" },
    { "title": "Camera Screen", "url": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2IwZWVlNjUwNGYxOTQ2ZGM4ZTQzZTFhNWZiMWZiOGY0EgsSBxDOreLcuxIYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzMwNzgyNjgwMDY0NjU3NjYyMQ&filename=&opi=89354086" },
    { "title": "Status Screen", "url": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2FhMWZkMWYzZGNiNTQwYTY5ZDY4ZjIyMmY0Mzk1ZjQ0EgsSBxDOreLcuxIYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzMwNzgyNjgwMDY0NjU3NjYyMQ&filename=&opi=89354086" },
    { "title": "Attendance History", "url": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2IxMTAzZWEzMmI3YzQxN2FhMjg1YTFhZDcwZDdlNTQwEgsSBxDOreLcuxIYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzMwNzgyNjgwMDY0NjU3NjYyMQ&filename=&opi=89354086" },
    { "title": "Monthly Export", "url": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2M4Y2UxODQ0MGIwYjQwNzZhNWRmZjBlZGE2Zjk0M2MwEgsSBxDOreLcuxIYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzMwNzgyNjgwMDY0NjU3NjYyMQ&filename=&opi=89354086" },
    { "title": "Admin Settings", "url": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2FlNWE4ZTUyOTdlODRiMGZhMDQ2ZTY2NDQ2YTJkZDFjEgsSBxDOreLcuxIYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzMwNzgyNjgwMDY0NjU3NjYyMQ&filename=&opi=89354086" }
];

const dir = path.join(process.cwd(), '..', 'frontend');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

const download = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
};

const toFilename = (str) => {
    return str.toLowerCase().replace(/\s+/g, '-') + '.html';
};

async function main() {
    for (let s of screens) {
        const filename = toFilename(s.title);
        const dest = path.join(dir, filename);
        if (filename === 'login-page.html') {
            try { await download(s.url, path.join(dir, 'index.html')); } catch (e) { }
        } else {
            try { await download(s.url, dest); console.log(`Downloaded ${filename}`); } catch (e) { console.error(e) }
        }
    }
}

main();
