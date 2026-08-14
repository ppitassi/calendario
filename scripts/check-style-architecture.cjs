const fs = require("node:fs");
const path = require("node:path");

const roots = ["app", "src"];
const primitiveNames = ["Button", "IconButton", "Input", "Textarea", "Select", "Checkbox", "Radio", "Surface", "Modal", "Dropdown", "Tooltip"];
const appearanceUtilities = /(?:^|\s)(?:[a-z0-9-]+:)*(?:bg-|text-(?:xs|sm|base|lg|xl|[2-9]xl|white|black|red|rose|orange|amber|yellow|green|emerald|blue|indigo|violet|purple|pink|zinc|slate|gray)|border(?:-|\b)|rounded(?:-|\b)|shadow(?:-|\b)|blur(?:-|\b)|backdrop-|font-(?:sans|serif|mono|thin|light|normal|medium|semibold|bold|black)|p[trblxy]?-[0-9]|h-(?:[0-9]|1[0-9]|2[0-9]))/;
const globalAppearanceUtilities = /(?:^|\s)(?:[a-z0-9-]+:)*(?:bg-|text-(?:xs|sm|base|lg|xl|[2-9]xl|\[|white|black|red|rose|orange|amber|yellow|green|emerald|blue|indigo|violet|purple|pink|zinc|slate|gray|primary|foreground)|border(?:-|\b)|rounded(?:-|\b)|shadow(?:-|\b)|blur(?:-|\b)|backdrop-|font-(?:sans|serif|mono|display|thin|light|normal|medium|semibold|bold|black)|z-(?:\[|-?\d))/;
const allowedExternalDimensions = /^(?:[a-z0-9-]+:)*(?:w-(?:full|auto|min|max|fit|screen)|h-(?:full|auto|screen)|min-w-|max-w-|min-h-|max-h-)/;

function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => { const target = path.join(dir, entry.name); return entry.isDirectory() ? files(target) : /\.(tsx|jsx)$/.test(entry.name) ? [target] : []; }); }
const violations = [];
for (const root of roots) if (fs.existsSync(root)) for (const file of files(root)) {
  const source = fs.readFileSync(file, "utf8");
  const checkGlobalClasses = (classes, index) => {
    const invalid = classes.split(/\s+/).filter(Boolean).filter(value => globalAppearanceUtilities.test(value));
    if (!invalid.length) return;
    const context = source.slice(Math.max(0, index - 300), index);
    if (!context.includes("style-architecture-utility-exception:")) {
      const line = source.slice(0, index).split("\n").length;
      violations.push(`${file}:${line}: utility visual fora de CSS Module/primitive: ${invalid.join(" ")}`);
    }
  };
  for (const match of source.matchAll(/className=["']([^"']*)["']/g)) checkGlobalClasses(match[1], match.index);
  for (const call of source.matchAll(/\bcn\(([\s\S]*?)\)/g)) {
    for (const match of call[1].matchAll(/["']([^"']*)["']/g)) checkGlobalClasses(match[1], call.index + match.index);
  }
  for (const name of primitiveNames) {
    const pattern = new RegExp(`<${name}\\b[^>]*className=["']([^"']*)["']`, "g");
    for (const match of source.matchAll(pattern)) {
      const classes = match[1].split(/\s+/).filter(Boolean);
      const invalid = classes.filter(value => appearanceUtilities.test(value) && !allowedExternalDimensions.test(value));
      if (invalid.length) violations.push(`${file}: <${name}> sobrescreve aparência interna: ${invalid.join(" ")}`);
    }
  }
  const normalized = file.replaceAll("\\", "/");
  if (!normalized.includes("/components/ui/")) {
    for (const match of source.matchAll(/<(input|textarea|select)\b/g)) {
      const context = source.slice(Math.max(0, match.index - 220), match.index);
      if (!context.includes("style-architecture-exception:")) {
        const line = source.slice(0, match.index).split("\n").length;
        violations.push(`${file}:${line}: <${match[1]}> nativo fora de primitive sem exceção documentada`);
      }
    }
    for (const match of source.matchAll(/<(?:motion\.)?button\b/g)) {
      const context = source.slice(Math.max(0, match.index - 360), match.index);
      if (!context.includes("style-architecture-button-exception:")) {
        const line = source.slice(0, match.index).split("\n").length;
        violations.push(`${file}:${line}: botão nativo fora de primitive sem exceção de feature documentada`);
      }
    }
  }
}

function styleFiles(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => { const target = path.join(dir, entry.name); return entry.isDirectory() ? styleFiles(target) : entry.name.endsWith(".css") ? [target] : []; }); }
const allStyleFiles = roots.flatMap(root => fs.existsSync(root) ? styleFiles(root) : []);
for (const file of allStyleFiles) {
  const normalized = file.replaceAll("\\", "/");
  if (normalized.endsWith("/styles/variables.css") || normalized.endsWith("/styles/print.css")) continue;
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/#[0-9a-f]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/gi)) {
    const context = source.slice(Math.max(0, match.index - 300), match.index);
    if (context.includes("style-token-exception:")) continue;
    const line = source.slice(0, match.index).split("\n").length;
    violations.push(`${file}:${line}: cor literal fora de variables.css/print.css: ${match[0]}`);
  }
  const governedValues = [
    { pattern: /z-index\s*:\s*-?\d+/gi, label: "z-index literal" },
    { pattern: /border-radius\s*:\s*(?!0(?:\s|;))[0-9.]+(?:px|rem|em|%)/gi, label: "radius literal" },
    { pattern: /(?:filter|backdrop-filter)\s*:\s*blur\((?!0(?:px|rem|em)?\))[0-9.]+(?:px|rem|em)/gi, label: "blur literal" },
    { pattern: /(?:box-shadow|text-shadow)\s*:\s*(?:inset\s+)?-?[0-9.]+(?:px|rem|em)/gi, label: "shadow literal" },
    { pattern: /font-family\s*:[^;]+/gi, label: "font-family literal" },
  ];
  for (const rule of governedValues) for (const match of source.matchAll(rule.pattern)) {
    const context = source.slice(Math.max(0, match.index - 300), match.index);
    if (context.includes("style-token-exception:")) continue;
    if (rule.label === "font-family literal" && /:\s*var\(/i.test(match[0])) continue;
    if (rule.label === "blur literal" && context.includes("@supports")) continue;
    const line = source.slice(0, match.index).split("\n").length;
    violations.push(`${file}:${line}: ${rule.label} fora de variables.css/print.css: ${match[0]}`);
  }
}

const definedTokens = new Set();
for (const file of allStyleFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/(--[a-zA-Z0-9-_]+)\s*:/g)) definedTokens.add(match[1]);
}
for (const file of allStyleFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/var\(\s*(--[a-zA-Z0-9-_]+)([^)]*)\)/g)) {
    if (definedTokens.has(match[1]) || match[2].includes(",")) continue;
    const line = source.slice(0, match.index).split("\n").length;
    violations.push(`${file}:${line}: token CSS utilizado sem definiÃ§Ã£o ou fallback: ${match[1]}`);
  }
}
if (violations.length) { console.error(violations.join("\n")); process.exit(1); }
console.log("Arquitetura de estilos: primitives e exceções de feature validados.");
