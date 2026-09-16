import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { stagingLogin, testAccountFrom } from './server/staging-token.js';

/* The /api-test screen never calls the staging backend directly — a browser
   would block that unless the backend sends CORS headers for localhost.
   It calls /staging-api/* on this dev server instead, which forwards the
   request server-side, where CORS does not apply. */
const STAGING_PROXY_PATH = '/staging-api';
const TEST_LOGIN_PATH = '/staging-test-login';

/* POST /staging-test-login logs the .env.local test account in from the dev
   server and returns only the token, so the password never reaches the
   browser. Dev and preview only — a static build has no such route. */
function stagingTestLogin(env) {
  const account = testAccountFrom(env);
  const handler = async (req, res, next) => {
    if (req.url !== TEST_LOGIN_PATH) return next();
    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'POST') {
      res.statusCode = 405;
      return res.end(JSON.stringify({ message: 'POST only' }));
    }
    try {
      const { token, user } = await stagingLogin(account);
      res.end(JSON.stringify({ token, email: user?.email || account.email }));
    } catch (err) {
      res.statusCode = 502;
      res.end(JSON.stringify({ message: err.message }));
    }
  };
  return {
    name: 'staging-test-login',
    configureServer: (server) => { server.middlewares.use(handler); },
    configurePreviewServer: (server) => { server.middlewares.use(handler); },
  };
}

export default defineConfig(({ command, mode }) => {
  // '' prefix: read STAGING_API_URL from .env.local without exposing it to
  // the client bundle. Only the proxy below and the display string use it.
  const env = loadEnv(mode, process.cwd(), '');
  const target = String(env.STAGING_API_URL || '').replace(/\/+$/, '');

  const proxy = target
    ? {
        [STAGING_PROXY_PATH]: {
          target,
          // Rewrites Host to the backend's, which virtual-hosted servers need.
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.slice(STAGING_PROXY_PATH.length) || '/',
          configure: (p) => {
            // Some backends reject requests whose Origin is not on their
            // allowlist, even server-to-server. Nothing here needs it.
            p.on('proxyReq', (req) => req.removeHeader('origin'));
          },
        },
      }
    : undefined;

  return {
    plugins: [react(), tailwindcss(), stagingTestLogin(env)],
    // Relative asset paths so a build can be opened from disk or served
    // from any sub-path, matching how this dashboard has always been used.
    base: './',
    define: {
      /* Where src/lib/api.js sends requests. The dev server goes through the
         proxy; a build has no proxy, so it calls the backend directly —
         VITE_API_URL if set, else STAGING_API_URL — and that backend must
         allow the deployed origin in its CORS settings. */
      __API_BASE__: JSON.stringify(
        command === 'serve' && mode !== 'test'
          ? STAGING_PROXY_PATH
          : String(env.VITE_API_URL || target).replace(/\/+$/, ''),
      ),
      __STAGING_API_URL__: JSON.stringify(target),
      __STAGING_PROXY_PATH__: JSON.stringify(STAGING_PROXY_PATH),
      __STAGING_TEST_LOGIN__: JSON.stringify(TEST_LOGIN_PATH),
      // Only whether one is configured and as whom — never the password.
      __STAGING_TEST_EMAIL__: JSON.stringify(env.STAGING_TEST_EMAIL || ''),
    },
    server: { port: 5173, open: true, proxy },
    // Same proxy for `npm run preview`, so a built bundle can be tested too.
    preview: { proxy },
    test: {
      environment: 'node',
      include: ['src/**/*.test.js', 'src/**/*.test.jsx'],
    },
  };
});
