# Executive Summary

The SQL Workbench Embed is a lightweight JavaScript library that transforms static SQL code blocks into interactive, browser-based SQL execution environments. It leverages DuckDB WASM to provide a complete analytics engine running entirely client-side, eliminating the need for backend infrastructure.

**Core Value Proposition**: Enables documentation sites, tutorials, and static pages to offer executable SQL examples without server-side processing.

---

## Functional Requirements

### FR1: Embed Initialization

#### FR1.1: Automatic Discovery
- **Requirement**: System SHALL automatically scan the DOM for SQL code blocks marked with class `sql-workbench-embed`
- **Default Selector**: `"pre.sql-workbench-embed, .sql-workbench-embed pre"`
- **Trigger**: DOMContentLoaded event or manual `init()` call
- **Configurable**: Users can override selector via configuration

#### FR1.2: Embed Transformation
- **Requirement**: System SHALL replace matched elements with interactive embed containing:
  - Editable SQL code area
  - Run button for query execution
  - Reset button to restore original code
  - Output area for displaying results
  - Loading indicators during execution

#### FR1.3: Manual Initialization
- **Requirement**: System SHALL provide API for programmatic embed creation
- **API**: `new window.SQLWorkbench.Embed(element, options)`
- **Use Case**: Framework integrations (React, Vue, etc.)

### FR2: SQL Code Editing

#### FR2.1: Interactive Editor
- **Requirement**: System SHALL provide editable SQL code area using contenteditable
- **Features**:
  - Direct inline editing of SQL
  - Cursor position preservation during updates
  - Multi-line support
  - Configurable via `editable: boolean` option

#### FR2.2: Syntax Highlighting
- **Requirement**: System SHALL apply real-time SQL syntax highlighting
- **Engine**: Inlined sql-highlight library (v4.2.0)
- **Supported Elements**:
  - SQL keywords (SELECT, FROM, WHERE, JOIN, etc.)
  - String literals
  - Comments (single-line and multi-line)
  - Numbers and identifiers
  - MySQL backtick identifiers
- **Performance**: Debounced at 150ms for large code blocks

#### FR2.3: Code Reset
- **Requirement**: System SHALL provide ability to restore original SQL code
- **Trigger**: Reset button click
- **Behavior**: Discards all edits and restores initial state

### FR3: Query Execution

#### FR3.1: DuckDB Integration
- **Requirement**: System SHALL execute SQL queries using DuckDB WASM
- **Version**: Configurable, default v1.30.0
- **CDN**: Configurable, default jsdelivr
- **Lazy Loading**: DuckDB loads only on first query execution
- **Shared Instance**: All embeds share single DuckDB connection

#### FR3.2: Execution Triggers
- **Requirement**: System SHALL support multiple execution methods:
  - Click "Run" button
  - Keyboard shortcut: Ctrl+Enter (Windows/Linux) or Cmd+Enter (Mac)
  - Programmatic: `embed.run()` API

#### FR3.3: Path Resolution
- **Requirement**: System SHALL automatically resolve relative file paths to absolute URLs
- **Supported Formats**:
  - `'data.parquet'` → `{baseUrl}/data.parquet`
  - `'./data.parquet'` → `{baseUrl}/data.parquet`
  - `'/data.parquet'` → `{origin}/data.parquet`
- **Base URL**: Configurable via `baseUrl` option (default: "https://data.sql-workbench.com")

#### FR3.4: File Registration
- **Requirement**: System SHALL register HTTP-accessible files with DuckDB
- **Supported Protocols**: http, https
- **File Types**: Primarily parquet files (DuckDB native support)

#### FR3.5: Error Handling
- **Requirement**: System SHALL provide user-friendly error messages
- **Features**:
  - Contextual error descriptions
  - Suggestions for common issues
  - Display in output area
  - Error state styling

### FR4: Result Display

#### FR4.1: Tabular Output
- **Requirement**: System SHALL display query results in HTML table format
- **Features**:
  - Column headers from result schema
  - Row data formatted appropriately
  - Responsive table layout
  - Empty state handling

#### FR4.2: Result Metadata
- **Requirement**: System SHALL display query execution metadata
- **Information Included**:
  - Row count
  - Execution time
  - Column information

### FR5: UI States

#### FR5.1: Loading State
- **Requirement**: System SHALL indicate query execution progress
- **Visual Elements**:
  - Progress bar or spinner
  - Disabled buttons during execution
  - Loading message
- **Minimum Duration**: 200ms for smooth UX perception

#### FR5.2: Error State
- **Requirement**: System SHALL display errors in output area
- **Styling**: Distinct error appearance (color, icon)

#### FR5.3: Success State
- **Requirement**: System SHALL display results with success indicators
- **Includes**: Result count, execution metadata

### FR6: Configuration

#### FR6.1: Global Configuration
- **Requirement**: System SHALL support global configuration object
- **Options**:
  - `selector`: CSS selector for auto-discovery
  - `baseUrl`: Base URL for relative path resolution
  - `theme`: Visual theme ("light" or "dark")
  - `autoInit`: Enable/disable automatic initialization
  - `duckdbVersion`: DuckDB WASM version
  - `duckdbCDN`: CDN URL for DuckDB assets
  - `editable`: Allow code editing

#### FR6.2: Per-Embed Configuration
- **Requirement**: System SHALL support instance-specific options
- **Override**: Instance options override global configuration

### FR7: Lifecycle Management

#### FR7.1: Embed Cleanup
- **Requirement**: System SHALL provide cleanup mechanism
- **API Methods**:
  - `embed.destroy()`: Remove single embed
  - `window.SQLWorkbench.destroy()`: Remove all embeds
- **Cleanup Actions**:
  - Close database connections
  - Remove event listeners
  - Clear DOM elements
  - Release memory

#### FR7.2: Automatic Cleanup
- **Requirement**: System SHALL detect removed embeds and cleanup automatically
- **Implementation**: MutationObserver watching DOM removals
- **Memory Management**: WeakMap for instance tracking

### FR8: Accessibility

#### FR8.1: ARIA Support
- **Requirement**: System SHALL include appropriate ARIA attributes
- **Features**:
  - Semantic HTML structure
  - Keyboard navigation support
  - Screen reader compatibility

#### FR8.2: Keyboard Shortcuts
- **Requirement**: System SHALL support keyboard-only operation
- **Shortcuts**:
  - Ctrl/Cmd + Enter: Execute query
  - Tab navigation between buttons
  - Focus management

### FR9: Framework Integration

#### FR9.1: Vanilla JavaScript
- **Requirement**: System MUST work in plain HTML/JS environments
- **Method**: CDN script tag with auto-initialization

#### FR9.2: React Integration
- **Requirement**: System SHALL support React component wrapping
- **Pattern**: useRef + useEffect hooks

#### FR9.3: Vue Integration
- **Requirement**: System SHALL support Vue component integration
- **Pattern**: mounted/beforeUnmount lifecycle hooks

#### FR9.4: Documentation Frameworks
- **Requirement**: System SHALL integrate with popular doc frameworks
- **Supported**: Docusaurus, VitePress, custom static sites

---

## Non-Functional Requirements

### NFR1: Performance

#### NFR1.1: Bundle Size
- **Requirement**: Embed MUST be lightweight for fast loading
- **Target**: ~20KB minified
- **Strategy**: Inline dependencies, tree-shaking

#### NFR1.2: Lazy Loading
- **Requirement**: DuckDB WASM MUST load on-demand, not at initialization
- **Benefit**: Reduces initial page load time
- **Trigger**: First query execution

#### NFR1.3: Shared Resources
- **Requirement**: Multiple embeds MUST share single DuckDB instance
- **Benefit**: Reduces memory footprint and initialization overhead

#### NFR1.4: Debouncing
- **Requirement**: Syntax highlighting SHALL be debounced for large code blocks
- **Delay**: 150ms
- **Benefit**: Prevents UI lag during rapid typing

#### NFR1.5: Minimum UX Duration
- **Requirement**: Loading states SHALL display for minimum 200ms
- **Rationale**: Prevents jarring flickers for fast queries

#### NFR1.6: Caching
- **Requirement**: DuckDB SHALL cache downloaded parquet files
- **Benefit**: Prevents duplicate network requests

### NFR2: Security

#### NFR2.1: Client-Side Execution
- **Requirement**: All query execution MUST occur in browser
- **Benefit**: No data transmission to external servers
- **Privacy**: User data never leaves browser

#### NFR2.2: CSP Compatibility
- **Requirement**: Embed SHALL work with Content Security Policy
- **Requirements**:
  - Allow script loading from CDN
  - Allow WASM execution
  - Allow Web Workers

#### NFR2.3: Subresource Integrity
- **Requirement**: CDN delivery SHALL support SRI verification
- **Benefit**: Ensures script integrity

#### NFR2.4: No External Dependencies (Runtime)
- **Requirement**: Embed SHALL inline all dependencies except DuckDB WASM
- **Benefit**: Reduces supply chain attack surface

### NFR3: Compatibility

#### NFR3.1: Browser Support
- **Requirement**: System SHALL support modern browsers
- **Minimum Versions**:
  - Chrome/Edge 88+
  - Firefox 89+
  - Safari 15+
- **Required Features**:
  - WebAssembly
  - Web Workers
  - ES2018+
  - Contenteditable

#### NFR3.2: DuckDB Version Compatibility
- **Requirement**: System SHALL support configurable DuckDB versions
- **Default**: v1.31.1-dev1.0
- **Flexibility**: Users can upgrade/downgrade as needed

#### NFR3.3: CDN Flexibility
- **Requirement**: System SHALL support multiple CDN providers
- **Default**: jsdelivr
- **Configurable**: Users can specify alternative CDNs

### NFR4: Usability

#### NFR4.1: Zero Configuration
- **Requirement**: System SHALL work with zero configuration for basic use
- **Method**: Sensible defaults, auto-initialization

#### NFR4.2: Intuitive UI
- **Requirement**: Interface SHALL be self-explanatory
- **Elements**:
  - Clear action buttons (Run, Reset)
  - Visual feedback for all states
  - Obvious error messages

#### NFR4.3: Responsive Design
- **Requirement**: UI SHALL adapt to different screen sizes
- **Breakpoint**: <480px for mobile optimization
- **Adjustments**: Button layout, table scrolling

### NFR5: Maintainability

#### NFR5.1: Single File Distribution
- **Requirement**: Embed SHALL distribute as single JS file
- **Benefit**: Simplifies deployment and versioning

#### NFR5.2: Clear API Surface
- **Requirement**: Public API SHALL be minimal and well-defined
- **Exposed**:
  - `SQLWorkbench.init()`
  - `SQLWorkbench.destroy()`
  - `SQLWorkbench.Embed` class
  - `SQLWorkbench.config` object

#### NFR5.3: Version Management
- **Requirement**: Embed SHALL follow semantic versioning
- **Current**: v1.3.0
- **CDN Support**: Version pinning via unpkg

### NFR6: Accessibility

#### NFR6.1: WCAG Compliance
- **Requirement**: Embed SHALL meet WCAG 2.1 AA standards
- **Features**:
  - Keyboard navigation
  - Screen reader support
  - Sufficient color contrast

#### NFR6.2: Theme Support
- **Requirement**: Embed SHALL support light and dark themes
- **Detection**: Automatic via system preferences
- **Override**: Manual configuration option

### NFR7: Reliability

#### NFR7.1: Error Recovery
- **Requirement**: System SHALL handle errors gracefully without crashing
- **Behaviors**:
  - Display user-friendly error messages
  - Maintain embed state after errors
  - Allow retry after failure

#### NFR7.2: Memory Management
- **Requirement**: System SHALL prevent memory leaks
- **Strategies**:
  - WeakMap for instance tracking
  - Proper cleanup on embed destruction
  - Connection closure on destroy

#### NFR7.3: Worker Fallback
- **Requirement**: System SHALL handle worker initialization failures
- **Strategy**: Fallback worker creation strategies

### NFR8: Extensibility

#### NFR8.1: Configuration Override
- **Requirement**: All default behaviors SHALL be configurable
- **Scope**: Global and per-instance configuration

#### NFR8.2: External DuckDB Instance
- **Requirement**: System SHALL accept pre-initialized DuckDB instance
- **Use Case**: Advanced users with custom DuckDB configuration

### NFR9: Observability

#### NFR9.1: Progress Tracking
- **Requirement**: System SHALL indicate initialization progress
- **Visibility**: Loading states during DuckDB initialization

#### NFR9.2: Execution Metadata
- **Requirement**: System SHALL report query execution metrics
- **Metrics**: Execution time, row count

---

## Technical Architecture

### Development environment

- TypeScript shall be used as implementation language
- A bundler shall be used to create the final artifacts with an optimized filesize

### Component Structure

```
SQLWorkbenchEmbed
├── SQL Editor (contenteditable)
│   ├── Syntax Highlighter (sql-highlight inlined)
│   └── Cursor Position Manager
├── Control Buttons
│   ├── Run Button
│   └── Reset Button
├── Output Area
│   ├── Table Renderer
│   ├── Error Display
│   └── Loading Indicator
└── DuckDB Manager
    ├── Lazy Initialization
    ├── Connection Pool
    ├── File Registration
    └── Query Executor
```

### Data Flow

1. **Initialization Phase**
   - DOM scan for matching elements
   - Embed instance creation
   - Event listener attachment
   - UI rendering

2. **Editing Phase**
   - User modifies SQL code
   - Debounced syntax highlighting
   - Cursor position preservation

3. **Execution Phase**
   - Query validation
   - DuckDB initialization (if needed)
   - Path resolution
   - File registration
   - Query execution
   - Result rendering

4. **Cleanup Phase**
   - Connection closure
   - Event listener removal
   - DOM cleanup
   - Memory release

### Key Technologies

- **DuckDB WASM**: 1.31.1-dev1.0 (configurable)
- **Syntax Highlighting**: [sql-highlight](https://github.com/scriptcoded/sql-highlight) (latest version, inlined)
- **Module System**: UMD (works in browser and Node.js)
- **Build Target**: ES2018+
- **Distribution**: Single minified JS file (~20KB)

---

## Comparison with Similar Solutions

### vs. Traditional Backend SQL Execution
- **Advantage**: No server infrastructure needed
- **Advantage**: Zero data transmission (privacy)
- **Advantage**: Instant feedback
- **Limitation**: Browser resource constraints

### vs. Code Playgrounds (JSFiddle, CodePen)
- **Advantage**: Embedded in documentation
- **Advantage**: No navigation away from page
- **Advantage**: Focused on SQL only
- **Limitation**: Less general-purpose

### vs. Static Code Blocks
- **Advantage**: Interactive learning
- **Advantage**: Experimentation without setup
- **Advantage**: Immediate verification
- **Enhancement**: Builds on existing code block patterns

---

## Use Cases

### UC1: Documentation Sites
**Actor**: Documentation maintainer
**Goal**: Provide executable SQL examples
**Flow**:
1. Add SQLWorkbench script to site
2. Mark SQL code blocks with class
3. Users can run and modify examples

### UC2: SQL Tutorials
**Actor**: Tutorial author
**Goal**: Enable hands-on learning
**Flow**:
1. Create step-by-step SQL tutorial
2. Each example is executable
3. Students experiment with variations

### UC3: Data Analysis Demos
**Actor**: Data analyst
**Goal**: Share analysis workflows
**Flow**:
1. Write SQL analysis in blog post
2. Readers can modify and re-run
3. Include sample parquet data

### UC4: Product Documentation
**Actor**: Product team
**Goal**: Demonstrate SQL API capabilities
**Flow**:
1. Document SQL features
2. Provide live examples
3. Users test with own modifications

---

## Implementation Considerations

### For embed-sql-workbench.com

The SQLWorkbench embed provides a reference implementation for key features that could be adapted:

#### Similarities
1. **SQL Execution in Browser**: Both use DuckDB WASM
2. **Interactive Code Editing**: Syntax highlighting + editing
3. **Static Site Integration**: Embedded in web pages
4. **Parquet File Support**: Loading external data
5. **Zero Backend**: Client-side execution

#### Potential Adaptations
1. **Path Resolution Strategy**: Automatic conversion of relative paths
2. **Lazy Loading Pattern**: Load DuckDB only when needed
3. **Shared Instance**: Single DuckDB across multiple embeds
4. **Debounced Highlighting**: Performance optimization for large code
5. **Minimum UX Duration**: Smooth loading perception
6. **Embed Lifecycle**: Automatic cleanup with MutationObserver
7. **Framework Integration Patterns**: React/Vue examples

#### Differentiation Opportunities
1. **Enhanced Editor**: Full Monaco/CodeMirror integration
2. **Query History**: Track executed queries
3. **Visualization**: Charts and graphs from results
4. **Multi-Table Support**: Schema management
5. **Export Options**: CSV, JSON, Parquet downloads
6. **Collaboration**: Share snippets with others
7. **Advanced DuckDB Features**: Extensions, custom functions

---

## Recommendations

### For Similar Implementation

1. **Prioritize Performance**
   - Inline critical dependencies
   - Lazy load heavy components (DuckDB)
   - Share resources across instances
   - Debounce expensive operations

2. **Simplify Integration**
   - Provide CDN option
   - Auto-initialization by default
   - Zero-config for basic use
   - Clear migration path for frameworks

3. **Focus on UX**
   - Instant visual feedback
   - Clear error messages
   - Keyboard shortcuts
   - Responsive design

4. **Ensure Security**
   - Client-side execution only
   - CSP compliance
   - No data transmission
   - SRI support

5. **Plan for Scale**
   - Efficient memory management
   - Automatic cleanup
   - Resource sharing
   - Progressive enhancement

---

## Conclusion

The SQLWorkbench Embed successfully demonstrates that sophisticated SQL execution environments can be embedded directly into static web pages with minimal overhead. By leveraging DuckDB WASM and modern web APIs, it provides an interactive learning and documentation experience without backend infrastructure.

Key takeaways:
- **Feasibility**: Browser-based SQL execution is production-ready
- **Performance**: Lazy loading and resource sharing enable efficient operation
- **Usability**: Simple integration patterns encourage adoption
- **Architecture**: Clean separation of concerns enables maintainability

For the embed-sql-workbench.com project, SQLWorkbench serves as validation of the core concept and provides architectural patterns worth considering, while also highlighting opportunities for enhanced features and differentiation.
