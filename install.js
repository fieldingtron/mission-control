import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import http from 'node:http';
import https from 'node:https';

const platform = os.platform();
const isWin = platform === 'win32';
const isMac = platform === 'darwin';

async function run() {
    console.log('📦 Starting Mission Control Universal Installer...');

    // 1. Check Node Version
    const nodeVersion = process.versions.node.split('.')[0];
    if (parseInt(nodeVersion) < 18) {
        console.error('❌ Error: Node.js version 18 or higher is required.');
        process.exit(1);
    }

    // 2. Install Dependencies
    console.log('📥 Installing root dependencies...');
    try {
        execSync('npm install', { stdio: 'inherit' });
    } catch (e) {
        console.error('❌ Error installing root dependencies.');
    }

    console.log('📥 Installing localhost-dev dependencies...');
    try {
        execSync('npm install', { cwd: './localhost-dev', stdio: 'inherit' });
    } catch (e) {
        console.error('❌ Error installing localhost-dev dependencies.');
    }

    // 3. Install Caddy
    if (isMac) {
        console.log('🍎 Detected macOS. Checking for Caddy via Homebrew...');
        try {
            execSync('caddy version', { stdio: 'ignore' });
            console.log('✅ Caddy is already installed.');
        } catch (e) {
            console.log('🍺 Caddy not found. Installing via Homebrew...');
            try {
                execSync('brew install caddy', { stdio: 'inherit' });
            } catch (err) {
                console.error('❌ Failed to install Caddy. Please install Homebrew or Caddy manually: https://caddyserver.com/docs/install#macos');
            }
        }
    } else if (isWin) {
        console.log('🪟 Detected Windows. Checking for Caddy...');
        try {
            execSync('caddy version', { stdio: 'ignore' });
            console.log('✅ Caddy is already in your PATH.');
        } catch (e) {
            console.log('💾 Caddy not found. Downloading the official binary...');
            const binDir = join(process.cwd(), '.bin');
            if (!existsSync(binDir)) mkdirSync(binDir);

            const caddyPath = join(binDir, 'caddy.exe');
            // For simplicity in this demo, we'll direct the user or provide a helper download
            // In a real prod script, we'd use 'https' module to download the zip from GitHub releases
            console.log('🔗 Please download Caddy for Windows from: https://caddyserver.com/download');
            console.log(`📂 Place the caddy.exe in: ${binDir}`);
        }
    } else {
        console.log('🐧 Detected Linux or other OS. Please ensure Caddy is installed manually.');
    }

    // 4. Verify Localhost Mapping
    console.log('🌐 Verifying dashboard.localhost resolution...');
    try {
        // This is a basic check. Most modern OSs resolve *.localhost to loopback.
        const res = spawnSync('ping', [isWin ? '-n' : '-c', '1', 'dashboard.localhost']);
        if (res.status === 0) {
            console.log('✅ dashboard.localhost is resolving correctly.');
        } else {
            console.warn('⚠️  Warning: dashboard.localhost does not seem to resolve.');
            console.log('🔧 You may need to add this line to your /etc/hosts (Mac/Linux) or C:\\Windows\\System32\\drivers\\etc\\hosts (Windows):');
            console.log('   127.0.0.1 dashboard.localhost');
        }
    } catch (e) {
        console.warn('⚠️  Could not verify hostname resolution.');
    }

    console.log('\n✨ Setup complete!');
    console.log('🚀 Run the dashboard with: npm run dev');
    console.log('📊 It will be available at: https://dashboard.localhost');
    console.log('\n🔐 Tip: To make your browser "Secure" (no warning), run:');
    console.log('   sudo caddy trust');
}

run().catch(err => {
    console.error('💥 Installer failed:', err);
    process.exit(1);
});
