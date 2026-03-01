import type { APIRoute } from 'astro';
import * as cheerio from 'cheerio';

export const POST: APIRoute = async ({ request }) => {
    const formData = await request.formData();
    const rawUrl = formData.get('url')?.toString()?.trim();

    // We look for existing form data to persist so we don't wipe out user inputs
    let name = formData.get('name')?.toString() || '';
    let description = formData.get('description')?.toString() || '';

    if (rawUrl) {
        let targetUrl: URL;
        try {
            // Robust URL parsing: prepend https:// if no protocol is present
            const normalizedUrl = rawUrl.match(/^[a-zA-Z]+:\/\//) ? rawUrl : `https://${rawUrl}`;
            targetUrl = new URL(normalizedUrl);

            console.log(`[Metadata Fetch] Attempting to fetch: ${targetUrl.toString()}`);

            // Fetch HTML with a mobile browser User-Agent to bypass aggressive anti-bot (like WSJ's DataDome)
            const response = await fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Referer': 'https://www.google.com/',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'cross-site'
                },
                signal: AbortSignal.timeout(8000) // Even more generous timeout (8s)
            });

            if (response.ok) {
                const html = await response.text();
                const $ = cheerio.load(html);

                // Extract title if name is empty
                if (!name) {
                    name = $('title').text() || $('meta[property="og:title"]').attr('content') || '';
                }

                // Extract description if desc is empty
                if (!description) {
                    description = $('meta[property="og:description"]').attr('content') ||
                        $('meta[name="description"]').attr('content') || '';
                }

                console.log(`[Metadata Fetch] SUCCESS: "${name.substring(0, 30)}..."`);
            } else {
                console.warn(`[Metadata Fetch] FAILED: HTTP ${response.status} from ${targetUrl.toString()}`);
            }
        } catch (err) {
            console.error(`[Metadata Fetch] ERROR for "${rawUrl}":`, err instanceof Error ? err.message : err);
        }
    }

    // Return the updated fields as a fragment to be swapped in
    return new Response(`
    <label for="f-name" class="block text-[13px] font-semibold text-[var(--muted)] mb-1.5">Name</label>
    <input
      id="f-name"
      type="text"
      name="name"
      value="${escapeHtml(name.trim())}"
      placeholder="e.g. GitHub"
      required
      class="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm outline-none transition-colors duration-200 focus:border-[var(--accent)]"
    />

    <input type="hidden" id="metadata-desc-value" value="${escapeHtml(description.trim())}" />
    <!-- Trigger a small script to update the description field without destroying cursor focus -->
    <script>
      (function() {
        const descInput = document.getElementById('f-description');
        const hiddenDesc = document.getElementById('metadata-desc-value');
        if (descInput && hiddenDesc && !descInput.value && hiddenDesc.value) {
          descInput.value = hiddenDesc.value;
        }
      })();
    </script>
  `, {
        headers: { 'Content-Type': 'text/html' }
    });
};

function escapeHtml(unsafe: string) {
    return (unsafe || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
