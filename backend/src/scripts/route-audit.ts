// Route audit: `npm run audit:routes`.
// Defaults must be assigned before the app is required: env.ts validates process.env at
// import time, and CommonJS hoists static imports above these assignments.
process.env.JWT_SECRET ??= 'route-audit-secret-min-32-characters';
process.env.DB_HOST ??= 'localhost';
process.env.DB_PORT ??= '1433';
process.env.DB_NAME ??= 'PraktikBidan';
process.env.DB_USER ??= 'sa';
process.env.DB_PASSWORD ??= 'route-audit';
process.env.WA_API_URL ??= 'https://example.invalid/wa';
process.env.WA_API_TOKEN ??= 'route-audit';

interface ExpressRouteLayer {
  path: string;
  methods: Record<string, boolean>;
}

interface ExpressLayer {
  name?: string;
  route?: ExpressRouteLayer;
  handle?: { stack?: ExpressLayer[] };
  regexp?: RegExp;
}

interface ExpressApp {
  _router?: { stack?: ExpressLayer[] };
}

// Express 4 keeps a mount path only inside the layer regexp, e.g.
// /^\/api\/v1\/?(?=\/|$)/ for app.use('/api/v1', router).
function mountPath(layer: ExpressLayer): string {
  const source = layer.regexp?.source ?? '';
  const normalised = source
    .replace(/^\^/, '')
    .replace(/\\\//g, '/')
    .replace(/\/\?\(\?=\/\|\$\)$/, '');
  return normalised === '/' ? '' : normalised;
}

function joinPath(parent: string, child: string): string {
  const base = parent.endsWith('/') ? parent.slice(0, -1) : parent;
  if (!child || child === '/') return base || '/';
  return `${base}${child.startsWith('/') ? child : `/${child}`}`;
}

function collect(stack: ExpressLayer[], parent: string): string[] {
  const routes: string[] = [];

  for (const layer of stack) {
    if (layer.route) {
      const fullPath = joinPath(parent, layer.route.path);
      for (const [method, enabled] of Object.entries(layer.route.methods)) {
        if (enabled) routes.push(`${method.toUpperCase()} ${fullPath}`);
      }
      continue;
    }

    if (layer.name === 'router' && layer.handle?.stack) {
      routes.push(
        ...collect(layer.handle.stack, joinPath(parent, mountPath(layer))),
      );
    }
  }

  return routes;
}

const { default: app } = require('../app') as { default: ExpressApp };

const routes = collect(app._router?.stack ?? [], '').sort();
for (const route of routes) console.log(route);

const gets = routes.filter((route) => route.startsWith('GET '));
const total = routes.length;

console.log(`TOTAL ${total}`);
console.log(`GET ${gets.length}`);

if (gets.length > 0 || total !== 51) {
  process.exit(1);
}
