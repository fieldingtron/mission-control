# Link Dashboard

A premium, high-performance link and bookmark dashboard built with the **AHAStack** (Astro, HTMX, Alpine.js).

## Features

- 🚀 **AHAStack**: Lightning-fast server-side rendering with reactive partial updates.
- 📂 **Categorization**: Organize your links into customizable categories.
- ↔️ **Drag & Drop**: Reorder categories and links with ease (powered by Sortable.js).
- 🔐 **Premium Local Dev**: Automatic `https://dashboard.localhost` setup via Caddy and a custom `localhost-dev` utility.
- 💾 **SQLite Integration**: Uses Node.js experimental native SQLite support for zero-dependency persistence.

## Getting Started

### Prerequisites

- **Node.js 18+**
- **Caddy**: For the local development domain and SSL.
  ```bash
  brew install caddy
  brew services start caddy
  ```

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```
2. Trust the local Caddy CA (one-time setup for SSL):
   ```bash
   sudo caddy trust
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

Open [https://dashboard.localhost](https://dashboard.localhost) in your browser.

## Tech Stack

- **Astro 5**: Modern web framework with SSR support.
- **HTMX**: High-power tools for HTML (AJAX, CSS Transitions, WebSockets, Server Sent Events).
- **Alpine.js**: Lightweight JavaScript framework for client-side interactivity.
- **Vanilla CSS**: Clean, performant styling without the overhead of a CSS-in-JS or Tailwind.
- **Node.js SQLite**: Native database support for minimum friction.

## Project Structure

- `src/pages/`: Main application routes and API endpoints.
- `src/pages/api/fragments/`: Astro components that serve as partial HTML responses for HTMX.
- `localhost-dev/`: Custom utility for the premium local development experience.

---

*Built with precision for a zero-lag experience.*
