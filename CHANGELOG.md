# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
