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

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure Environment:  
   Create a `.env` file in the root directory and add your Supabase connection strings:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=ey...
   ADMIN_PASSWORD=your-secure-master-password
   ```
3. Provision Database:  
   Copy the contents of `supabase-schema.sql` and run it in the Supabase SQL Editor to create the required tables.
4. Start the development server:
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

---

*Built with precision for a zero-lag experience.*
