# Link Dashboard

A premium, high-performance link and bookmark dashboard built with the **AHAStack** (Astro, HTMX, Alpine.js).

## Features

- 🚀 **AHAStack**: Lightning-fast server-side rendering with reactive partial updates.
- ☁️ **Local SQLite Database**: Fast, lightweight, local database using libSQL.
- 🧩 **Masonry Layout**: Categories automatically pack together tightly into columns for a beautiful Pinterest-style aesthetic.
- 📂 **Netscape Bookmark Imports**: Easily import your existing nested browser bookmarks, automatically parsed and flattened into categories.
- ↔️ **Drag & Drop**: Reorder your panels, categories, and links with ease (powered by Sortable.js).
- 🔊 **Micro-Interactions**: Features a custom UI soundboard for satisfying interaction feedback.

## Getting Started

### Prerequisites

- **Node.js 18+**

### Setup

**Clone the repository** (if you haven't already):
   ```bash
   git clone <repository-url>
   cd mission-control
   ```

### Running the Application

Mission Control now features a universal setup script that automatically configures local HTTPS (via Caddy) at `https://dashboard.localhost`.

#### Option A: macOS Background Service (Recommended)
This installs all dependencies, builds the production app, and registers it as an autostarting macOS Launch Agent.

```bash
chmod +x install-macos-service.sh
./install-macos-service.sh
```

Once complete, the service will run silently in the background on your Mac. You can access it anytime at [https://dashboard.localhost](https://dashboard.localhost). 
Logs can be monitored at `/tmp/com.fieldingtron.mission-control.log`.

#### Option B: Universal / Development Mode
This will install dependencies (including configuring Caddy via the `postinstall` script) and run the live development server.

```bash
npm install
npm run dev
```

Open [https://dashboard.localhost](https://dashboard.localhost) in your browser.

## Tech Stack

- **Astro 5**: Modern web framework with SSR support.
- **HTMX**: High-power tools for HTML (AJAX, CSS Transitions).
- **Alpine.js**: Lightweight JavaScript framework for client-side interactivity.
- **Vanilla CSS**: Clean, performant styling without the overhead of a CSS-in-JS or Tailwind.
- **SQLite**: Local relational database using `libsql` for high performance.

## Project Structure

- `src/pages/`: Main application routes (Dashboard).
- `src/pages/api/`: HTMX backend action routes and Astro middleware.
- `src/lib/`: Database Adapters and utility functions.

## System Architecture

Below is a high-level text flowchart detailing the technology stack architecture.

```text
+---------------------------------------------------------------------------------+
|                                     Browser                                     |
|                                                                                 |
|  +---------------------------------------------------------------------------+  |
|  |                               index.astro                                 |  |
|  |                                                                           |  |
|  |  +-------------------+  +-------------------+  +-----------------------+  |  |
|  |  |    Alpine.js      |  |      HTMX         |  |     SortableJS        |  |  |
|  |  |  - Modals         |  |  - Form POST      |  |  - Drag & drop        |  |  |
|  |  |  - Theme          |  |  - hx-boost       |  |  - Reordering         |  |  |
|  |  +-------------------+  +-------------------+  +-----------------------+  |  |
|  +---------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
|                               Astro Server (SSR)                                |
|                                                                                 |
|  +---------------------------------------------------------------------------+  |
|  |                              API Routes                                   |  |
|  |  /api/panels.ts      - CRUD for panels                                    |  |
|  |  /api/categories.ts  - CRUD for categories                                |  |
|  |  /api/links.ts       - CRUD for links                                     |  |
|  +---------------------------------------------------------------------------+  |
|                                        |                                        |
|                                        v                                        |
|  +---------------------------------------------------------------------------+  |
|  |                            src/lib/db.ts                                  |  |
|  |  - DatabaseAdapter interface definition                                   |  |
|  |  - Export initialized adapter instance                                    |  |
|  +---------------------------------------------------------------------------+  |
|                                        |                                        |
|                                        v                                        |
|  +---------------------------------------------------------------------------+  |
|  |                    src/lib/drizzle-adapter.ts                             |  |
|  |  - Drizzle ORM queries & transactions                                     |  |
|  +---------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
|                            SQLite Database (libSQL)                             |
|                                                                                 |
|  +---------------+    +-------------------+    +-------------------+            |
|  |    panels     |--->|    categories     |--->|      links        |            |
|  |  - id         |    |  - id             |    |  - id             |            |
|  |  - name       |    |  - name           |    |  - name           |            |
|  |  - position   |    |  - panel_id (FK)  |    |  - url            |            |
|  +---------------+    |  - position       |    |  - category_id(FK)|            |
|                       +-------------------+    |  - description    |            |
|                                                |  - position       |            |
|                                                +-------------------+            |
+---------------------------------------------------------------------------------+
```


