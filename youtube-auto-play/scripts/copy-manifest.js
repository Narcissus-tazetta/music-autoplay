import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function copy(src, dest) {
    if (!fs.existsSync(src)) return;
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        for (const f of fs.readdirSync(src)) copy(path.join(src, f), path.join(dest, f));
    } else {
        fs.copyFileSync(src, dest);
    }
}

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
if (!fs.existsSync(dist)) fs.mkdirSync(dist);

const assets = ['manifest.json', 'musicvideo.png', 'socket.io.min.js'];
for (const a of assets) copy(path.join(root, a), path.join(dist, a));

try {
    const manifestPath = path.join(root, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.background && manifest.background.service_worker) {
        manifest.background.service_worker = 'background.js';
        if (!manifest.background.type) manifest.background.type = 'module';
    }
    if (Array.isArray(manifest.content_scripts)) {
        manifest.content_scripts = manifest.content_scripts.map(cs => {
            if (cs.js) {
                cs.js = cs.js.map(p => {
                    return path.basename(p);
                });
            }
            return cs;
        });
    }
    if (manifest.side_panel && manifest.side_panel.default_path) {
        const spPath = manifest.side_panel.default_path;
        const basename = path.basename(spPath);
        const builtCandidate = path.join(dist, 'src', 'popup', basename);
        if (fs.existsSync(builtCandidate)) {
            copy(builtCandidate, path.join(dist, basename));
            manifest.side_panel.default_path = basename;
        }
    }
    if (manifest.action && manifest.action.default_popup) {
        const apPath = manifest.action.default_popup;
        const basename = path.basename(apPath);
        const builtCandidate = path.join(dist, 'src', 'popup', basename);
        if (fs.existsSync(builtCandidate)) {
            copy(builtCandidate, path.join(dist, basename));
            manifest.action.default_popup = basename;
        }
    }

    fs.writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));
} catch (e) {
    console.error('failed to copy/adjust manifest', e);
}
