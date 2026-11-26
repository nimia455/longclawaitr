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
  siblingCss?: string,
  siblingJs?: string
): string {
  const bridge = buildBridgeScript(runId);
  const trimmed = code.trim();
  const hasFullDoc = /<!doctype|<html[\s>]/i.test(trimmed);

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
      background: #ffffff;
      color: #0a0a0a;
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
  const bg = theme === 'dark' ? '#141414' : '#f8f8f8';
  const grid = theme === 'dark' ? '#242424' : '#e6e6e6';

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

function buildReactPreview(code: string, runId: string, theme: 'light' | 'dark'): string {
  const bridge = buildBridgeScript(runId);
  const bg = theme === 'dark' ? '#0f0f0f' : '#ffffff';
  const tx = theme === 'dark' ? '#f5f5f5' : '#0a0a0a';

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
      var rawCode = ${safeJsonEmbed(code)};
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
        // Normalize ES imports/exports for browser execution
        var transformedSource = rawCode
          // Remove CSS imports
          .replace(/^\\s*import\\s+['"][^'"]+\\.css['"];?\\s*$/gm, '')
          // Replace react imports with destructuring from React
          .replace(/^\\s*import\\s+React\\s*,\\s*\\{([^}]+)\\}\\s+from\\s+['"]react['"];?\\s*$/gm, 'const {$1} = React;')
          .replace(/^\\s*import\\s+\\{([^}]+)\\}\\s+from\\s+['"]react['"];?\\s*$/gm, 'const {$1} = React;')
          .replace(/^\\s*import\\s+React\\s+from\\s+['"]react['"];?\\s*$/gm, '')
          .replace(/^\\s*import\\s+\\*\\s+as\\s+React\\s+from\\s+['"]react['"];?\\s*$/gm, '')
          // Provide lightweight inline SVG component stubs for lucide-react imports
          .replace(/^\\s*import\\s+\\{([^}]+)\\}\\s+from\\s+['"]lucide-react['"];?\\s*$/gm, function(_, names) {
            return names.split(',').map(function(n) {
              var clean = n.trim().split(/\\s+as\\s+/).pop().trim();
              if (!clean) return '';
              return 'const ' + clean + ' = (props) => React.createElement("svg", Object.assign({ width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, props), React.createElement("circle", { cx: 12, cy: 12, r: 9 }));';
            }).join('\\n');
          })
          // Drop any remaining external import lines safely
          .replace(/^\\s*import\\s+[\\s\\S]*?from\\s+['"][^'"]+['"];?\\s*$/gm, '')
          // Capture default exported function/class/expression
          .replace(/export\\s+default\\s+function\\s+([A-Za-z0-9_]+)/g, 'function $1')
          .replace(/export\\s+default\\s+class\\s+([A-Za-z0-9_]+)/g, 'class $1')
          .replace(/export\\s+default\\s+/g, 'const __DefaultExport__ = ')
          .replace(/^\\s*export\\s+(const|let|var|function|class)\\s+/gm, '$1 ');

        // Detect default component name if named export default function/class was used
        var defaultMatch = rawCode.match(/export\\s+default\\s+(?:function|class)\\s+([A-Za-z0-9_]+)/);
        var defaultName = defaultMatch ? defaultMatch[1] : null;
        if (!defaultName) {
          var appMatch = rawCode.match(/(?:function|const|class)\\s+(App|[A-Z][A-Za-z0-9_]*)\\b/);
          if (appMatch) defaultName = appMatch[1];
        }

        var compiled = window.Babel.transform(transformedSource, {
          presets: ['react', 'typescript'],
          filename: 'App.tsx'
        }).code;

        var runner = new Function(
          'React',
          'ReactDOM',
          'useState',
          'useEffect',
          'useRef',
          'useMemo',
          'useCallback',
          'useReducer',
          'useContext',
          'Fragment',
          compiled + '\\nreturn typeof __DefaultExport__ !== "undefined" ? __DefaultExport__ : (typeof ' + (defaultName || 'App') + ' !== "undefined" ? ' + (defaultName || 'App') + ' : null);'
        );

        var TargetComp = runner(
          window.React,
          window.ReactDOM,
          window.React.useState,
          window.React.useEffect,
          window.React.useRef,
          window.React.useMemo,
          window.React.useCallback,
          window.React.useReducer,
          window.React.useContext,
          window.React.Fragment
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

        var element = typeof TargetComp === 'function'
          ? window.React.createElement(TargetComp)
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
  const bg = theme === 'dark' ? '#0f0f0f' : '#ffffff';
  const tx = theme === 'dark' ? '#f5f5f5' : '#0a0a0a';
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
      var raw = ${safeJsonEmbed(code)};
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
        var fn = new Function(executable);
        var result = fn();
        if (result !== undefined) {
          console.log(result);
        }
      } catch (err) {
        console.error(err);
      }
    })();
  </script>
</body>
</html>`;
}

function buildCssPreview(code: string, runId: string): string {
  const bridge = buildBridgeScript(runId);
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
      background: #ffffff;
      color: #0a0a0a;
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
  const bg = theme === 'dark' ? '#0f0f0f' : '#ffffff';
  const tx = theme === 'dark' ? '#e5e5e5' : '#171717';
  const mut = theme === 'dark' ? '#9ca3af' : '#6b7280';

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
  const bg = theme === 'dark' ? '#0f0f0f' : '#ffffff';
  const tx = theme === 'dark' ? '#f5f5f5' : '#0a0a0a';

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
  const bg = theme === 'dark' ? '#0f0f0f' : '#ffffff';
  const tx = theme === 'dark' ? '#f5f5f5' : '#0a0a0a';
  const mut = theme === 'dark' ? '#a3a3a3' : '#525252';
  const surf = theme === 'dark' ? '#1a1a1a' : '#f5f5f5';
  const bd = theme === 'dark' ? '#2e2e2e' : '#e5e5e5';

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
    const srcDoc = buildHtmlPreview(code, runId, siblingCss, siblingJs);
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
      srcDoc: buildCssPreview(code, runId),
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
    srcDoc: buildHtmlPreview(code, runId, siblingCss, siblingJs),
    isConsoleFirst: false,
    fileName: 'longclaw-result.html',
    mimeType: 'text/html',
    downloadContent: code,
  };
}
