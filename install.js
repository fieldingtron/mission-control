import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import http from 'node:http';

const platform = os.platform();
const isWin = platform === 'win32';
const isMac = platform === 'darwin';

// Poll the Caddy admin API until it responds or timeout (seconds).
async function waitForCaddy(maxSeconds = 10) {
    for (let i = 0; i < maxSeconds * 2; i++) {
        await new Promise(r => setTimeout(r, 500));
        const ready = await new Promise(resolve => {
            const req = http.request(
                { hostname: 'localhost', port: 2019, path: '/config/', method: 'GET' },
                res => resolve(res.statusCode < 300)
            );
            req.on('error', () => resolve(false));
            req.end();
        });
        if (ready) return true;
    }
    return false;
}

async function run() {
    console.log('📦 Starting Mission Control Universal Installer...');

    // 1. Check Node Version
    const nodeVersion = process.versions.node.split('.')[0];
    if (parseInt(nodeVersion) < 18) {
        console.error('❌ Error: Node.js version 18 or higher is required.');
        process.exit(1);
    }

    // 2. Install npm Dependencies
    // Skip root npm install when invoked via postinstall to avoid infinite recursion
    const isPostinstall = process.env.npm_lifecycle_event === 'postinstall';
    if (!isPostinstall) {
        console.log('📥 Installing root dependencies...');
        try {
            execSync('npm install', { stdio: 'inherit' });
        } catch (e) {
            console.error('❌ Error installing root dependencies.');
        }
    }

    console.log('📥 Installing localhost-dev dependencies...');
    try {
        execSync('npm install', { cwd: './localhost-dev', stdio: 'inherit' });
    } catch (e) {
        console.error('❌ Error installing localhost-dev dependencies.');
    }

    // 3. Install and start Caddy as an autostart service
    let caddyReady = false;

    if (isMac) {
        console.log('\n🍎 macOS: Setting up Caddy...');

        // 3a. Install via Homebrew if needed
        try {
            execSync('caddy version', { stdio: 'ignore' });
            console.log('✅ Caddy is already installed.');
        } catch {
            console.log('🍺 Caddy not found. Installing via Homebrew...');
            try {
                execSync('brew install caddy', { stdio: 'inherit' });
            } catch {
                console.error('❌ Failed to install Caddy via Homebrew.');
                console.error('   Install manually: https://caddyserver.com/docs/install#macos');
            }
        }

        // 3b. Create the Caddyfile that the brew service expects (enables admin API on 2019).
        //     Routes and TLS are configured dynamically via the Admin API at dev time.
        const caddyFilePath = '/opt/homebrew/etc/Caddyfile';
        if (!existsSync(caddyFilePath)) {
            writeFileSync(caddyFilePath, '# Managed by Mission Control – do not remove\n{\n    admin localhost:2019\n}\n');
            console.log(`✅ Created ${caddyFilePath}`);
        }

        // 3c. Register as a launchd service so it autostarts on login, then start it.
        console.log('⚙️  Registering Caddy as a system service (autostarts on login)...');
        try {
            execSync('brew services start caddy', { stdio: 'inherit' });
        } catch {
            console.warn('⚠️  Could not start Caddy via brew services. Trying direct start...');
            try {
                execSync(`caddy start --config "${join(process.cwd(), 'caddy-config.json')}" --adapter json`, {
                    stdio: 'inherit'
                });
            } catch (e) {
                console.error('❌ Could not start Caddy:', e.message);
            }
        }

        // 3c. Wait for admin API
        console.log('⏳ Waiting for Caddy admin API...');
        caddyReady = await waitForCaddy(10);
        if (caddyReady) {
            console.log('✅ Caddy is running and admin API is available.');
        } else {
            console.warn('⚠️  Caddy admin API did not respond in time. Check: brew services list');
        }

    } else if (isWin) {
        console.log('\n🪟 Windows: Setting up Caddy...');

        let caddyExe = null;

        // 3a. Find or download caddy
        try {
            const result = spawnSync('where', ['caddy'], { encoding: 'utf8' });
            if (result.status === 0 && result.stdout.trim()) {
                caddyExe = result.stdout.trim().split('\n')[0].trim();
                console.log(`✅ Caddy found at: ${caddyExe}`);
            }
        } catch { }

        if (!caddyExe) {
            const binDir = join(process.cwd(), '.bin');
            const binPath = join(binDir, 'caddy.exe');
            if (existsSync(binPath)) {
                caddyExe = binPath;
                console.log(`✅ Caddy found at: ${caddyExe}`);
            } else {
                if (!existsSync(binDir)) mkdirSync(binDir);
                console.log('💾 Caddy not found. Download it from: https://caddyserver.com/download');
                console.log(`📂 Place caddy.exe in: ${binDir}`);
                console.log('   Then re-run: npm install');
            }
        }

        // 3b. Register as a Windows service (requires admin rights)
        if (caddyExe) {
            console.log('⚙️  Registering Caddy as a Windows service (autostarts with Windows)...');
            try {
                // Remove existing service if present (ignore errors)
                spawnSync('sc', ['stop', 'Caddy'], { stdio: 'ignore' });
                spawnSync('sc', ['delete', 'Caddy'], { stdio: 'ignore' });

                execSync(
                    `sc create Caddy binPath= "\\"${caddyExe}\\" run" start= auto displayName= "Caddy Web Server"`,
                    { stdio: 'inherit' }
                );
                execSync('sc start Caddy', { stdio: 'inherit' });
                console.log('✅ Caddy service registered and started.');
            } catch (e) {
                console.warn('⚠️  Could not register Caddy as a service (requires admin rights).');
                console.log('   Run this installer as Administrator, or register manually.');
                // Fallback: just start caddy directly
                try {
                    execSync(`"${caddyExe}" start`, { stdio: 'inherit' });
                } catch { }
            }

            // 3c. Wait for admin API
            console.log('⏳ Waiting for Caddy admin API...');
            caddyReady = await waitForCaddy(10);
            if (caddyReady) {
                console.log('✅ Caddy is running and admin API is available.');
            } else {
                console.warn('⚠️  Caddy admin API did not respond in time.');
            }
        }

    } else {
        // Linux
        console.log('\n🐧 Linux: Checking for Caddy...');
        try {
            execSync('caddy version', { stdio: 'ignore' });
            console.log('✅ Caddy is already installed.');

            // Try systemd service
            try {
                execSync('sudo systemctl enable --now caddy', { stdio: 'inherit' });
                console.log('✅ Caddy enabled as a systemd service.');
            } catch {
                // Fallback to direct start
                try {
                    execSync(`caddy start --config "${join(process.cwd(), 'caddy-config.json')}" --adapter json`, {
                        stdio: 'inherit'
                    });
                } catch { }
            }

            caddyReady = await waitForCaddy(10);
            if (caddyReady) console.log('✅ Caddy admin API is available.');
        } catch {
            console.log('⚠️  Caddy not found. Install it: https://caddyserver.com/docs/install');
        }
    }

    // 4. Trust Caddy's local CA so browsers show a secure lock (requires Caddy running)
    if (caddyReady) {
        console.log('\n🔐 Trusting Caddy local CA (may prompt for your password)...');
        try {
            if (isWin) {
                execSync('caddy trust', { stdio: 'inherit' });
            } else {
                execSync('sudo caddy trust', { stdio: 'inherit' });
            }
            console.log('✅ Caddy CA trusted — browsers will show a secure connection.');
        } catch (e) {
            console.warn('⚠️  Could not run caddy trust automatically.');
            console.warn('   Run manually to enable the secure lock: sudo caddy trust');
        }
    }

    // 5. Verify Localhost Mapping
    console.log('\n🌐 Verifying dashboard.localhost resolution...');
    try {
        const res = spawnSync('ping', [isWin ? '-n' : '-c', '1', 'dashboard.localhost']);
        if (res.status === 0) {
            console.log('✅ dashboard.localhost is resolving correctly.');
        } else {
            console.warn('⚠️  Warning: dashboard.localhost does not seem to resolve.');
            const hostsPath = isWin
                ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
                : '/etc/hosts';
            console.log(`🔧 Add this line to ${hostsPath}:`);
            console.log('   127.0.0.1 dashboard.localhost');
        }
    } catch {
        console.warn('⚠️  Could not verify hostname resolution.');
    }

    console.log('\n✨ Setup complete!');
    console.log('🚀 Run the dashboard with: npm run dev');
    console.log('📊 It will be available at: https://dashboard.localhost');
}

run().catch(err => {
    console.error('💥 Installer failed:', err);
    process.exit(1);
});
