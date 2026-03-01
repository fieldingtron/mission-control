# AGENTS.md

Use this file in this project as the primary source of coding instructions and project context across tools. Treat it as the shared agent handbook: follow its setup commands, architecture rules, code style, testing steps, and workflow conventions before making changes. When `AGENTS.md`, `GEMINI.md`, and `CLAUDE.md` all exist, use `AGENTS.md` as the cross-tool base, `GEMINI.md` only for Gemini-specific overrides, and `CLAUDE.md` only for Claude-specific overrides. When generating code, fixes, or refactors, prefer the project’s existing patterns and stay consistent with `AGENTS.md`. This fits the intended role of `AGENTS.md` as a predictable instruction file for coding agents, Gemini supports configurable context files such as `AGENTS.md`, and OpenAI Codex officially reads `AGENTS.md` files before starting work.

## Commands

```bash
npm run dev       # Start development server via localhost-dev (proxied through Caddy)
npm run dev:astro # Start Astro dev server directly
npm run setup     # Initial setup (requires sudo for caddy trust)
npm run build     # Production build → dist/
npm run preview   # Preview production build
```

The `npm run dev` command uses a custom `localhost-dev` utility that dynamically configures Caddy as a reverse proxy. This requires **Caddy** to be installed and running (`brew install caddy && brew services start caddy`).

All scripts prepend `NODE_OPTIONS=--experimental-sqlite` because the project uses Node's built-in SQLite API (not a third-party package).

## Development Environment

The project features a premium local development setup:
- **`localhost-dev`**: A custom Node.js utility located in `./localhost-dev`. It automatically picks a deterministic port for the project and configures Caddy routes.
- **Custom Domain**: The app is served at `dashboard.localhost` (or as configured in `package.json`).
- **SSL/TLS**: Local HTTPS is managed by Caddy. Run `sudo caddy trust` to avoid "Not Secure" warnings in the browser.

## Architecture

**Astro 5 in SSR mode** (`output: 'server'`, Node adapter standalone). The app is a link/bookmark dashboard where links are grouped by categories, which are in turn organized into panels.

### Data layer

`src/lib/db.ts` acts as a dynamic database adapter. By default, it initializes **Drizzle ORM** connecting to a PostgreSQL database (if `DATABASE_URL` is set in the environment). If no URL is provided, it falls back to a local SQLite database using Node's experimental `node:sqlite` module. The schema is defined in `src/lib/schema.ts` and includes four main tables: `panels`, `categories`, `links`, and `backups`. Relationships use `ON DELETE CASCADE` appropriately.

### API routes (`src/pages/api/`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/data` | All categories with nested links |
| POST | `/api/categories` | Create category |
| DELETE | `/api/categories/[id]` | Delete category + its links |
| POST | `/api/links` | Create link |
| PUT | `/api/links/[id]` | Update link |
| DELETE | `/api/links/[id]` | Delete link |

### Frontend

The project uses the **AHA! Stack** (Astro, HTMX, Alpine.js):
- **Astro**: Server-side rendering and component generation (`src/components/`, `src/pages/api/fragments/`).
- **HTMX**: Handles client-server interactions, fetching HTML fragments (`hx-get`, `hx-post`) instead of JSON.
- **Alpine.js**: Manages lightweight client-side state (modals, theme toggling) in `src/pages/index.astro`.
- **Sortable.js**: Provides drag-and-drop reordering functionality.

The UI features a **sidebar navigation** for panels and a **CSS multi-column masonry layout** for displaying category cards on the dashboard. No heavy client-side framework or virtual DOM is used. The server is the source of truth for rendering.
