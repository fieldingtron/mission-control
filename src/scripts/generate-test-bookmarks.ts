import fs from 'node:fs';

const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks Menu</H1>

<DL><p>
    <DT><H3>Programming</H3>
    <DL><p>
        <DT><A HREF="https://github.com">GitHub</A>
        <DT><A HREF="https://stackoverflow.com">Stack Overflow</A>
        
        <DT><H3>Frontend</H3>
        <DL><p>
            <DT><A HREF="https://react.dev">React</A>
            <DT><A HREF="https://astro.build">Astro</A>
        </DL><p>
    </DL><p>

    <DT><H3>News</H3>
    <DL><p>
        <DT><A HREF="https://news.ycombinator.com">Hacker News</A>
    </DL><p>
    
    <DT><A HREF="https://example.com">Root Example</A>
</DL><p>
`;

fs.writeFileSync('/tmp/test-bookmarks.html', html);
console.log('Test file created at /tmp/test-bookmarks.html');
