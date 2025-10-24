# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SQL Workbench Embed is a lightweight JavaScript library that transforms static SQL code blocks into interactive, browser-based SQL execution environments using DuckDB WASM. The library enables documentation sites and tutorials to offer executable SQL examples without backend infrastructure.

**Key characteristics:**
- Single-file distribution (~20KB minified)
- Client-side execution only (privacy-focused)
- Zero configuration for basic use
- Lazy-loading DuckDB WASM
- Framework-agnostic with integration examples for React/Vue

## Development Setup

**Language:** TypeScript
**Build requirement:** Bundler for optimized single-file output
**License:** MIT

The project is in early stages. When setting up the development environment, you'll need to:
1. Configure TypeScript with ES2018+ target
2. Set up a bundler (Vite/Rollup/esbuild) for single-file output
3. Configure minification for production builds
4. Inline dependencies (except DuckDB WASM)

## Core Architecture

### Component Structure
```
SQLWorkbenchEmbed
├── SQL Editor (contenteditable)
│   ├── Syntax Highlighter (sql-highlight inlined)
│   └── Cursor Position Manager
├── Control Buttons
│   ├── Run Button (Ctrl/Cmd+Enter)
│   └── Reset Button
├── Output Area
│   ├── Table Renderer
│   ├── Error Display
│   └── Loading Indicator
└── DuckDB Manager
    ├── Lazy Initialization
    ├── Connection Pool (shared instance)
    ├── File Registration
    └── Query Executor
```

### Data Flow
1. **Initialization:** DOM scan → embed creation → event listeners → UI render
2. **Editing:** User input → debounced syntax highlighting (150ms) → cursor preservation
3. **Execution:** Validation → DuckDB init (if needed) → path resolution → file registration → execution → rendering
4. **Cleanup:** Connection close → event removal → DOM cleanup → memory release

## Key Implementation Requirements

### Distribution & Loading
- Single UMD module file (~20KB target)
- Inline all dependencies except DuckDB WASM
- DuckDB v1.31.1-dev1.0 loads lazily on first query execution
- Single shared DuckDB instance across all embeds on page
- Default CDN: jsdelivr (configurable)

### Path Resolution
Automatically convert relative paths to absolute URLs:
- `'data.parquet'` → `{baseUrl}/data.parquet`
- `'./data.parquet'` → `{baseUrl}/data.parquet`
- `'/data.parquet'` → `{origin}/data.parquet`
- Default baseUrl: "https://data.sql-workbench.com"

### Syntax Highlighting
- Inline sql-highlight library (v4.2.0)
- Debounced at 150ms for performance
- Support: keywords, string literals, comments, numbers, MySQL backticks

### UI States
- Loading: Minimum 200ms duration to prevent flickers
- Display execution time and row count
- User-friendly error messages with contextual suggestions

### Memory Management
- WeakMap for instance tracking
- MutationObserver for automatic cleanup when embeds removed from DOM
- Proper event listener and connection cleanup

### Browser Support
Minimum versions:
- Chrome/Edge 88+
- Firefox 89+
- Safari 15+

Required features: WebAssembly, Web Workers, ES2018+, contenteditable

## Public API

```javascript
// Global configuration
window.SQLWorkbench.config = {
  selector: "pre.sql-workbench-embed, .sql-workbench-embed pre",
  baseUrl: "https://data.sql-workbench.com",
  theme: "light" | "dark",
  autoInit: true,
  duckdbVersion: "1.31.1-dev1.0",
  duckdbCDN: "jsdelivr",
  editable: true
};

// Methods
window.SQLWorkbench.init();
window.SQLWorkbench.destroy();

// Per-instance
new window.SQLWorkbench.Embed(element, options);
embed.run();
embed.destroy();
```

## Framework Integration Patterns

**React:** useRef + useEffect hooks
**Vue:** mounted/beforeUnmount lifecycle
**Static sites:** Auto-initialization via DOMContentLoaded

## Performance Considerations

- Debounce syntax highlighting (150ms)
- Lazy load DuckDB WASM
- Share DuckDB instance across embeds
- Cache downloaded parquet files
- Minimum UX duration (200ms) for loading states

## Security

- All execution client-side (no data transmission)
- CSP compatible (allow script from CDN, WASM, Web Workers)
- Support Subresource Integrity (SRI)
- Inline dependencies to reduce supply chain risk

## Accessibility

- WCAG 2.1 AA compliance
- Keyboard shortcuts: Ctrl/Cmd+Enter to execute
- Tab navigation between buttons
- ARIA attributes for screen readers
- Theme support (auto-detect system preference)

## Key Differentiators from Reference Implementation

When implementing, consider these enhancement opportunities over basic SQLWorkbench:
1. Enhanced editor integration (Monaco/CodeMirror)
2. Query history tracking
3. Result visualization (charts/graphs)
4. Multi-table schema management
5. Export options (CSV, JSON, Parquet)
6. Snippet sharing capabilities
7. Advanced DuckDB features (extensions, custom functions)

## Requirements Reference

Full functional and non-functional requirements are documented in [requirements/sql-workbench-embed-requirements.md](requirements/sql-workbench-embed-requirements.md).
