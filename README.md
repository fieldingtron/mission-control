# Link Dashboard

A premium, high-performance link and bookmark dashboard built with the **AHAStack** (Astro, HTMX, Alpine.js).

## Features

- 🚀 **AHAStack**: Lightning-fast server-side rendering with reactive partial updates.
- ☁️ **Centralized Supabase Sync**: Your dashboard lives in the cloud via Supabase PostgreSQL, keeping your laptops and desktops perfectly synced.
- 🔐 **Zero-Config Master Password**: Simple, strict single-user session authentication keeps your private DB safe.
- 🧩 **Masonry Layout**: Categories automatically pack together tightly into columns for a beautiful Pinterest-style aesthetic.
- 📂 **Netscape Bookmark Imports**: Easily import your existing nested browser bookmarks, automatically parsed and flattened into categories.
- ↔️ **Drag & Drop**: Reorder your panels, categories, and links with ease (powered by Sortable.js).
- 🔊 **Micro-Interactions**: Features a custom UI soundboard for satisfying interaction feedback.

## Getting Started

### Prerequisites

- **Node.js 18+**
- **Supabase Account**: You must provision a free Supabase Postgres project to store the data.

### Installation

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone <repository-url>
   cd project1
   ```

2. **Install all Node dependencies**:
   This includes core packages like Astro, HTMX, and the newly added `dotenv` for environment variable management.
   ```bash
   npm install
   ```

3. **Create a Supabase Project**:
   - Go to [supabase.com](https://supabase.com) and create a free account.
   - Click **New Project** and choose a secure database password (save it!).
   - Once the database provisions (takes ~2 minutes), go to **Project Settings > API** to find your keys.

4. **Configure your Environment Variables**:  
   Create a new file named `.env` in the absolute root of the project directory and add your Supabase connection strings:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=ey...
   ADMIN_PASSWORD=your-secure-master-password
   ```

5. **Provision the Database Schema**:  
   - Open your Supabase dashboard and navigate to the **SQL Editor** tab.
   - Click **New Query**.
   - Copy the entire contents of the `supabase-schema.sql` file provided in this repository.
   - Paste it into the editor and click **Run**. This creates the `panels`, `categories`, `links`, and `backups` tables.

6. **Start the development server**:
   ```bash
   npm run dev
   ```

Open [http://localhost:4321](http://localhost:4321) in your browser. (Note: The `localhost-dev` auto-HTTPS proxy is available for advanced Caddy environments).

## Tech Stack

- **Astro 5**: Modern web framework with SSR support.
- **HTMX**: High-power tools for HTML (AJAX, CSS Transitions).
- **Alpine.js**: Lightweight JavaScript framework for client-side interactivity.
- **Vanilla CSS**: Clean, performant styling without the overhead of a CSS-in-JS or Tailwind.
- **Supabase**: Centralized PostgreSQL database via the `@supabase/supabase-js` Rest API.

## Project Structure

- `src/pages/`: Main application routes (Dashboard, Login).
- `src/pages/api/`: HTMX backend action routes and Astro middleware.
- `src/lib/`: Database Adapters and utility functions.
- `supabase-schema.sql`: The database schema definition.

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
|  |  - syncSequences via postgres.js wrapper                                  |  |
|  +---------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
|                         PostgreSQL Database (Supabase)                          |
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


