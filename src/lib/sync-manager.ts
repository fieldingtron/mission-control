import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
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
 * Utility to pause execution
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Reads the sync JSON file if it exists.
 */
async function readSyncFile(): Promise<SyncPayload | null> {
    if (!existsSync(syncFilePath)) return null;

    try {
        // Force macOS iCloud Drive to physically download the file if it's currently a cloud placeholder
        spawnSync('brctl', ['download', syncFilePath]);

        const fileContent = await readFile(syncFilePath, 'utf-8');
        return JSON.parse(fileContent) as SyncPayload;
    } catch (err: any) {
        // Handle normal missing files
        if (err.code === 'ENOENT') return null;

        // If iCloud is aggressively locking the file, just skip this sync cycle
        if (err.code === 'EAGAIN' || err.code === 'EWOULDBLOCK' || err.errno === -11) {
            console.warn(`[SyncManager] File temporarily locked by iCloud (read). Skipping this cycle.`);
            return null;
        }

        console.error('[SyncManager] Failed to read sync file:', err);
        return null; // Return null instead of throwing so we don't crash
    }
}

/**
 * Writes the sync JSON file.
 */
async function writeSyncFile(payload: SyncPayload): Promise<void> {
    ensureDocDir();

    try {
        await writeFile(syncFilePath, JSON.stringify(payload, null, 2), 'utf-8');
        console.log(`[SyncManager] Successfully exported sync snapshot to ${syncFilePath}`);
    } catch (err: any) {
        if (err.code === 'EAGAIN' || err.code === 'EWOULDBLOCK' || err.errno === -11) {
            console.warn(`[SyncManager] File temporarily locked by iCloud (write). Skipping export this cycle.`);
            return;
        }
        console.error('[SyncManager] Failed to write sync file:', err);
    }
}

/**
 * Merges two snapshots into one, prioritizing uniqueness of panels, categories, and links.
 */
function mergeSnapshots(local: Snapshot, remote: Snapshot): Snapshot {
    const panels: Panel[] = [];
    const categories: Category[] = [];
    const links: Link[] = [];

    // Maps to track existing names/URLs and their new IDs
    const panelNameToNewId = new Map<string, number>();
    const catFullNameToNewId = new Map<string, number>(); // Key: "panelName:catName"

    let nextPanelId = 1;
    let nextCatId = 1;
    let nextLinkId = 1;

    // Helper to process a snapshot
    const processSnapshot = (snap: Snapshot) => {
        const oldPanelIdToName = new Map<number, string>();
        const oldCatIdToFullName = new Map<number, string>();

        // 1. Panels
        for (const p of snap.panels) {
            oldPanelIdToName.set(p.id, p.name);
            if (!panelNameToNewId.has(p.name)) {
                const newId = nextPanelId++;
                panelNameToNewId.set(p.name, newId);
                panels.push({ ...p, id: newId, position: panels.length + 1 });
            }
        }

        // 2. Categories
        for (const c of snap.categories) {
            const panelName = oldPanelIdToName.get(c.panel_id) || "Unknown";
            const fullName = `${panelName}:${c.name}`;
            oldCatIdToFullName.set(c.id, fullName);

            if (!catFullNameToNewId.has(fullName)) {
                const newId = nextCatId++;
                catFullNameToNewId.set(fullName, newId);
                const newPanelId = panelNameToNewId.get(panelName) || 1;
                categories.push({ ...c, id: newId, panel_id: newPanelId, position: categories.length + 1 });
            }
        }

        // 3. Links
        for (const l of snap.links) {
            const catFullName = oldCatIdToFullName.get(l.category_id) || "Unknown:Unknown";
            const newCatId = catFullNameToNewId.get(catFullName) || 1;

            // Check if this URL already exists in this category
            const linkKey = `${newCatId}:${l.url}`;
            const exists = links.some(existing => `${existing.category_id}:${existing.url}` === linkKey);

            if (!exists) {
                links.push({ ...l, id: nextLinkId++, category_id: newCatId, position: links.length + 1 });
            }
        }
    };

    processSnapshot(local);
    processSnapshot(remote);

    return { panels, categories, links };
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

            const remotePayload = await readSyncFile();

            // Scenario 1: No remote file exists yet. We should create one.
            if (!remotePayload) {
                console.log('[SyncManager] No remote sync file found. Creating one from local state.');
                const newPayload: SyncPayload = {
                    last_updated: Date.now(),
                    source_device: deviceName,
                    snapshot: localSnapshot
                };
                await writeSyncFile(newPayload);
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

            // Scenario 3: Normal operation - merge states
            if (remotePayload.last_updated > lastKnownSyncTime && remotePayload.source_device !== deviceName) {
                console.log(`[SyncManager] Found newer sync file from ${remotePayload.source_device}. Merging...`);

                const mergedSnapshot = mergeSnapshots(localSnapshot, remotePayload.snapshot);

                await db.restoreBackup(mergedSnapshot);
                lastKnownSyncTime = remotePayload.last_updated;

                // After merging, we should immediately export the merged state back to iCloud 
                // so both devices are in sync with the combined data.
                const newPayload: SyncPayload = {
                    last_updated: Date.now(),
                    source_device: deviceName,
                    snapshot: mergedSnapshot
                };
                await writeSyncFile(newPayload);
                lastKnownSyncTime = newPayload.last_updated;

                globalThis.process.env.LAST_SYNC_TIMESTAMP = newPayload.last_updated.toString();
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
                await writeSyncFile(newPayload);
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
                await writeSyncFile(newPayload);
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
