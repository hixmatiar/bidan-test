# Assignment: plan checkbox 35

Repo: /Users/pikachen/Documents/UNS/SEM 3/RSI/praktik-bidan. Plan: `.omo/plans/praktik-bidan-monorepo.md`.

## Read
Plan checkbox 35 (all pinned versions and files); `TSD.md:77`; draft decision 15.

## Implement exactly checkbox 35
Create `frontend/` by hand (no `npm create` scaffold), exactly:
- `package.json` with the pinned deps from the plan: react 18.3.1, react-dom 18.3.1, vite ^5.4.0, @vitejs/plugin-react ^4.3.0, typescript ^5.6.0, @types/react 18.3.x, @types/react-dom 18.3.x, @types/node ^22, tailwindcss ^3.4.0, postcss ^8.4.0, autoprefixer ^10.4.0, tailwindcss-animate, class-variance-authority, clsx, tailwind-merge, lucide-react, @radix-ui/react-slot, @radix-ui/react-label, react-router-dom ^6, axios ^1, recharts ^2. Scripts: dev `vite`, build `tsc -b && vite build`, typecheck `tsc -p tsconfig.app.json --noEmit`, preview `vite preview`.
- `index.html`, `vite.config.ts` (react plugin + `@` alias via `fileURLToPath(new URL('./src', import.meta.url))`), `tsconfig.json` (references, `files: []`), `tsconfig.app.json` (baseUrl/paths `@/*`, strict, jsx react-jsx, composite true, tsBuildInfoFile under node_modules/.tmp), `tsconfig.node.json` (composite, includes vite.config.ts), `postcss.config.js` (ESM export), `tailwind.config.js` (ESM export, content index.html+src, darkMode class, shadcn tokens, borderRadius, tailwindcss-animate), `.env.example` (`VITE_API_BASE_URL=http://localhost:3000/api/v1`), `src/vite-env.d.ts`, `src/main.tsx`, `src/index.css` (shadcn HSL :root/.dark vars, 3 Tailwind directives, base border/body rules).
- No routes, pages, API clients, charts, App.tsx (task 36).
- Root `.gitignore` already ignores node_modules/dist; do not add Docker.

## Verify
1. `cd frontend && npm install` (allow up to 10 min; if a registry failure occurs, record exact output).
2. `npm run typecheck` exit 0; `cd .. && npx tsc --noEmit` not applicable at root (no root tsconfig) — instead confirm `frontend/npx tsc --noEmit -p tsconfig.app.json` exit 0.
3. `npm run build` exit 0 and `frontend/dist/index.html` exists.
4. `cd frontend && npx tailwindcss --help` or `npm ls tailwindcss` confirms v3.4.x.
5. Alias proof: temporarily add `import { cn } from '@/lib/utils'` in a scratch file → typecheck fails because lib/utils does not exist yet (task 36); remove the scratch file.
Do not commit `node_modules` or `dist`.

## Record/commit
Append to `.omo/evidence/task-35-praktik-bidan-monorepo.txt`; `git add frontend` (never node_modules/dist) and commit `feat(frontend): scaffold Vite React TypeScript with Tailwind`. Retry on git lock. Print `DONE_TASK_35` + DoneClaim.

HARD RULE: no foreground long-running commands; `npm install` is fine (it returns); never start `vite dev`/`preview` without `nohup ... &` and kill it within 60s.