# SQL Workbench Embedded

A lightweight JavaScript library that transforms static SQL code blocks into interactive, browser-based SQL execution environments using DuckDB WASM.

**Repository**: [https://github.com/tobilg/sql-workbench-embedded](https://github.com/tobilg/sql-workbench-embedded)

## Features

- **Zero Backend Required**: All SQL execution happens in the browser
- **Lightweight**: 9.49 kB gzipped bundle (29.67 kB minified)
- **Easy Integration**: Just add a CSS class to your code blocks
- **Interactive Editing**: Edit SQL queries with real-time syntax highlighting
- **Framework Agnostic**: Works with vanilla JS, React, Vue, and more
- **Privacy-Focused**: No data transmission to external servers
- **Lazy Loading**: DuckDB WASM loads only when needed
- **Init Queries**: Execute initialization queries once for extension management
- **Path Resolution**: Automatic resolution of relative file paths in SQL queries
- **Theme Support**: Light, dark, auto themes with full customization
- **Typography Customization**: Customize fonts and sizes per theme

## Quick Start

### Via CDN

#### unpkg

```html
<!DOCTYPE html>
<html>
<head>
  <title>SQL Workbench Example</title>
</head>
<body>
  <pre class="sql-workbench-embedded">
    <code>SELECT 'Hello, World!' AS greeting;</code>
  </pre>

  <!-- Latest version -->
  <script src="https://unpkg.com/sql-workbench-embedded@latest"></script>

  <!-- Specific version (recommended for production) -->
  <script src="https://unpkg.com/sql-workbench-embedded@0.1.1"></script>
</body>
</html>
```

#### jsDelivr

```html
<!DOCTYPE html>
<html>
<head>
  <title>SQL Workbench Example</title>
</head>
<body>
  <pre class="sql-workbench-embedded">
    <code>SELECT 'Hello, World!' AS greeting;</code>
  </pre>

  <!-- Latest version -->
  <script src="https://cdn.jsdelivr.net/npm/sql-workbench-embedded@latest"></script>

  <!-- Specific version (recommended for production) -->
  <script src="https://cdn.jsdelivr.net/npm/sql-workbench-embedded@0.1.1"></script>
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
- **Init Queries Example**: [examples/init-queries.html](examples/init-queries.html) - DuckDB extension management with initQueries
- **unpkg CDN (UMD)**: [examples/unpkg.html](examples/unpkg.html) - Loading from unpkg as UMD module
- **unpkg CDN (ESM)**: [examples/unpkg-esm.html](examples/unpkg-esm.html) - Loading from unpkg as ES module
- **Typography Example**: [examples/typography.html](examples/typography.html) - Font customization examples
- **React Example**: [examples/react.html](examples/react.html) - React component integration
- **Vue Example**: [examples/vue.html](examples/vue.html) - Vue 3 component integration

## Usage

### Automatic Initialization

By default, the library automatically scans for elements with the class `sql-workbench-embedded` and transforms them:

```html
<pre class="sql-workbench-embedded">
  <code>
    SELECT * FROM generate_series(1, 10);
  </code>
</pre>

<!-- You can also set the theme directly on the element -->
<pre class="sql-workbench-embedded" data-theme="dark">
  <code>
    SELECT * FROM users WHERE active = true;
  </code>
</pre>
```

### Manual Initialization

```javascript
import { SQLWorkbench } from 'sql-workbench-embedded';

// Configure globally
SQLWorkbench.config({
  selector: '.my-sql-code',
  theme: 'dark',
  baseUrl: 'https://my-data-server.com',
});

// Initialize all embeds
SQLWorkbench.init();

// Or create a single embed programmatically
const embed = new SQLWorkbench.Embedded(element, {
  editable: true,
  theme: 'light',
});
```

### Browser Usage (UMD)

```html
<!-- Using unpkg -->
<script src="https://unpkg.com/sql-workbench-embedded@0.1.1"></script>

<!-- Or using jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/sql-workbench-embedded@0.1.1"></script>

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
  const embed = new SQLWorkbench.Embedded(element, {
    editable: true,
    theme: 'light',
  });
</script>
```

## Configuration Options

### Global Configuration

```javascript
SQLWorkbench.config({
  selector: 'pre.sql-workbench-embedded, .sql-workbench-embedded pre',  // CSS selector for auto-discovery
  baseUrl: 'https://data.sql-workbench.com',  // Base URL for file paths
  theme: 'auto',  // 'light', 'dark', or 'auto'
  autoInit: true,  // Auto-initialize on DOMContentLoaded
  duckdbVersion: '1.31.1-dev1.0',  // DuckDB version
  duckdbCDN: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm',
  editable: true,  // Allow code editing
  showOpenButton: true,  // Show "Open in SQL Workbench" button
  initQueries: [],  // Initialization queries to execute once before first user query
});
```

### Per-Instance Options

```javascript
const embed = new SQLWorkbench.Embedded(element, {
  initialCode: 'SELECT 1;',
  theme: 'dark',
  editable: false,
  showOpenButton: false,  // Hide "Open in SQL Workbench" button for this instance
});
```

## Initialization Queries

The `initQueries` configuration allows you to execute SQL queries once before any user query runs. This is perfect for installing and loading DuckDB extensions, setting configuration options, or creating user-defined functions.

### Key Features

- ✅ Executes only once across all embeds on the page
- ✅ Runs sequentially in array order
- ✅ Lazy execution - only when the first "Run" button is pressed
- ✅ All embeds share the same DuckDB instance and extensions

### Installing Extensions

```javascript
SQLWorkbench.config({
  initQueries: [
    "INSTALL spatial",
    "LOAD spatial",
    "INSTALL a5 FROM community",
    "LOAD a5"
  ]
});
```

Now all embeds can use spatial functions and community extensions:

```html
<pre class="sql-workbench-embedded">
  SELECT ST_Distance(
    ST_Point(-74.0060, 40.7128),
    ST_Point(-118.2437, 34.0522)
  ) / 1000 AS distance_km;
</pre>

<pre class="sql-workbench-embedded">
  -- Generate GeoJSON for A5 cell
  SELECT ST_AsGeoJSON(
    ST_MakePolygon(
      ST_MakeLine(
        list_transform(
          a5_cell_to_boundary(a5_lonlat_to_cell(-3.7037, 40.41677, 10)),
          x -> ST_Point(x[1], x[2])
        )
      )
    )
  ) as geojson;
</pre>
```

### Setting Configuration Options

```javascript
SQLWorkbench.config({
  initQueries: [
    "SET memory_limit='2GB'",
    "SET threads=4"
  ]
});
```

### Creating User-Defined Functions

```javascript
SQLWorkbench.config({
  initQueries: [
    "CREATE MACRO add_tax(price, rate) AS price * (1 + rate)",
    "CREATE MACRO full_name(first, last) AS first || ' ' || last"
  ]
});
```

### Error Handling

If an initialization query fails:
- The error is shown to the user
- The user query is not executed
- The init query state is reset, allowing retry on next run

### Example

See [examples/init-queries.html](examples/init-queries.html) for a complete working example with the spatial and a5 community extensions.

### Theme Priority

Themes are resolved in the following priority order (highest to lowest):

1. **Per-instance options** - `new Embedded(element, { theme: 'dark' })`
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
      config: {
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
      config: {
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
new SQLWorkbench.Embedded(element, {
  theme: 'ocean'  // or 'sunset'
});
```

### Available Theme Properties

When defining custom themes, you can override any of these properties:

**Color Properties:**

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

**Typography Properties (Optional):**

- `fontFamily` - Font family for container and UI elements
- `editorFontFamily` - Font family for the SQL editor
- `fontSize` - Base font size (e.g., '14px', '1rem')
- `editorFontSize` - Font size for the SQL editor
- `buttonFontSize` - Font size for buttons
- `metadataFontSize` - Font size for metadata text

### Typography Customization

You can customize font families and sizes in your themes:

```javascript
SQLWorkbench.config({
  customThemes: {
    // Large accessible theme for better readability
    'large-accessible': {
      extends: 'light',
      config: {
        fontSize: '18px',
        editorFontSize: '16px',
        buttonFontSize: '16px',
        metadataFontSize: '14px',
      }
    },
    // Custom editor font with ligatures
    'fira-code': {
      extends: 'dark',
      config: {
        editorFontFamily: '"Fira Code", "JetBrains Mono", monospace',
        editorFontSize: '15px',
      }
    },
    // Compact theme for dense displays
    'compact': {
      extends: 'dark',
      config: {
        fontSize: '12px',
        editorFontSize: '12px',
        buttonFontSize: '12px',
        metadataFontSize: '10px',
      }
    }
  }
});
```

See [examples/typography.html](examples/typography.html) for a complete demonstration of typography customization.

### Theme Inheritance

- **With `extends`**: Only define the properties you want to override. The base theme provides defaults for all others.
- **Without `extends`**: You must define all required color properties. The library will throw an error if any are missing.

## Using Pre-built Themes

The [sql-workbench-embedded-themes](https://github.com/tobilg/sql-workbench-embedded-themes) package provides 66 ready-to-use themes converted from popular CodeMirror 5 themes (50 dark + 16 light themes).

### Installation

```bash
npm install sql-workbench-embedded-themes
```

### Usage with Bundler (Tree-shakeable)

```javascript
import { SQLWorkbench } from 'sql-workbench-embedded';
import { dracula, monokai, elegant } from 'sql-workbench-embedded-themes';

// Configure with pre-built themes
SQLWorkbench.config({
  customThemes: {
    dracula: {
      config: dracula.config
    },
    monokai: {
      config: monokai.config
    }
  },
  theme: 'dracula'
});
```

### Usage with CDN (UMD)

For browser usage without a bundler, load individual theme bundles (~1.4KB each):

```html
<!DOCTYPE html>
<html>
<head>
  <title>SQL Workbench with Themes</title>
</head>
<body>
  <pre class="sql-workbench-embedded">
    <code>SELECT * FROM generate_series(1, 10);</code>
  </pre>

  <!-- Load SQL Workbench -->
  <script src="https://unpkg.com/sql-workbench-embedded@latest"></script>

  <!-- Load specific themes from CDN -->
  <script src="https://unpkg.com/sql-workbench-embedded-themes/dist/umd/themes/dracula.js"></script>
  <script src="https://unpkg.com/sql-workbench-embedded-themes/dist/umd/themes/monokai.js"></script>

  <script>
    // Themes are available on window.SQLWorkbenchThemes
    SQLWorkbench.config({
      customThemes: {
        dracula: {
          config: window.SQLWorkbenchThemes.dracula.config
        },
        monokai: {
          config: window.SQLWorkbenchThemes.monokai.config
        }
      },
      theme: 'dracula'
    });
  </script>
</body>
</html>
```

### Available Themes

The package includes 66 themes categorized as:

- **Dark themes (50)**: dracula, monokai, material, nord, oceanic-next, and many more
- **Light themes (16)**: elegant, idea, neat, paraiso-light, and more

For a complete list of available themes, visit the [sql-workbench-embedded-themes repository](https://github.com/tobilg/sql-workbench-embedded-themes).

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

## Open in SQL Workbench

Each embed includes an "Open in SQL Workbench" button (enabled by default) that opens the current query in the full [SQL Workbench](https://sql-workbench.com) web application. The query is encoded in the URL hash using URL-safe Base64 encoding for sharing and persistence.

To disable this button globally:

```javascript
SQLWorkbench.config({
  showOpenButton: false,
});
```

Or for a specific instance:

```javascript
const embed = new SQLWorkbench.Embedded(element, {
  showOpenButton: false,
});
```

## Keyboard Shortcuts

- **Ctrl+Enter** (Mac: **Cmd+Enter**): Execute query
- **Ctrl+Shift+Enter** (Mac: **Cmd+Shift+Enter**): Open in SQL Workbench
- **Ctrl+Backspace** (Mac: **Cmd+Backspace**): Reset to original code
- **Tab**: Navigate between buttons

## API Reference

### SQLWorkbench.init()

Initialize all embeds matching the configured selector.

### SQLWorkbench.destroy()

Destroy all embeds and cleanup resources.

### SQLWorkbench.config(options)

Set global configuration options.

### SQLWorkbench.Embedded

Class for creating individual embeds.

```javascript
const embed = new SQLWorkbench.Embedded(element, options);

// Methods
embed.run();  // Execute query
embed.destroy();  // Cleanup
embed.isDestroyed();  // Check if destroyed
embed.getContainer();  // Get container element
```

## Framework Integration

### React

#### Installation

**Option 1: CDN (Recommended for quick setup)**
```html
<!-- Add to your HTML head -->
<script type="module" src="https://unpkg.com/sql-workbench-embedded@0.1.1/dist/sql-workbench-embedded.esm.js"></script>
```

**Option 2: npm**
```bash
npm install sql-workbench-embedded
```

#### Usage

```jsx
import { useRef, useEffect } from 'react';

function SQLWorkbenchEmbedded({ code, options }) {
  const containerRef = useRef(null);
  const embedRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && window.SQLWorkbench) {
      // Create a pre element with the SQL code
      const preElement = document.createElement('pre');
      preElement.className = 'sql-workbench-embedded';
      preElement.innerHTML = `<code>${code}</code>`;
      containerRef.current.appendChild(preElement);

      // Initialize the embed
      embedRef.current = new window.SQLWorkbench.Embedded(preElement, options);
    }

    return () => {
      embedRef.current?.destroy();
    };
  }, [code, options]);

  return <div ref={containerRef} />;
}

// Usage in your app
function App() {
  return (
    <SQLWorkbenchEmbedded 
      code="SELECT 'Hello, World!' AS greeting;"
      options={{ editable: true, theme: 'light' }}
    />
  );
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
        preElement.className = 'sql-workbench-embedded';
        preElement.innerHTML = `<code>${props.code}</code>`;
        containerRef.value.appendChild(preElement);

        // Initialize the embed
        embedRef.value = new window.SQLWorkbench.Embedded(preElement, props.options);
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
      element.className = 'sql-workbench-embedded';
      element.innerHTML = `<code>${this.code}</code>`;
      this.$refs.container.appendChild(element);

      this.embed = new window.SQLWorkbench.Embedded(element, this.options);
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

- **UMD Bundle**: 29.67 kB minified, 9.49 kB gzipped
- **ES Module**: 30.38 kB minified, 9.54 kB gzipped
- **DuckDB WASM**: Loaded separately from CDN (~5MB on first use)

### Size Breakdown

- **SQL Workbench Embed**: ~20 kB (UI, syntax highlighting, path resolution, theming)
- **DuckDB Client Library**: ~6 kB (minimal DuckDB bindings)
- **Build Overhead**: ~3 kB (UMD wrapper, utilities)

### Performance Impact

- **Initial Load**: 9.49 kB gzipped (extremely lightweight)
- **First Query**: Additional ~5MB for DuckDB WASM binary (cached thereafter)
- **Subsequent Loads**: Only 9.49 kB (DuckDB cached)

The production build maintains a compact size while providing full functionality including typography customization.

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
├── embedded.ts           # Core Embedded class
├── types.ts              # TypeScript definitions
├── duckdb-manager.ts     # DuckDB connection management
├── path-resolver.ts      # File path resolution
├── syntax-highlight.ts   # SQL syntax highlighting
└── styles.ts             # CSS injection

examples/
├── index.html            # Basic vanilla JS example
├── init-queries.html     # Init queries / extension management example
├── unpkg.html            # unpkg CDN example (UMD)
├── unpkg-esm.html        # unpkg CDN example (ESM)
├── typography.html       # Typography customization examples
├── react.html            # React integration example
└── vue.html              # Vue 3 integration example
```

## License

MIT License - see [LICENSE](LICENSE) file for details.
