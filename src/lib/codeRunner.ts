export interface ExtractedCodeBlock {
  index: number;
  language: string;
  code: string;
}

const PREVIEWABLE_LANGUAGES = new Set([
  'html',
  'htm',
  'svg',
  'jsx',
  'tsx',
  'react',
  'javascript',
  'js',
  'typescript',
  'ts',
  'css',
  'json',
  'markdown',
  'md',
  'mermaid',
]);

export function normalizeCodeLanguage(rawLang: string, code: string): string {
  const clean = (rawLang || '').trim().toLowerCase();
  if (clean) {
    if (clean === 'htm') return 'html';
    if (clean === 'js') return 'javascript';
    if (clean === 'ts') return 'typescript';
    if (clean === 'md') return 'markdown';
    return clean;
  }

  const trimmed = code.trim();
  if (/^<!doctype\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return 'html';
  }
  if (/^<svg[\s>]/i.test(trimmed)) {
    return 'svg';
  }
  if (
    /^import\s+.*from\s+['"]react['"]/m.test(trimmed) ||
    /export\s+default\s+function\s+[A-Z]/.test(trimmed)
  ) {
    return 'jsx';
  }
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {}
  }
  return '';
}

export function isPreviewableCode(rawLang: string, code: string): boolean {
  if (!code || !code.trim()) return false;
  const lang = normalizeCodeLanguage(rawLang, code);
  return PREVIEWABLE_LANGUAGES.has(lang);
}

export function extractCodeBlocks(markdown: string): ExtractedCodeBlock[] {
  if (!markdown) return [];
  const blocks: ExtractedCodeBlock[] = [];
  const regex = /```([^\n`]*)\n?([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = regex.exec(markdown)) !== null) {
    const rawLang = (match[1] || '').trim();
    const code = match[2] || '';
    const language = normalizeCodeLanguage(rawLang, code);
    blocks.push({ index: idx++, language, code });
  }
  return blocks;
}

export function getSiblingWebAssets(
  markdown: string,
  targetBlockIndex: number
): { siblingCss: string; siblingJs: string } {
  const blocks = extractCodeBlocks(markdown);
  const cssParts: string[] = [];
  const jsParts: string[] = [];

  for (const b of blocks) {
    if (b.index === targetBlockIndex) continue;
    if (b.language === 'css') cssParts.push(b.code);
    if (b.language === 'javascript') jsParts.push(b.code);
  }

  return {
    siblingCss: cssParts.join('\n\n'),
    siblingJs: jsParts.join('\n\n'),
  };
}

function safeJsonEmbed(val: unknown): string {
  return JSON.stringify(val).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

function buildBridgeScript(runId: string): string {
  return `<script>
(function() {
  var RUN_ID = ${safeJsonEmbed(runId)};
  function serializeArg(arg) {
    if (arg === undefined) return 'undefined';
    if (arg === null) return 'null';
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
    if (arg instanceof Error) return arg.stack || (arg.name + ': ' + arg.message);
    try {
      return JSON.stringify(arg, null, 2);
    } catch (e) {
      return String(arg);
    }
  }
  function send(type, level, args) {
    try {
      window.parent.postMessage({
        source: 'longclaw-preview',
        runId: RUN_ID,
        type: type,
        level: level,
        text: Array.prototype.map.call(args, serializeArg).join(' ')
      }, '*');
    } catch (e) {}
  }
  ['log', 'info', 'warn', 'error'].forEach(function(level) {
    var orig = console[level];
    console[level] = function() {
      send('console', level, arguments);
      if (orig) orig.apply(console, arguments);
    };
  });
  window.addEventListener('error', function(e) {
    var msg = e && (e.message || (e.error && e.error.message)) || 'Runtime error';
    send('error', 'error', [msg]);
  });
  window.addEventListener('unhandledrejection', function(e) {
    var reason = e && e.reason ? (e.reason.message || String(e.reason)) : 'Unhandled promise rejection';
    send('error', 'error', [reason]);
  });
})();
</script>`;
}

function buildHtmlPreview(
  code: string,
  runId: string,
  theme: 'light' | 'dark',
  siblingCss?: string,
  siblingJs?: string
): string {
  const bridge = buildBridgeScript(runId);
  const trimmed = code.trim();
  const hasFullDoc = /<!doctype|<html[\s>]/i.test(trimmed);
  const bg = theme === 'dark' ? '#000000' : '#FFFFFF';
  const tx = theme === 'dark' ? '#FFFFFF' : '#000000';

  const extraCss =
    siblingCss && !/<style[\s>]/i.test(trimmed)
      ? `<style>\n${siblingCss}\n</style>`
      : '';
  const extraJs =
    siblingJs && !/<script[\s>]/i.test(trimmed)
      ? `<script>\n${siblingJs}\n</script>`
      : '';

  if (hasFullDoc) {
    let doc = trimmed;
    if (/<head[^>]*>/i.test(doc)) {
      doc = doc.replace(/<head[^>]*>/i, (m) => `${m}\n${bridge}\n${extraCss}`);
    } else {
      doc = doc.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${bridge}${extraCss}</head>`);
    }
    if (extraJs) {
      if (/<\/body>/i.test(doc)) {
        doc = doc.replace(/<\/body>/i, `${extraJs}\n</body>`);
      } else {
        doc += `\n${extraJs}`;
      }
    }
    return doc;
  }

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${bridge}
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: ${bg};
      color: ${tx};
      line-height: 1.5;
    }
  </style>
  ${extraCss}
</head>
<body>
  ${code}
  ${extraJs}
</body>
</html>`;
}

function buildSvgPreview(code: string, runId: string, theme: 'light' | 'dark'): string {
  const bridge = buildBridgeScript(runId);
  const bg = theme === 'dark' ? '#000000' : '#FFFFFF';
  const grid = theme === 'dark' ? '#262626' : '#E5E5E5';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  ${bridge}
  <style>
    html, body {
      margin: 0;
      height: 100%;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background-color: ${bg};
      background-image: radial-gradient(${grid} 1px, transparent 1px);
      background-size: 16px 16px;
    }
    svg {
      max-width: 100%;
      max-height: 100%;
      height: auto;
      display: block;
    }
  </style>
</head>
<body>
  ${code}
</body>
</html>`;
}

const REACT_INJECTED_APIS = [
  'useState',
  'useEffect',
  'useLayoutEffect',
  'useRef',
  'useMemo',
  'useCallback',
  'useReducer',
  'useContext',
  'useId',
  'useTransition',
  'useDeferredValue',
  'useSyncExternalStore',
  'createContext',
  'forwardRef',
  'memo',
  'Fragment',
  'Suspense',
  'StrictMode',
] as const;

const REACT_INJECTED_SET = new Set<string>(REACT_INJECTED_APIS);

export function preprocessReactPreviewSource(rawCode: string): {
  transformedSource: string;
  defaultName: string | null;
} {
  const buildReactAliases = (names: string) =>
    names
      .split(',')
      .map((entry) => {
        const trimmed = entry.replace(/^type\s+/, '').trim();
        if (!trimmed) return '';
        const aliasParts = trimmed.split(/\s+as\s+/);
        const orig = aliasParts[0].trim();
        const local = (aliasParts[1] || aliasParts[0]).trim();
        if (!orig || !local) return '';
        if (orig === local && REACT_INJECTED_SET.has(local)) return '';
        return `var ${local} = React.${orig};`;
      })
      .filter(Boolean)
      .join('\n');

  const LUCIDE_ICON_PATHS: Record<string, string[]> = {
    Check: ['M20 6 9 17l-5-5'],
    X: ['M18 6 6 18', 'm6 6 12 12'],
    Plus: ['M5 12h14', 'M12 5v14'],
    Minus: ['M5 12h14'],
    Search: ['M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'm21 21-4.3-4.3'],
    Play: ['M6 4l14 8-14 8V4z'],
    Pause: ['M6 4h4v16H6z', 'M14 4h4v16h-4z'],
    RotateCcw: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5'],
    RotateCw: ['M21 12a9 9 0 1 1-3-6.7L21 8', 'M21 3v5h-5'],
    ArrowRight: ['M5 12h14', 'm12 5 7 7-7 7'],
    ArrowLeft: ['M19 12H5', 'm12 19-7-7 7-7'],
    ChevronDown: ['m6 9 6 6 6-6'],
    ChevronUp: ['m18 15-6-6-6 6'],
    ChevronRight: ['m9 18 6-6-6-6'],
    ChevronLeft: ['m15 18-6-6 6-6'],
    Sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2v2', 'M12 20v2', 'M4.93 4.93l1.41 1.41', 'M17.66 17.66l1.41 1.41', 'M2 12h2', 'M20 12h2', 'M6.34 17.66l-1.41 1.41', 'M19.07 4.93l-1.41 1.41'],
    Moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
    Trash2: ['M3 6h18', 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6', 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2', 'M10 11v6', 'M14 11v6'],
    Trash: ['M3 6h18', 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6', 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'],
    Edit: ['M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7', 'M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z'],
    Pencil: ['M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'],
    Copy: ['M8 4h12v12H8z', 'M4 8v12h12'],
    Download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
    Heart: ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'],
    Star: ['m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'],
    Clock: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 6v6l4 2'],
    Calendar: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'],
    Settings: ['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'],
    Menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
    Send: ['m22 2-7 20-4-9-9-4Z', 'M22 2 11 13'],
    Sparkles: ['m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z'],
    AlertCircle: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 8v4', 'M12 16h.01'],
  };

  const buildLucideStubs = (names: string) =>
    names
      .split(',')
      .map((entry) => {
        const trimmed = entry.replace(/^type\s+/, '').trim();
        if (!trimmed) return '';
        const aliasParts = trimmed.split(/\s+as\s+/);
        const orig = aliasParts[0].trim();
        const local = (aliasParts[1] || aliasParts[0]).trim();
        if (!local) return '';
        const paths = LUCIDE_ICON_PATHS[orig];
        if (paths && paths.length > 0) {
          const children = paths
            .map((d, idx) => `React.createElement("path", { key: ${idx}, d: ${JSON.stringify(d)} })`)
            .join(', ');
          return `var ${local} = (props) => React.createElement("svg", Object.assign({ width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, props), ${children});`;
        }
        return `var ${local} = (props) => React.createElement("svg", Object.assign({ width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, props), React.createElement("circle", { cx: 12, cy: 12, r: 9 }));`;
      })
      .filter(Boolean)
      .join('\n');

  const transformedSource = rawCode
    // Remove side-effect CSS/asset imports
    .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '')
    // Remove TypeScript-only imports (single or multiline)
    .replace(/^\s*import\s+type\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    // Replace React named/default imports (single or multiline) without shadowing pre-injected params
    .replace(
      /^\s*import\s+React\s*,\s*\{([\s\S]*?)\}\s+from\s+['"]react['"];?\s*$/gm,
      (_, names) => buildReactAliases(names)
    )
    .replace(
      /^\s*import\s+\{([\s\S]*?)\}\s+from\s+['"]react['"];?\s*$/gm,
      (_, names) => buildReactAliases(names)
    )
    .replace(/^\s*import\s+React\s+from\s+['"]react['"];?\s*$/gm, '')
    .replace(/^\s*import\s+\*\s+as\s+React\s+from\s+['"]react['"];?\s*$/gm, '')
    // Provide lightweight inline SVG stubs for lucide-react imports (single or multiline)
    .replace(
      /^\s*import\s+\{([\s\S]*?)\}\s+from\s+['"]lucide-react['"];?\s*$/gm,
      (_, names) => buildLucideStubs(names)
    )
    // Drop any remaining external import statements safely (single or multiline)
    .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    // Normalize exports
    .replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)/g, 'function $1')
    .replace(/export\s+default\s+class\s+([A-Za-z0-9_]+)/g, 'class $1')
    .replace(/export\s+default\s+/g, 'const __DefaultExport__ = ')
    .replace(/^\s*export\s+(const|let|var|function|async\s+function|class|interface|type|enum)\s+/gm, '$1 ');

  // Detect root component: explicit default export -> App -> last capitalized component
  const defaultNamedMatch = rawCode.match(/export\s+default\s+(?:function|class)\s+([A-Za-z0-9_]+)/);
  let defaultName: string | null = defaultNamedMatch ? defaultNamedMatch[1] : null;
  if (!defaultName) {
    const defaultIdentMatch = rawCode.match(/export\s+default\s+([A-Z][A-Za-z0-9_]*)\s*;?/);
    if (defaultIdentMatch) defaultName = defaultIdentMatch[1];
  }
  if (!defaultName && /(?:function|const|let|var|class)\s+App\b/.test(rawCode)) {
    defaultName = 'App';
  }
  if (!defaultName) {
    const allCapMatches = Array.from(
      rawCode.matchAll(/(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)\b/g)
    );
    if (allCapMatches.length > 0) {
      defaultName = allCapMatches[allCapMatches.length - 1][1];
    }
  }

  return { transformedSource, defaultName };
}

export function preprocessScriptPreviewSource(rawCode: string): string {
  return rawCode
    .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*import\s+type\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*export\s+default\s+/gm, '')
    .replace(/^\s*export\s+(const|let|var|function|async\s+function|class|interface|type|enum)\s+/gm, '$1 ');
}

function buildReactPreview(code: string, runId: string, theme: 'light' | 'dark'): string {
  const bridge = buildBridgeScript(runId);
  const bg = theme === 'dark' ? '#000000' : '#FFFFFF';
  const tx = theme === 'dark' ? '#FFFFFF' : '#000000';
  const { transformedSource, defaultName } = preprocessReactPreviewSource(code);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${bridge}
  <script src="https://cdn.tailwindcss.com"></script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body {
      margin: 0;
      background: ${bg};
      color: ${tx};
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #root { min-height: 100vh; }
    .lc-err {
      margin: 16px;
      padding: 14px 16px;
      border-radius: 12px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #ef4444;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    (function() {
      var transformedSource = ${safeJsonEmbed(transformedSource)};
      var defaultName = ${safeJsonEmbed(defaultName)};
      var rootEl = document.getElementById('root');

      function showErr(err) {
        var msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
        console.error(msg);
        rootEl.innerHTML = '<div class="lc-err">' + msg.replace(/</g, '&lt;') + '</div>';
      }

      if (!window.React || !window.ReactDOM || !window.Babel) {
        showErr('React runtime failed to load. Check internet connection.');
        return;
      }

      try {
        var compiled = window.Babel.transform(transformedSource, {
          presets: ['react', 'typescript'],
          filename: 'App.tsx'
        }).code;

        var fallbackIdent = defaultName || 'App';
        var runner = new Function(
          'React',
          'ReactDOM',
          ${REACT_INJECTED_APIS.map((k) => `'${k}'`).join(',\n          ')},
          compiled + '\\nreturn typeof __DefaultExport__ !== "undefined" ? __DefaultExport__ : (typeof ' + fallbackIdent + ' !== "undefined" ? ' + fallbackIdent + ' : null);'
        );

        var TargetComp = runner(
          window.React,
          window.ReactDOM,
          ${REACT_INJECTED_APIS.map((k) => `window.React.${k}`).join(',\n          ')}
        );

        if (!TargetComp) {
          showErr('No React component found to render. Make sure your code defines or default-exports a component.');
          return;
        }

        var ErrorBoundary = class extends window.React.Component {
          constructor(props) { super(props); this.state = { error: null }; }
          static getDerivedStateFromError(error) { return { error: error }; }
          componentDidCatch(err) { console.error(err); }
          render() {
            if (this.state.error) {
              return window.React.createElement('div', { className: 'lc-err' }, String(this.state.error));
            }
            return this.props.children;
          }
        };

        var element = typeof TargetComp === 'function' || (TargetComp && typeof TargetComp === 'object' && TargetComp.$$typeof)
          ? (typeof TargetComp === 'function' || TargetComp.$$typeof === Symbol.for('react.forward_ref') || TargetComp.$$typeof === Symbol.for('react.memo')
            ? window.React.createElement(TargetComp)
            : TargetComp)
          : TargetComp;

        window.ReactDOM.createRoot(rootEl).render(
          window.React.createElement(ErrorBoundary, null, element)
        );
      } catch (err) {
        showErr(err);
      }
    })();
  </script>
</body>
</html>`;
}

function buildScriptPreview(
  code: string,
  language: string,
  runId: string,
  theme: 'light' | 'dark'
): string {
  const bridge = buildBridgeScript(runId);
  const bg = theme === 'dark' ? '#000000' : '#FFFFFF';
  const tx = theme === 'dark' ? '#FFFFFF' : '#000000';
  const isTs = language === 'typescript';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  ${bridge}
  ${isTs ? '<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>' : ''}
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: ${bg};
      color: ${tx};
      font-family: system-ui, -apple-system, sans-serif;
    }
    #app { width: 100%; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
    (function() {
      var raw = ${safeJsonEmbed(preprocessScriptPreviewSource(code))};
      var isTs = ${safeJsonEmbed(isTs)};
      try {
        var executable = raw;
        if (isTs) {
          if (!window.Babel) throw new Error('TypeScript transpiler failed to load.');
          executable = window.Babel.transform(raw, {
            presets: ['typescript'],
            filename: 'script.ts'
          }).code;
        }
        var AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
        var fn = new AsyncFunction(executable);
        Promise.resolve(fn())
          .then(function(result) {
            if (result !== undefined) {
              console.log(result);
            }
          })
          .catch(function(err) {
            console.error(err);
          });
      } catch (err) {
        console.error(err);
      }
    })();
  </script>
</body>
</html>`;
}

function buildCssPreview(code: string, runId: string, theme: 'light' | 'dark'): string {
  const bridge = buildBridgeScript(runId);
  const bg = theme === 'dark' ? '#000000' : '#FFFFFF';
  const tx = theme === 'dark' ? '#FFFFFF' : '#000000';
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  ${bridge}
  <style>
    body {
      margin: 0;
      padding: 24px;
      font-family: system-ui, -apple-system, sans-serif;
      background: ${bg};
      color: ${tx};
    }
  </style>
  <style>${code}</style>
</head>
<body>
  <div class="container card box wrapper">
    <h1>Heading Preview</h1>
    <p>Sample paragraph demonstrating typography, spacing, and surface styles from your CSS.</p>
    <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:16px;">
      <button class="btn primary button">Primary Button</button>
      <button class="btn secondary">Secondary</button>
    </div>
  </div>
</body>
</html>`;
}

function buildJsonPreview(code: string, runId: string, theme: 'light' | 'dark'): string {
  const bridge = buildBridgeScript(runId);
  const bg = theme === 'dark' ? '#000000' : '#FFFFFF';
  const tx = theme === 'dark' ? '#FFFFFF' : '#000000';
  const mut = theme === 'dark' ? '#9A9A9A' : '#666666';

  let formatted = code;
  let valid = true;
  let errMsg = '';
  try {
    formatted = JSON.stringify(JSON.parse(code), null, 2);
  } catch (e: any) {
    valid = false;
    errMsg = e?.message || 'Invalid JSON';
  }

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  ${bridge}
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: ${bg};
      color: ${tx};
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      line-height: 1.6;
    }
    .status {
      font-family: system-ui, sans-serif;
      font-size: 12px;
      margin-bottom: 12px;
      color: ${valid ? '#10b981' : '#ef4444'};
      font-weight: 600;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      color: ${valid ? tx : mut};
    }
  </style>
</head>
<body>
  <div class="status">${valid ? 'Valid JSON' : 'Invalid JSON: ' + errMsg.replace(/</g, '&lt;')}</div>
  <pre>${formatted.replace(/</g, '&lt;')}</pre>
</body>
</html>`;
}

function buildMermaidPreview(code: string, runId: string, theme: 'light' | 'dark'): string {
  const bridge = buildBridgeScript(runId);
  const bg = theme === 'dark' ? '#000000' : '#FFFFFF';
  const tx = theme === 'dark' ? '#FFFFFF' : '#000000';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  ${bridge}
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: true, theme: ${safeJsonEmbed(theme === 'dark' ? 'dark' : 'default')} });
  </script>
  <style>
    body {
      margin: 0;
      padding: 24px;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${bg};
      color: ${tx};
      font-family: system-ui, sans-serif;
    }
    .mermaid { width: 100%; display: flex; justify-content: center; }
  </style>
</head>
<body>
  <pre class="mermaid">${code.replace(/</g, '&lt;')}</pre>
</body>
</html>`;
}

function buildMarkdownPreview(code: string, runId: string, theme: 'light' | 'dark'): string {
  const bridge = buildBridgeScript(runId);
  const bg = theme === 'dark' ? '#000000' : '#FFFFFF';
  const tx = theme === 'dark' ? '#FFFFFF' : '#000000';
  const mut = theme === 'dark' ? '#9A9A9A' : '#666666';
  const surf = theme === 'dark' ? '#141414' : '#F5F5F5';
  const bd = theme === 'dark' ? '#262626' : '#E5E5E5';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  ${bridge}
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    body {
      margin: 0;
      padding: 28px;
      max-width: 760px;
      margin-inline: auto;
      background: ${bg};
      color: ${tx};
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 15px;
      line-height: 1.65;
    }
    pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
    pre { background: ${surf}; border: 1px solid ${bd}; padding: 14px; border-radius: 10px; overflow-x: auto; }
    code { background: ${surf}; padding: 2px 6px; border-radius: 5px; }
    pre code { background: transparent; padding: 0; }
    blockquote { border-left: 2px solid ${bd}; margin: 12px 0; padding-left: 14px; color: ${mut}; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid ${bd}; padding: 8px 12px; text-align: left; }
  </style>
</head>
<body>
  <div id="md"></div>
  <script>
    (function () {
      var raw = ${safeJsonEmbed(code)};
      var target = document.getElementById('md');
      if (!target) return;
      if (!window.marked) {
        target.textContent = raw;
        return;
      }
      var parsed = window.marked.parse(raw);
      var template = document.createElement('template');
      template.innerHTML = parsed;
      var blockedTags = {
        SCRIPT: true,
        IFRAME: true,
        OBJECT: true,
        EMBED: true,
        SVG: true,
        STYLE: true,
        FORM: true,
        BASE: true,
        META: true,
        LINK: true,
      };
      var urlAttrs = { href: true, src: true, action: true, formaction: true };
      var walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
      var toRemove = [];
      var node;
      while ((node = walker.nextNode())) {
        if (blockedTags[node.tagName]) {
          toRemove.push(node);
          continue;
        }
        var attrs = Array.prototype.slice.call(node.attributes || []);
        for (var i = 0; i < attrs.length; i++) {
          var attrName = attrs[i].name.toLowerCase();
          var attrVal = (attrs[i].value || '').trim();
          if (attrName.indexOf('on') === 0 || attrName === 'srcdoc') {
            node.removeAttribute(attrs[i].name);
            continue;
          }
          if (urlAttrs[attrName]) {
            var normalized = attrVal.replace(/[\\u0000-\\u0020]+/g, '').toLowerCase();
            if (
              normalized &&
              normalized.indexOf('http://') !== 0 &&
              normalized.indexOf('https://') !== 0 &&
              normalized.indexOf('mailto:') !== 0 &&
              normalized.indexOf('#') !== 0
            ) {
              node.removeAttribute(attrs[i].name);
            }
          }
        }
      }
      for (var r = 0; r < toRemove.length; r++) {
        if (toRemove[r].parentNode) {
          toRemove[r].parentNode.removeChild(toRemove[r]);
        }
      }
      target.textContent = '';
      target.appendChild(template.content);
    })();
  </script>
</body>
</html>`;
}

export interface PreviewBuildResult {
  srcDoc: string;
  isConsoleFirst: boolean;
  fileName: string;
  mimeType: string;
  downloadContent: string;
}

export function buildPreviewDocument(opts: {
  code: string;
  language: string;
  runId: string;
  theme: 'light' | 'dark';
  siblingCss?: string;
  siblingJs?: string;
}): PreviewBuildResult {
  const lang = normalizeCodeLanguage(opts.language, opts.code);
  const { code, runId, theme, siblingCss, siblingJs } = opts;

  if (lang === 'html') {
    const srcDoc = buildHtmlPreview(code, runId, theme, siblingCss, siblingJs);
    return {
      srcDoc,
      isConsoleFirst: false,
      fileName: 'longclaw-result.html',
      mimeType: 'text/html',
      downloadContent: srcDoc,
    };
  }
  if (lang === 'svg') {
    return {
      srcDoc: buildSvgPreview(code, runId, theme),
      isConsoleFirst: false,
      fileName: 'longclaw-graphic.svg',
      mimeType: 'image/svg+xml',
      downloadContent: code,
    };
  }
  if (lang === 'jsx' || lang === 'tsx' || lang === 'react') {
    const srcDoc = buildReactPreview(code, runId, theme);
    return {
      srcDoc,
      isConsoleFirst: false,
      fileName: lang === 'tsx' ? 'App.tsx' : 'App.jsx',
      mimeType: 'text/plain',
      downloadContent: code,
    };
  }
  if (lang === 'javascript' || lang === 'typescript') {
    return {
      srcDoc: buildScriptPreview(code, lang, runId, theme),
      isConsoleFirst: true,
      fileName: lang === 'typescript' ? 'script.ts' : 'script.js',
      mimeType: 'text/plain',
      downloadContent: code,
    };
  }
  if (lang === 'css') {
    return {
      srcDoc: buildCssPreview(code, runId, theme),
      isConsoleFirst: false,
      fileName: 'styles.css',
      mimeType: 'text/css',
      downloadContent: code,
    };
  }
  if (lang === 'json') {
    return {
      srcDoc: buildJsonPreview(code, runId, theme),
      isConsoleFirst: false,
      fileName: 'data.json',
      mimeType: 'application/json',
      downloadContent: code,
    };
  }
  if (lang === 'mermaid') {
    return {
      srcDoc: buildMermaidPreview(code, runId, theme),
      isConsoleFirst: false,
      fileName: 'diagram.mmd',
      mimeType: 'text/plain',
      downloadContent: code,
    };
  }
  if (lang === 'markdown') {
    return {
      srcDoc: buildMarkdownPreview(code, runId, theme),
      isConsoleFirst: false,
      fileName: 'document.md',
      mimeType: 'text/markdown',
      downloadContent: code,
    };
  }

  return {
    srcDoc: buildHtmlPreview(code, runId, theme, siblingCss, siblingJs),
    isConsoleFirst: false,
    fileName: 'longclaw-result.html',
    mimeType: 'text/html',
    downloadContent: code,
  };
}
