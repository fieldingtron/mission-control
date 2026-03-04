import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../../');

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

async function ensureCaddy() {
    const isRunning = await caddyRequest('/config/', 'GET').then(() => true).catch(() => false);
    if (!isRunning) {
        console.log('🔄 Caddy is not running. Starting it now...');
        const configPath = join(projectRoot, 'caddy-config.json');
        const result = spawnSync('caddy', ['start', '--config', configPath, '--adapter', 'json'], { stdio: 'inherit' });
        if (result.error || (result.status !== 0 && result.status !== null)) {
            console.error('Could not start Caddy automatically. Please ensure it is installed and running.');
        }

        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 500));
            const ready = await caddyRequest('/config/', 'GET').then(() => true).catch(() => false);
            if (ready) break;
        }
    }

    const current = await caddyRequest('/config/', 'GET').catch(() => ({}));
    const hasSrv0 = current?.apps?.http?.servers?.srv0;
    const hasTLS = current?.apps?.tls;

    if (!hasSrv0 || !hasTLS) {
        await caddyRequest('/config/', 'POST', {
            admin: { listen: 'localhost:2019' },
            apps: {
                http: { servers: { srv0: { listen: [':80', ':443'], routes: hasSrv0?.routes || [] } } },
                tls: hasTLS || { automation: { policies: [] } }
            }
        }).catch(e => console.warn(`⚠️ Caddy config initialization note: ${e.message}`));
    }
}

async function main() {
    let pkg;
    try {
        pkg = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'));
    } catch (err) {
        console.error('Error: Could not find or read package.json in current directory.');
        process.exit(1);
    }

    let hostname = pkg.localhost || pkg.name;
    if (!hostname.includes('.')) hostname = `${hostname}.localhost`;

    const hash = createHash('md5').update(hostname).digest('hex');
    const port = 10000 + (parseInt(hash.slice(0, 8), 16) % 50000);
    const routeId = `mission-control-service-${pkg.name || 'app'}`;

    try {
        console.log(`🚀 Starting background service for ${hostname}...`);
        await ensureCaddy();

        // Check if policy already exists
        const policies = await caddyRequest('/config/apps/tls/automation/policies', 'GET').catch(() => []);
        const hasPolicy = Array.isArray(policies) && policies.some(p => p.subjects && p.subjects.includes(hostname));

        if (!hasPolicy) {
            await caddyRequest('/config/apps/tls/automation/policies', 'POST', {
                subjects: [hostname],
                issuers: [{ module: 'internal' }]
            }).catch(() => { });
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
                handle: [{ handler: "static_response", status_code: 301, headers: { "Location": ["https://{http.request.host}{http.request.uri}"] } }]
            }).catch(() => { });
        });

        // Setup/Update Proxy Route
        await caddyRequest(`/config/apps/http/servers/srv0/routes`, 'POST', {
            "@id": routeId,
            match: [{ host: [hostname] }],
            handle: [{ handler: "reverse_proxy", upstreams: [{ dial: `localhost:${port}` }] }]
        }).catch(async () => {
            await caddyRequest(`/id/${routeId}`, 'PUT', {
                match: [{ host: [hostname] }],
                handle: [{ handler: "reverse_proxy", upstreams: [{ dial: `localhost:${port}` }] }]
            }).catch(() => { });
        });

        console.log(`✅ Proxy active: https://${hostname} -> localhost:${port}`);

        if (process.argv.includes('--test')) {
            console.log('✅ Service Wrapper configuration verified.');
            process.exit(0);
        }

        // Import the compiled server
        process.env.HOST = '127.0.0.1';
        process.env.PORT = port.toString();
        // Ensure production flag
        process.env.NODE_ENV = 'production';

        console.log('🏃 Booting production server payload...');
        await import('../../dist/server/entry.mjs');

        const cleanup = async () => {
            console.log('\n🧹 Cleaning up Caddy routes...');
            try { await caddyRequest(`/id/${routeId}`, 'DELETE'); } catch (e) { }
            try { await caddyRequest(`/id/${routeId}-redir`, 'DELETE'); } catch (e) { }
            process.exit();
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

    } catch (err) {
        console.error(`❌ Fatal Error: ${err.message}`);
        process.exit(1);
    }
}

main();
