import type { APIRoute } from 'astro';
import * as cheerio from 'cheerio';
import db from '../../../lib/db';

export const POST: APIRoute = async ({ request }) => {
    console.log('[Import Endpoint] Hit');
    try {
        const formData = await request.formData();
        console.log('[Import Endpoint] Parsed formData');
        const file = formData.get('bookmarks') as File | null;
        const urlsRaw = formData.get('urls')?.toString() || '';

        // First panel to safely attach all imported categories
        const panels = await db.getPanels();
        console.log(`[Import Endpoint] Fetched ${panels.length} panels`);
        if (panels.length === 0) {
            return new Response('No panels exist to import into.', { status: 400 });
        }
        const targetPanelId = panels[0].id;

        let importedLinksCount = 0;
        let importedCategoriesCount = 0;

        // 1. Parse File (Netscape HTML)
        if (file && file.size > 0 && file.name.endsWith('.html')) {
            console.log(`[Import Endpoint] Reading file of size ${file.size}`);
            const html = await file.text();
            console.log(`[Import Endpoint] Read text, passing to cheerio`);
            const $ = cheerio.load(html);
            console.log(`[Import Endpoint] Cheerio loaded`);

            // In Netscape format, folders are represented by <DT><H3>FolderName</H3>
            // Followed by a <DL><p> containing the links <DT><A>Link</A>
            // To flatten this, we iterate through all <H3> tags, treat them as categories,
            // and grab all immediate <A> tags within their following <DL>.

            const folders = $('h3');

            // Keep track of categories we've created to avoid duplicates
            // if multiple folders have the same name at different depths
            const createdCategories = new Map<string, number>();

            for (const folder of folders) {
                let folderName = $(folder).text().trim() || 'Imported Category';

                // Find the <DL> that immediately follows this <H3>
                // In Netscape format, the <DL> contains the contents of the folder.
                let dl = $(folder).parent().next('dl');
                if (dl.length === 0) {
                    dl = $(folder).next('dl');
                }

                // We only want the *immediate* links in this folder, not links inside sub-folders.
                // Sub-folders have their own <H3> which our outer loop will hit.
                // Immediate links are within `<DT><A>` directly under our `<DL>`.
                const links = dl.children('dt').children('a');

                if (links.length > 0) {
                    let categoryId = createdCategories.get(folderName);

                    if (!categoryId) {
                        const catPos = (await db.getCategories(targetPanelId.toString())).length + 1;
                        console.log(`[Import Endpoint] Creating category: ${folderName}`);
                        const newCat = await db.addCategory(folderName, targetPanelId);
                        categoryId = Number(newCat.lastInsertRowid);
                        createdCategories.set(folderName, categoryId);
                        importedCategoriesCount++;
                    }

                    for (const link of links) {
                        const url = $(link).attr('href');
                        const name = $(link).text().trim() || 'Imported Link';

                        if (url && url.startsWith('http')) {
                            const linkPos = await db.getMaxLinkPosition() + 1;
                            console.log(`[Import Endpoint] Adding link: ${name}`);
                            await db.addLink(categoryId, name, url, linkPos, null);
                            importedLinksCount++;
                        }
                    }
                }
            }

            // Add a catch-all for links that aren't in ANY folder (root level)
            // These are <A> tags that don't have an <H3> preceding their parent <DL>
            const rootLinks = $('dl').first().children('dt').children('a');
            if (rootLinks.length > 0) {
                const catPos = (await db.getCategories(targetPanelId.toString())).length + 1;
                const rootCat = await db.addCategory('Imported Bookmarks', targetPanelId);
                importedCategoriesCount++;

                for (const link of rootLinks) {
                    const url = $(link).attr('href');
                    const name = $(link).text().trim() || 'Imported Link';
                    if (url && url.startsWith('http')) {
                        const linkPos = await db.getMaxLinkPosition() + 1;
                        await db.addLink(Number(rootCat.lastInsertRowid), name, url, linkPos, null);
                        importedLinksCount++;
                    }
                }
            }
        }

        // 2. Parse Raw URLs (Textarea)
        const rawLines = urlsRaw.split('\n').map(l => l.trim()).filter(l => l && l.startsWith('http'));
        if (rawLines.length > 0) {
            const catPos = (await db.getCategories(targetPanelId.toString())).length + 1;
            const genericCat = await db.addCategory('Imported Links', targetPanelId);
            importedCategoriesCount++;

            for (const url of rawLines) {
                const linkPos = await db.getMaxLinkPosition() + 1;
                // Try to construct a decent name from hostname
                let name = url;
                try { name = new URL(url).hostname; } catch (e) { }
                await db.addLink(Number(genericCat.lastInsertRowid), name, url, linkPos, null);
                importedLinksCount++;
            }
        }

        // Refresh UI
        return new Response(null, {
            status: 200,
            headers: {
                'HX-Trigger': 'refresh, refreshSidebar',
                'HX-Location': '/' // Force full redirect to reflect new data cleanly
            }
        });

    } catch (error) {
        console.error('Import Error:', error);
        return new Response('Failed to process import', { status: 500 });
    }
};
