import { spawn, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import http from 'node:http';

// Caddy Admin API helper (module-level so ensureCaddy can use it)
const caddyRequest = (path, method, body) => {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 2019,
            path,
            method,
            headers: body ? { 'Content-Type': 'application/json' } : {}
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data ? JSON.parse(data) : null);
                } else {
                    reject(new Error(`Caddy API error: ${res.statusCode} - ${data}`));
                }
            });
        });
        req.on('error', () => reject(new Error(`Could not connect to Caddy Admin API. Is Caddy running? Try: brew services start caddy`)));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
};

// Start Caddy if its admin API is not reachable, then wait for it to be ready.
// Also ensures the HTTP server (srv0) and TLS app exist, since Caddy may have
// been launched from a minimal Caddyfile that only enables the admin API.
async function ensureCaddy() {
    const isRunning = await caddyRequest('/config/', 'GET').then(() => true).catch(() => false);

    if (!isRunning) {
        console.log('🔄 Caddy is not running. Starting it now...');
        const configPath = join(process.cwd(), 'caddy-config.json');
        const result = spawnSync('caddy', ['start', '--config', configPath, '--adapter', 'json'], {
            stdio: 'inherit'
        });

        if (result.error || (result.status !== 0 && result.status !== null)) {
            throw new Error(
                `Could not start Caddy: ${result.error?.message || `exit code ${result.status}`}. ` +
                `Install it first: brew install caddy`
            );
        }

        // Poll admin API until ready (up to 5 seconds)
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 500));
            const ready = await caddyRequest('/config/', 'GET').then(() => true).catch(() => false);
            if (ready) {
                console.log('✅ Caddy started successfully.');
                break;
            }
            if (i === 9) throw new Error('Caddy started but admin API is not responding after 5 seconds.');
        }
    }

    // Ensure the HTTP server (srv0) and TLS automation exist.
    // They may be absent when Caddy was launched from the minimal Caddyfile.
    const current = await caddyRequest('/config/', 'GET').catch(() => ({}));
    const hasSrv0 = current?.apps?.http?.servers?.srv0;
    const hasTLS = current?.apps?.tls;

    if (!hasSrv0 || !hasTLS) {
        console.log('⚙️  Initializing Caddy HTTP server and TLS configuration...');
        await caddyRequest('/config/', 'PUT', {
            admin: { listen: 'localhost:2019' },
            apps: {
                http: {
                    servers: {
                        srv0: {
                            listen: [':80', ':443'],
                            routes: hasSrv0?.routes || []
                        }
                    }
                },
                tls: hasTLS || { automation: { policies: [] } }
            }
        });
        console.log('✅ Caddy HTTP server initialized.');
    }
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: localhost-dev <command> [args...]');
        process.exit(1);
    }

    // 1. Read package.json
    const pkgPath = join(process.cwd(), 'package.json');
    let pkg;
    try {
        pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
    } catch (err) {
        console.error('Error: Could not find or read package.json in current directory.');
        process.exit(1);
    }

    // 2. Determine hostname
    let hostname = pkg.localhost || pkg.name;
    if (!hostname) {
        console.error('Error: package.json must have a "name" or "localhost" field.');
        process.exit(1);
    }
    if (!hostname.includes('.')) {
        hostname = `${hostname}.localhost`;
    }

    // 3. Deterministic port (10000-59999)
    const hash = createHash('md5').update(hostname).digest('hex');
    const port = 10000 + (parseInt(hash.slice(0, 8), 16) % 50000);

    const routeId = `localhost-dev-${pkg.name || 'app'}`;

    try {
        console.log(`🚀 Starting localhost-dev for ${hostname}...`);

        // 4. Ensure Caddy is running before touching its API
        await ensureCaddy();

        // 5. Setup Caddy Routes (Idempotent)

        // Check if policy already exists
        const policies = await caddyRequest('/config/apps/tls/automation/policies', 'GET').catch(() => []);
        const hasPolicy = Array.isArray(policies) && policies.some(p => p.subjects && p.subjects.includes(hostname));

        if (!hasPolicy) {
            await caddyRequest('/config/apps/tls/automation/policies', 'POST', {
                subjects: [hostname],
                issuers: [{ module: 'internal' }]
            }).catch(err => {
                if (!err.message.includes('already exists')) {
                    console.warn(`⚠️  Note: Could not set TLS policy: ${err.message}`);
                }
            });
        }

        // Setup/Update HTTP Redirect Route (Idempotent)
        await caddyRequest(`/config/apps/http/servers/srv0/routes`, 'POST', {
            "@id": `${routeId}-redir`,
            match: [{ host: [hostname], protocol: "http" }],
            handle: [{
                handler: "static_response",
                status_code: 301,
                headers: { "Location": ["https://{http.request.host}{http.request.uri}"] }
            }]
        }).catch(async () => {
            await caddyRequest(`/id/${routeId}-redir`, 'PUT', {
                match: [{ host: [hostname], protocol: "http" }],
                handle: [{
                    handler: "static_response",
                    status_code: 301,
                    headers: { "Location": ["https://{http.request.host}{http.request.uri}"] }
                }]
            }).catch(e => console.warn(`⚠️  Warning updating redirect: ${e.message}`));
        });

        // Setup/Update Proxy Route
        await caddyRequest(`/config/apps/http/servers/srv0/routes`, 'POST', {
            "@id": routeId,
            match: [{ host: [hostname] }],
            handle: [{
                handler: "reverse_proxy",
                upstreams: [{ dial: `localhost:${port}` }]
            }]
        }).catch(async (err) => {
            await caddyRequest(`/id/${routeId}`, 'PUT', {
                match: [{ host: [hostname] }],
                handle: [{
                    handler: "reverse_proxy",
                    upstreams: [{ dial: `localhost:${port}` }]
                }]
            }).catch(e => {
                console.warn(`⚠️  Warning updating route: ${e.message}`);
            });
        });

        console.log(`✅ Proxy: http://${hostname} -> localhost:${port}`);
        console.log(`✅ Proxy: https://${hostname} -> localhost:${port}`);

        // 6. Start Child Process
        const [cmd, ...cmdArgs] = args;
        const isNpmRun = cmd === 'npm' && (cmdArgs[0] === 'run' || cmdArgs[0] === 'exec');
        const finalArgs = isNpmRun
            ? [...cmdArgs, '--', '--port', port.toString()]
            : [...cmdArgs, '--port', port.toString()];

        console.log(`🏃 Running: ${cmd} ${finalArgs.join(' ')}`);
        const child = spawn(cmd, finalArgs, {
            stdio: 'inherit',
            shell: true
        });

        const cleanup = async () => {
            console.log('\n🧹 Cleaning up Caddy routes...');
            try {
                await caddyRequest(`/id/${routeId}`, 'DELETE');
            } catch (e) { }
            try {
                await caddyRequest(`/id/${routeId}-redir`, 'DELETE');
            } catch (e) { }
            process.exit();
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        child.on('exit', cleanup);

    } catch (err) {
        console.error(`❌ Error: ${err.message}`);
        process.exit(1);
    }
}

main();
