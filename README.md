# SQL Workbench Embed

A lightweight JavaScript library that transforms static SQL code blocks into interactive, browser-based SQL execution environments using DuckDB WASM.

## Features

- **Zero Backend Required**: All SQL execution happens in the browser
- **Lightweight**: 7.2KB gzipped bundle (23KB minified)
- **Easy Integration**: Just add a CSS class to your code blocks
- **Interactive Editing**: Edit SQL queries with real-time syntax highlighting
- **Framework Agnostic**: Works with vanilla JS, React, Vue, and more
- **Privacy-Focused**: No data transmission to external servers
- **Lazy Loading**: DuckDB WASM loads only when needed
- **Path Resolution**: Automatic resolution of relative file paths in SQL queries
- **Theme Support**: Light, dark, and auto themes

## Quick Start

### Via CDN (Coming Soon)

```html
<!DOCTYPE html>
<html>
<head>
  <title>SQL Workbench Example</title>
</head>
<body>
  <pre class="sql-workbench-embed">
    <code>SELECT 'Hello, World!' AS greeting;</code>
  </pre>

  <script src="https://unpkg.com/sql-workbench-embed@latest"></script>
</body>
</html>
```

### Development Setup

```bash
# Install dependencies
npm install

# Start development server (http://localhost:5173/examples/index.html)
npm run dev

# Build for production
npm run build

# Preview production build (http://localhost:4173/examples/index.html)
npm run preview:prod
```

### Examples

- **Basic Example**: [examples/index.html](examples/index.html) - Vanilla JavaScript integration
- **React Example**: [examples/react.html](examples/react.html) - React component integration
- **Vue Example**: [examples/vue.html](examples/vue.html) - Vue 3 component integration

## Usage

### Automatic Initialization

By default, the library automatically scans for elements with the class `sql-workbench-embed` and transforms them:

```html
<pre class="sql-workbench-embed">
  <code>
    SELECT * FROM generate_series(1, 10);
  </code>
</pre>

<!-- You can also set the theme directly on the element -->
<pre class="sql-workbench-embed" data-theme="dark">
  <code>
    SELECT * FROM users WHERE active = true;
  </code>
</pre>
```

### Manual Initialization

```javascript
import { SQLWorkbench } from 'sql-workbench-embed';

// Configure globally
SQLWorkbench.config({
  selector: '.my-sql-code',
  theme: 'dark',
  baseUrl: 'https://my-data-server.com',
});

// Initialize all embeds
SQLWorkbench.init();

// Or create a single embed programmatically
const embed = new SQLWorkbench.Embed(element, {
  editable: true,
  theme: 'light',
});
```

### Browser Usage (UMD)

```html
<script src="https://unpkg.com/sql-workbench-embed@latest"></script>
<script>
  // Configure globally
  SQLWorkbench.config({
    selector: '.my-sql-code',
    theme: 'dark',
    baseUrl: 'https://my-data-server.com',
  });

  // Initialize all embeds
  SQLWorkbench.init();

  // Or create a single embed programmatically
  const embed = new SQLWorkbench.Embed(element, {
    editable: true,
    theme: 'light',
  });
</script>
```

## Configuration Options

### Global Configuration

```javascript
SQLWorkbench.config({
  selector: 'pre.sql-workbench-embed, .sql-workbench-embed pre',  // CSS selector for auto-discovery
  baseUrl: 'https://data.sql-workbench.com',  // Base URL for file paths
  theme: 'auto',  // 'light', 'dark', or 'auto'
  autoInit: true,  // Auto-initialize on DOMContentLoaded
  duckdbVersion: '1.31.1-dev1.0',  // DuckDB version
  duckdbCDN: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm',
  editable: true,  // Allow code editing
});
```

### Per-Instance Options

```javascript
const embed = new SQLWorkbench.Embed(element, {
  initialCode: 'SELECT 1;',
  theme: 'dark',
  editable: false,
});
```

### Theme Priority

Themes are resolved in the following priority order (highest to lowest):

1. **Per-instance options** - `new Embed(element, { theme: 'dark' })`
2. **HTML `data-theme` attribute** - `<pre data-theme="ocean">`
3. **Global configuration** - `SQLWorkbench.config({ theme: 'auto' })`

## Custom Themes

You can define custom themes that either extend existing light/dark themes or define completely new color schemes.

### Defining Custom Themes

```javascript
SQLWorkbench.config({
  customThemes: {
    // Extend existing theme with custom colors
    ocean: {
      extends: 'dark',
      colors: {
        primaryBg: '#0ea5e9',
        primaryHover: '#0284c7',
        editorBg: '#1e3a5f',
        // Optionally customize syntax highlighting
        syntaxKeyword: '#4fc3f7',
        syntaxString: '#80cbc4'
      }
    },
    // Standalone theme with all colors defined
    sunset: {
      colors: {
        bgColor: '#fef3c7',
        textColor: '#92400e',
        borderColor: '#f59e0b',
        editorBg: '#fef7cd',
        editorText: '#92400e',
        editorFocusBg: '#fef3c7',
        controlsBg: '#fef7cd',
        primaryBg: '#f97316',
        primaryText: '#ffffff',
        primaryHover: '#ea580c',
        secondaryBg: '#f59e0b',
        secondaryText: '#92400e',
        secondaryHover: '#d97706',
        mutedText: '#a16207',
        errorText: '#dc2626',
        errorBg: '#fef2f2',
        errorBorder: '#f87171',
        tableHeaderBg: '#fef3c7',
        tableHeaderText: '#92400e',
        tableHover: '#fef7cd'
      }
    }
  }
});

// Use custom themes
new SQLWorkbench.Embed(element, {
  theme: 'ocean'  // or 'sunset'
});
```

### Available Theme Colors

When defining custom themes, you can override any of these CSS colors:

- `bgColor` - Main background color
- `textColor` - Primary text color
- `borderColor` - Border color
- `editorBg` - Editor background
- `editorText` - Editor text color
- `editorFocusBg` - Editor focus background
- `controlsBg` - Controls background
- `primaryBg` - Primary button background
- `primaryText` - Primary button text
- `primaryHover` - Primary button hover
- `secondaryBg` - Secondary button background
- `secondaryText` - Secondary button text
- `secondaryHover` - Secondary button hover
- `mutedText` - Muted text color
- `errorText` - Error text color
- `errorBg` - Error background
- `errorBorder` - Error border color
- `tableHeaderBg` - Table header background
- `tableHeaderText` - Table header text
- `tableHover` - Table row hover background

**Syntax Highlighting Colors (Optional):**

- `syntaxKeyword` - SQL keywords (SELECT, FROM, WHERE, etc.)
- `syntaxString` - String literals
- `syntaxNumber` - Numeric values
- `syntaxComment` - SQL comments
- `syntaxFunction` - Function names
- `syntaxOperator` - Operators (+, -, =, etc.)

### Theme Inheritance

- **With `extends`**: Only define the colors you want to override. The base theme provides defaults for all others.
- **Without `extends`**: You must define all required colors. The library will throw an error if any are missing.

## Path Resolution

The library automatically resolves relative file paths in SQL queries:

```sql
-- Relative path
SELECT * FROM 'data.parquet';
-- Resolves to: https://data.sql-workbench.com/data.parquet

-- Dot-relative path
SELECT * FROM './path/to/data.parquet';
-- Resolves to: https://data.sql-workbench.com/path/to/data.parquet

-- Absolute path
SELECT * FROM '/data.parquet';
-- Resolves to: https://your-domain.com/data.parquet

-- Already absolute URL (unchanged)
SELECT * FROM 'https://example.com/data.parquet';
```

Configure the base URL:

```javascript
SQLWorkbench.config({
  baseUrl: 'https://my-data-cdn.com',
});
```

## Keyboard Shortcuts

- **Ctrl+Enter** (Mac: **Cmd+Enter**): Execute query
- **Tab**: Navigate between buttons

## API Reference

### SQLWorkbench.init()

Initialize all embeds matching the configured selector.

### SQLWorkbench.destroy()

Destroy all embeds and cleanup resources.

### SQLWorkbench.config(options)

Set global configuration options.

### SQLWorkbench.Embed

Class for creating individual embeds.

```javascript
const embed = new SQLWorkbench.Embed(element, options);

// Methods
embed.run();  // Execute query
embed.destroy();  // Cleanup
embed.isDestroyed();  // Check if destroyed
embed.getContainer();  // Get container element
```

## Framework Integration

### React

```jsx
import { useRef, useEffect } from 'react';
import { SQLWorkbench } from 'sql-workbench-embed';

function SQLEmbed({ code, options }) {
  const containerRef = useRef(null);
  const embedRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && window.SQLWorkbench) {
      // Create a pre element with the SQL code
      const preElement = document.createElement('pre');
      preElement.className = 'sql-workbench-embed';
      preElement.innerHTML = `<code>${code}</code>`;
      containerRef.current.appendChild(preElement);

      // Initialize the embed
      embedRef.current = new window.SQLWorkbench.Embed(preElement, options);
    }

    return () => {
      embedRef.current?.destroy();
    };
  }, [code, options]);

  return <div ref={containerRef} />;
}
```

### Vue 3 (Composition API)

```vue
<template>
  <div ref="container"></div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';

export default {
  props: {
    code: String,
    options: Object
  },
  setup(props) {
    const containerRef = ref(null);
    const embedRef = ref(null);

    onMounted(() => {
      if (containerRef.value && window.SQLWorkbench) {
        // Create a pre element with the SQL code
        const preElement = document.createElement('pre');
        preElement.className = 'sql-workbench-embed';
        preElement.innerHTML = `<code>${props.code}</code>`;
        containerRef.value.appendChild(preElement);

        // Initialize the embed
        embedRef.value = new window.SQLWorkbench.Embed(preElement, props.options);
      }
    });

    onUnmounted(() => {
      embedRef.value?.destroy();
    });

    return {
      containerRef
    };
  }
};
</script>
```

### Vue 2 (Options API)

```vue
<template>
  <div ref="container"></div>
</template>

<script>
export default {
  props: ['code', 'options'],
  mounted() {
    if (this.$refs.container && window.SQLWorkbench) {
      const element = document.createElement('pre');
      element.className = 'sql-workbench-embed';
      element.innerHTML = `<code>${this.code}</code>`;
      this.$refs.container.appendChild(element);

      this.embed = new window.SQLWorkbench.Embed(element, this.options);
    }
  },
  beforeUnmount() {
    this.embed?.destroy();
  },
};
</script>
```

## Bundle Size

The library is optimized for production with minimal bundle size:

- **UMD Bundle**: 23KB minified, 7.2KB gzipped
- **ES Module**: 36KB minified, 9.1KB gzipped
- **DuckDB WASM**: Loaded separately from CDN (~5MB on first use)

### Size Breakdown

- **SQL Workbench Embed**: ~15KB (UI, syntax highlighting, path resolution)
- **DuckDB Client Library**: ~5KB (minimal DuckDB bindings)
- **Build Overhead**: ~1KB (UMD wrapper, utilities)

### Performance Impact

- **Initial Load**: 7.2KB gzipped (extremely lightweight)
- **First Query**: Additional 5MB for DuckDB WASM binary (cached thereafter)
- **Subsequent Loads**: Only 7.2KB (DuckDB cached)

The production build achieves the original ~20KB target while maintaining full functionality.

## Browser Support

- Chrome/Edge 88+
- Firefox 89+
- Safari 15+

Requires: WebAssembly, Web Workers, ES2018+

## Development

### Project Structure

```
src/
├── index.ts              # Main entry point
├── embed.ts              # Core Embed class
├── types.ts              # TypeScript definitions
├── duckdb-manager.ts     # DuckDB connection management
├── path-resolver.ts      # File path resolution
├── syntax-highlight.ts   # SQL syntax highlighting
└── styles.ts             # CSS injection

examples/
├── index.html            # Basic vanilla JS example
├── react.html            # React integration example
└── vue.html              # Vue 3 integration example
```

## License

MIT License - see [LICENSE](LICENSE) file for details.
