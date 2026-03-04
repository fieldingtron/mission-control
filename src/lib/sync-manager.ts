import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import db, { Backup, Category, Link, Panel, Snapshot } from './db.js';

const homedir = os.homedir();
const docDir = join(homedir, 'Documents');
const syncFilePath = join(docDir, 'mission_control_sync.json');

interface SyncPayload {
    last_updated: number; // Unix timestamp (ms)
    source_device: string;
    snapshot: Snapshot;
}

/**
 * Ensures the Documents directory exists.
 */
function ensureDocDir() {
    if (!existsSync(docDir)) {
        mkdirSync(docDir, { recursive: true });
    }
}

/**
 * Reads the sync JSON file if it exists.
 */
function readSyncFile(): SyncPayload | null {
    if (!existsSync(syncFilePath)) return null;
    try {
        const fileContent = readFileSync(syncFilePath, 'utf-8');
        return JSON.parse(fileContent) as SyncPayload;
    } catch (err) {
        console.error('[SyncManager] Failed to read sync file:', err);
        return null;
    }
}

/**
 * Writes the sync JSON file.
 */
function writeSyncFile(payload: SyncPayload) {
    ensureDocDir();
    try {
        writeFileSync(syncFilePath, JSON.stringify(payload, null, 2), 'utf-8');
        console.log(`[SyncManager] Successfully exported sync snapshot to ${syncFilePath}`);
    } catch (err) {
        console.error('[SyncManager] Failed to write sync file:', err);
    }
}

/**
 * Internal state tracking to avoid circular/redundant syncs.
 */
let lastKnownSyncTime = 0;
const deviceName = os.hostname();

export const SyncManager = {
    /**
     * Checks if a sync is needed and performs it.
     */
    async evaluateSync() {
        try {
            console.log('[SyncManager] Evaluating sync state...');

            const localSnapshot = await db.getFullSnapshot();
            const localTotalItems = localSnapshot.panels.length + localSnapshot.categories.length + localSnapshot.links.length;

            const remotePayload = readSyncFile();

            // Scenario 1: No remote file exists yet. We should create one.
            if (!remotePayload) {
                console.log('[SyncManager] No remote sync file found. Creating one from local state.');
                const newPayload: SyncPayload = {
                    last_updated: Date.now(),
                    source_device: deviceName,
                    snapshot: localSnapshot
                };
                writeSyncFile(newPayload);
                lastKnownSyncTime = newPayload.last_updated;
                return;
            }

            // Scenario 2: Remote file exists. Let's compare state.
            const remoteTotalItems = remotePayload.snapshot.panels.length + remotePayload.snapshot.categories.length + remotePayload.snapshot.links.length;

            // CRITICAL EDGE CASE: Local is empty, Remote has data.
            // This happens on a fresh install on a new machine.
            if (localTotalItems === 0 && remoteTotalItems > 0) {
                console.log('[SyncManager] Local DB is empty, but remote sync file has data. Forcing import.');
                await db.restoreBackup(remotePayload.snapshot);
                lastKnownSyncTime = remotePayload.last_updated;
                globalThis.process.env.LAST_SYNC_TIMESTAMP = remotePayload.last_updated.toString();
                return;
            }

            // Scenario 3: Normal operation - check timestamps
            if (remotePayload.last_updated > lastKnownSyncTime && remotePayload.source_device !== deviceName) {
                console.log(`[SyncManager] Found newer sync file from ${remotePayload.source_device}. Importing...`);
                // Wait briefly to ensure file isn't mid-write from iCloud
                await new Promise(r => setTimeout(r, 1000));
                await db.restoreBackup(remotePayload.snapshot);
                lastKnownSyncTime = remotePayload.last_updated;
                globalThis.process.env.LAST_SYNC_TIMESTAMP = remotePayload.last_updated.toString();
                return;
            }

            // Scenario 4: Local is newer or we just made changes locally.
            // We'll write to the file if we haven't written this state yet.
            // In a real app we'd track "last DB modification time". For simplicity, 
            // if we are the ones who made the change (or if we just need to ensure the remote is up to date),
            // and the local items > remote items (or there's a modification trigger), we write.
            // But since SQLite doesn't easily give a global "last modified timestamp", 
            // we will just write the snapshot if we determine it's significantly different 
            // and we didn't JUST import it.

            // To prevent constant overwriting, we'll serialize and hash/compare.
            const localString = JSON.stringify(localSnapshot);
            const remoteString = JSON.stringify(remotePayload.snapshot);

            if (localString !== remoteString && remotePayload.source_device === deviceName) {
                // We made a change locally that isn't in the remote file yet
                console.log('[SyncManager] Local database has changes. Exporting to sync file.');
                const newPayload: SyncPayload = {
                    last_updated: Date.now(),
                    source_device: deviceName,
                    snapshot: localSnapshot
                };
                writeSyncFile(newPayload);
                lastKnownSyncTime = newPayload.last_updated;
            } else if (localString !== remoteString && remotePayload.source_device !== deviceName && remotePayload.last_updated <= lastKnownSyncTime) {
                // We made a change, but the file was last written by someone else longer ago
                // This means WE are the latest
                console.log('[SyncManager] Local database has latest changes. Exporting to sync file.');
                const newPayload: SyncPayload = {
                    last_updated: Date.now(),
                    source_device: deviceName,
                    snapshot: localSnapshot
                };
                writeSyncFile(newPayload);
                lastKnownSyncTime = newPayload.last_updated;
            } else {
                // They match, or nothing to do
                // Keep internal time updated to prevent accidental re-imports
                lastKnownSyncTime = Math.max(lastKnownSyncTime, remotePayload.last_updated);
            }

        } catch (err) {
            console.error('[SyncManager] Error during sync evaluation:', err);
        }
    }
};
