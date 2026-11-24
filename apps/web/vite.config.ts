import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

/** Serves api/proxy.ts in development, so `npm run dev` behaves like the deployed app. */
function devProxy(): Plugin {
  return {
    name: 'revenant-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy', async (req, res) => {
        const { GET } = (await server.ssrLoadModule(resolve(repoRoot, 'api/proxy.ts'))) as { GET: (r: Request) => Promise<Response> };
        const response = await GET(new Request(`http://localhost${req.originalUrl ?? req.url}`));
        res.statusCode = response.status;
        response.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(Buffer.from(await response.arrayBuffer()));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devProxy()],
  // The worker imports each package's cases.ts from ossuary/, outside this folder.
  server: { fs: { allow: [repoRoot] } },
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: false },
});
