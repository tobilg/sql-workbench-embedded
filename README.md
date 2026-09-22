# SQL Workbench Embedded

A lightweight JavaScript library that transforms static SQL code blocks into interactive, browser-based SQL execution environments using DuckDB WASM.

**Repository**: [https://github.com/tobilg/sql-workbench-embedded](https://github.com/tobilg/sql-workbench-embedded)

## Features

- **Zero Backend Required**: All SQL execution happens in the browser
- **Lightweight**: 9.54 kB gzipped bundle (29.81 kB minified)
- **Easy Integration**: Just add a CSS class to your code blocks
- **Interactive Editing**: Edit SQL queries with real-time syntax highlighting
- **Framework Agnostic**: Works with vanilla JS, React, Vue, and more
- **Privacy-Focused**: No data transmission to external servers
- **Lazy Loading**: DuckDB WASM loads only when needed
- **Init Queries**: Execute initialization queries once for extension management
- **Path Resolution**: Automatic resolution of relative file paths in SQL queries
- **Flexible Theming**: Theme priority follows data-attribute > instance options > global config > default
- **Custom Themes**: Create themes that extend built-ins or define new color schemes
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
  <script src="https://unpkg.com/sql-workbench-embedded@0.1.4"></script>
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
  <script src="https://cdn.jsdelivr.net/npm/sql-workbench-embedded@0.1.4"></script>
</body>
</html>
```

### Development Setup

Vite bundles the JavaScript, and TypeScript 7 checks the source and generates declaration files with `npm run build:types`. The build generates declarations after Vite finishes, so Vite's output cleanup cannot remove them. The package includes all generated `dist/*.d.ts` files, with `dist/index.d.ts` as the public type entry point.

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

### Releasing to npm

[`.github/workflows/release.yml`](.github/workflows/release.yml) follows the [Valhalla release workflow](https://github.com/tobilg/valhalla-wasm/blob/main/.github/workflows/release.yml): pushing a stable `vMAJOR.MINOR.PATCH` tag validates the version, installs from the lockfile, runs type checking and unit tests, builds, and verifies a packed release. The publish job downloads that exact tarball and publishes it with npm trusted publishing and provenance. The tag, `package.json`, and `package-lock.json` must agree. Prerelease tags are rejected.

Manual runs through **Actions → Release npm package → Run workflow** perform the same verification and upload the `npm-release` artifact, but do not publish. The verification includes TypeScript consumers using both NodeNext and Bundler resolution without the optional DuckDB dependency installed.

Before the first automated publication, configure the `sql-workbench-embedded` package on npm under **Settings → Trusted publishing → GitHub Actions**:

| Setting | Value |
| --- | --- |
| Organization or user | `tobilg` |
| Repository | `sql-workbench-embedded` |
| Workflow filename | `release.yml` |
| Environment | Leave empty |
| Allowed actions | Enable direct `npm publish` |

The workflow uses Node from `.nvmrc` and npm 12.0.2 for publishing. Authentication uses GitHub's OIDC grant (`id-token: write` on the publish job); an `NPM_TOKEN` secret is not needed. See [npm's trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).

After committing your changes, create the next release with:

```bash
npm version patch  # Or minor/major; updates package files and creates a commit and tag
git push origin main
git push origin v0.2.1  # Use the exact tag printed by npm version
```

If the version is already set to the intended release (currently `0.2.0`), commit the changes and create its tag directly with `git tag -a v0.2.0 -m "Release 0.2.0"`, then push that tag. Push the workflow to `main` before using manual runs. A rerun skips publication only if npm already contains the same version with an identical tarball integrity hash; conflicting bytes or registry errors fail the job.

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
<script src="https://unpkg.com/sql-workbench-embedded@0.1.4"></script>

<!-- Or using jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/sql-workbench-embedded@0.1.4"></script>

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

Programmatic embeds inherit the global configuration set with `SQLWorkbench.config()` at creation time. Per-instance options override those settings; omitted settings use the global value or built-in default. Later global configuration changes do not update existing embeds.

Configuration is copied, including initialization query arrays and custom theme definitions. Mutating an options object or a value returned by `SQLWorkbench.getConfig()` does not change existing configuration or embeds.

`duckdbCDN` is the versionless DuckDB package root. The loader requests workers and WASM from `${duckdbCDN}@${duckdbVersion}/dist/` and, when needed, the JavaScript module from `${duckdbCDN}@${duckdbVersion}/+esm`. A matching-version `window.duckdb` module takes precedence, followed by a matching installed package; otherwise the configured module URL is used. A custom host must serve these paths, including a browser-compatible ESM module when no matching module is available locally.

All embeds share one database. The first embed to start a query selects its DuckDB settings and initialization queries for that database session. To change them, await `SQLWorkbench.destroy()` before configuring and creating new embeds.

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

1. **HTML `data-theme` attribute** - `<pre data-theme="ocean">` (highest)
2. **Per-instance options** - `new Embedded(element, { theme: 'dark' })`
3. **Global configuration** - `SQLWorkbench.config({ theme: 'dark' })`
4. **Built-in default** - `'auto'`, which follows the system preference

## Custom Themes

You can define custom themes that either extend existing light/dark themes or define completely new color schemes.

### Defining Custom Themes

Custom themes are automatically inherited by programmatic embeds, so you only need to define them once globally.

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
  },
  theme: 'ocean'  // Global default theme
});

// Use via data-attribute (highest priority)
// <pre class="sql-workbench-embedded" data-theme="sunset">

// Or programmatically (inherits customThemes automatically)
new SQLWorkbench.Embedded(element, {
  theme: 'ocean'  // Overrides global default
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

Supported literal file references in `FROM`/`JOIN` clauses and file-reader calls are registered and executed using their full resolved URLs. Embeds can read identically named files from different base URLs without collisions. The displayed SQL stays unchanged; ordinary string values and comments are preserved. Queries opened in SQL Workbench also carry these resolved URLs.

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
- **Tab / Shift+Tab**: Move focus forward / backward between the editor and other page controls

## API Reference

### SQLWorkbench.init()

Initialize all embeds matching the configured selector.

### SQLWorkbench.destroy()

Destroy all embeds, including directly constructed instances, and disconnect automatic cleanup. UI removal is immediate. The returned promise waits for active database operations and releases the connection and worker; shutdown errors reject the promise.

```javascript
await SQLWorkbench.destroy();
```

Moving an embed between connected parents preserves it. Removing its container or an ancestor automatically destroys the instance. Destroying a single embed leaves the shared database available to other embeds.

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
<script type="module" src="https://unpkg.com/sql-workbench-embedded@0.1.4/dist/sql-workbench-embedded.esm.js"></script>
```

**Option 2: npm**
```bash
npm install sql-workbench-embedded
```

#### Usage

The following component uses the npm import. For CDN usage, omit the package import and use `window.SQLWorkbench` after the library script has loaded.

```jsx
import { useRef, useEffect } from 'react';
import { SQLWorkbench } from 'sql-workbench-embedded';

function SQLWorkbenchEmbedded({ code, options }) {
  const containerRef = useRef(null);
  const embedRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      // Create a pre element with the SQL code
      const preElement = document.createElement('pre');
      preElement.className = 'sql-workbench-embedded';
      preElement.textContent = code;
      containerRef.current.appendChild(preElement);

      // Initialize the embed
      embedRef.current = new SQLWorkbench.Embedded(preElement, options);
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
  <div ref="containerRef"></div>
</template>

<script>
import { ref, shallowRef, onMounted, onUnmounted } from 'vue';
import { SQLWorkbench } from 'sql-workbench-embedded';

export default {
  props: {
    code: String,
    options: Object
  },
  setup(props) {
    const containerRef = ref(null);
    const embedRef = shallowRef(null);

    onMounted(() => {
      if (containerRef.value) {
        // Create a pre element with the SQL code
        const preElement = document.createElement('pre');
        preElement.className = 'sql-workbench-embedded';
        preElement.textContent = props.code;
        containerRef.value.appendChild(preElement);

        // Initialize the embed
        embedRef.value = new SQLWorkbench.Embedded(preElement, props.options);
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
import { SQLWorkbench } from 'sql-workbench-embedded';

export default {
  props: ['code', 'options'],
  mounted() {
    if (this.$refs.container) {
      const element = document.createElement('pre');
      element.className = 'sql-workbench-embedded';
      element.textContent = this.code;
      this.$refs.container.appendChild(element);

      this.embed = new SQLWorkbench.Embedded(element, this.options);
    }
  },
  beforeDestroy() {
    this.embed?.destroy();
  },
};
</script>
```

## Bundle Size

The library is optimized for production with minimal bundle size:

- **UMD Bundle**: 29.81 kB minified, 9.54 kB gzipped
- **ES Module**: 30.59 kB minified, 9.59 kB gzipped
- **DuckDB WASM**: Loaded separately from CDN (~5MB on first use)

### Size Breakdown

- **SQL Workbench Embed**: ~20 kB (UI, syntax highlighting, path resolution, theming)
- **DuckDB Client Library**: ~6 kB (minimal DuckDB bindings)
- **Build Overhead**: ~3 kB (UMD wrapper, utilities)

### Performance Impact

- **Initial Load**: 9.54 kB gzipped (extremely lightweight)
- **First Query**: Additional ~5MB for DuckDB WASM binary (cached thereafter)
- **Subsequent Loads**: Only 9.54 kB (DuckDB cached)

The production build maintains a compact size while providing full functionality including flexible theming and typography customization.

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
