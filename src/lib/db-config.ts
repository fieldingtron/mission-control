import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = join(__dirname, '../../data/db-config.json');

export type DbProvider = 'sqlite' | 'turso' | 'supabase';

export interface DbConfig {
    provider: DbProvider;
    tursoUrl?: string;
    tursoToken?: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
}

const defaultConfig: DbConfig = {
    provider: 'sqlite'
};

export function getDbConfig(): DbConfig {
    if (!existsSync(configPath)) {
        return defaultConfig;
    }
    try {
        const data = readFileSync(configPath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Error reading db-config.json:', e);
        return defaultConfig;
    }
}

export function saveDbConfig(config: DbConfig): void {
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}
