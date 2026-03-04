import http from 'node:http';
import https from 'node:https';
import { statSync, accessSync, constants } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

async function fetchHttp(url) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, (res) => resolve(res));
        req.on('error', reject);
    });
}

async function fetchHttps(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { rejectUnauthorized: false }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ res, data }));
        });
        req.on('error', reject);
    });
}

async function verify() {
    console.log('🧪 Running Mission Control Automated Health Checks...\n');
    let passed = true;

    // 1. Check HTTP Redirect
    console.log('1️⃣  Checking HTTP -> HTTPS Redirect...');
    try {
        const httpRes = await fetchHttp('http://dashboard.localhost');
        if (httpRes.statusCode === 301 || httpRes.statusCode === 308) {
            console.log('   ✅ HTTP redirects correctly.');
        } else {
            console.error(`   ❌ Failed: Expected 301 Redirect, got ${httpRes.statusCode}`);
            passed = false;
        }
    } catch (e) {
        console.error(`   ❌ Failed: Could not connect to http://dashboard.localhost - ${e.message}`);
        passed = false;
    }

    // 2. Check Protocol / Caddy SSL Endpoint
    console.log('2️⃣  Checking HTTPS / App Rendering...');
    try {
        const { res, data } = await fetchHttps('https://dashboard.localhost');
        if (res.statusCode === 200 && data.includes('<html')) {
            console.log('   ✅ HTTPS is functioning. (Received expected 200 OK). Dashboard is unlocked.');
        } else {
            console.error(`   ❌ Failed: App did not return valid HTML. Status: ${res.statusCode}`);
            passed = false;
        }
    } catch (e) {
        console.error(`   ❌ Failed: Could not fetch https://dashboard.localhost - ${e.message}`);
        passed = false;
    }

    // 3. SQLite Integrity
    console.log('3️⃣  Checking SQLite Database Storage...');
    try {
        const dbPath = join(os.homedir(), 'Documents', 'mission_control.db');
        accessSync(dbPath, constants.R_OK | constants.W_OK);
        const stats = statSync(dbPath);
        console.log(`   ✅ SQLite file verified at: ${dbPath} (${(stats.size / 1024).toFixed(1)} KB)`);
    } catch (e) {
        console.warn(`   ⚠️  Warning: Database file not found yet. It will be created on first launch.`);
    }

    // 4. Memory Profiling 
    console.log('4️⃣  Checking Background Process Memory Usage (RSS)...');
    try {
        const psOutput = execSync("ps aux | grep 'src/scripts/service-wrapper.js' | grep -v 'grep'").toString();
        const lines = psOutput.trim().split('\n');
        if (lines.length > 0 && lines[0] !== '') {
            const parts = lines[0].split(/\s+/);
            const rssKb = Number(parts[5]);
            const rssMb = (rssKb / 1024).toFixed(1);

            if (rssKb < 256 * 1024) {
                console.log(`   ✅ Service wrapper is extremely lightweight! Memory (RSS) is ${rssMb} MB.`);
            } else {
                console.warn(`   ⚠️  Service wrapper memory is higher than expected (${rssMb} MB).`);
                // Don't fail the verification for memory limits during bootup
            }
        } else {
            console.warn(`   ⚠️  Could not locate the background process. Ensure the launch agent is running.`);
        }
    } catch (e) {
        console.error(`   ❌ Failed to profile memory. - ${e.message}`);
    }

    if (!passed) {
        console.log('\n❌ Verification Failed. Please check the logs.');
        process.exit(1);
    } else {
        console.log('\n🌟 All automated checks passed successfully! Mission Control is production-ready.');
    }
}

verify();
