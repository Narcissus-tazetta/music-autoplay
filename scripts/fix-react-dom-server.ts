import fs from 'fs';
import path from 'path';

const reactDomServerBunPath = path.join(process.cwd(), 'node_modules', 'react-dom', 'server.bun.js');

// Delegate Bun's limited module to full Node.js version for SSR compatibility
if (fs.existsSync(reactDomServerBunPath)) {
    const delegateCode = "'use strict';\nmodule.exports = require('./server.node');";
    try {
        fs.writeFileSync(reactDomServerBunPath, delegateCode, 'utf8');
        console.log('✓ Patched react-dom/server.bun.js to use server.node');
    } catch (error) {
        console.error('✗ Failed to patch react-dom/server.bun.js:', error);
        process.exit(1);
    }
}
