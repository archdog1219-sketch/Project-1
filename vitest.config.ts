import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    server: {
      // next-auth imports the bare specifier "next/server" internally. This
      // Next.js version ships no package.json "exports" map for it, so
      // Node's native ESM resolver can't find it without an explicit
      // extension the way Next's own bundler can. By default Vitest
      // externalizes node_modules deps straight to Node's resolver; forcing
      // these through Vite's own resolve pipeline lets the alias below apply
      // so tests that transitively import lib/auth.ts (e.g. via
      // lib/admin.ts) can resolve next-auth at all.
      deps: { inline: [/next-auth/, /^next$/] },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "next/server": path.resolve(__dirname, "node_modules/next/server.js"),
    },
  },
});
