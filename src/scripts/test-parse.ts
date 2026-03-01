import fs from 'node:fs';
import * as cheerio from 'cheerio';

const html = fs.readFileSync('/tmp/test-bookmarks.html', 'utf8');
const $ = cheerio.load(html);

const folders = $('h3');
const createdCategories = new Map<string, number>();
let importedCategoriesCount = 0;
let importedLinksCount = 0;

console.log(`Found ${folders.length} folders.`);

for (const folder of folders) {
    let folderName = $(folder).text().trim() || 'Imported Category';
    console.log(`Processing folder: ${folderName}`);

    // Find the <DL> that immediately follows this <H3>
    let dl = $(folder).parent().next('dl');
    if (dl.length === 0) {
        dl = $(folder).next('dl');
    }

    if (dl.length > 0) {
        const links = dl.children('dt').children('a');
        console.log(`  Found ${links.length} links directly inside <dl>`);

        for (const link of links) {
            const url = $(link).attr('href');
            const name = $(link).text().trim() || 'Imported Link';
            console.log(`    Link: ${name} -> ${url}`);
        }
    } else {
        console.log('  No <dl> found.');
    }
}

const rootLinks = $('dl').first().children('dt').children('a');
console.log(`Root links: ${rootLinks.length}`);
for (const link of rootLinks) {
    const url = $(link).attr('href');
    const name = $(link).text().trim() || 'Imported Link';
    console.log(`    Link: ${name} -> ${url}`);
}
