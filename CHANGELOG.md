# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-02-28

### Added
- **Centralized Supabase Database**: Migrated the core persistence engine from local SQLite to a unified Supabase PostgreSQL cloud instance.
- **Single-User Session Authentication**: Added a Master Password `/login` page and a global Astro Middleware to lock down all routes and API endpoints via secure, HTTP-only session cookies.
- **Bookmark Importer**: Added a robust Netscape HTML parser (`cheerio`) to upload existing browser bookmarks and automatically flatten nested folders into top-level Categories.
- **Masonry Layout**: Replaced standard rigid CSS Grid alignment with a responsive Multi-Column CSS Layout, allowing Categories to stack vertically like Tetris blocks.
- **Sound Effects**: Added auditory feedback (`window.playMoveSound()`) triggered upon confirming the deletion of Panels, Categories, or Links.
- **`.env` Driven Configuration**: Replaced the physical `db-config.json` switching file with strict `import.meta.env` and `dotenv` loads to prevent exposing API keys.

### Removed
- Removed the dynamic Storage Provider UI from Settings. The dashboard is now strictly locked to Supabase.
- Removed local SQLite engine dependencies from the default application flow.

### Fixed
- Fixed Astro development server hang bug during large bookmark file uploads by refactoring Cheerio DOM manipulation routines.
- Fixed 500 Internal Server error on the Login page by replacing a broken layout import with a standalone standalone HTML scaffolding.

---
## [1.0.0] - 2026-02-27

### Added
- **`localhost-dev` Utility**: Automatically wraps dev commands to serve the app over a local `.localhost` domain using Caddy.
- **HTTPS/SSL Support**: Integrated Caddy internal TLS automation for local development.
- **`README.md`**: Comprehensive project documentation for humans.
- **`CHANGELOG.md`**: This file, to track project evolution.
- **System Theme Default**: Implemented automatic system-preference theme detection as the default state.
- **Settings Fragment**: Relocated theme toggles from the footer to a dedicated `settings.astro` fragment for a cleaner UI.

### Fixed
- **Caddy Redirect Error**: Fixed a critical bug in `localhost-dev` where an incorrect `protocol` matcher format caused Caddy to fail during setup.
- **Localhost Setup**: Resolved "Not Secure" browser warnings by providing structured instructions and verifying Caddy trust steps.
- **Theme Logic**: Refactored theme switching to use variables and removed forced attributes for "system" mode, letting CSS media queries handle it naturally.

### Changed
- **`AGENTS.md`**: Updated with current dev environment instructions and tool-agnostic context.
