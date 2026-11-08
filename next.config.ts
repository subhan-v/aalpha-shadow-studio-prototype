import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    /* There is a stray package-lock.json in the home directory, so Turbopack's
       lockfile search walks up and picks ~ as the workspace root. Pin it to
       this app instead — otherwise module resolution and the file watcher are
       scoped to the whole home folder. */
    root: path.resolve(import.meta.dirname),
    /* Public demo build: swap the real Trivium pilot data for an empty module. */
    ...(process.env.NEXT_PUBLIC_DEMO === "1" ? { resolveAlias: { "@/lib/pilot": "./src/lib/pilot-none.ts" } } : {}),
  },

  async headers() {
    return [
      {
        /* ── noindex, on EVERY route, permanently ──────────────────────────────
           Required by WEB-BUILD-AND-DEPLOY-STANDARD.md for any non-production
           deploy, and correct for this project forever: it is an internal design
           reference plus outbound-only prospect reports at /p/[code]. Neither
           should ever appear in a search result.

           Header-based rather than metadata-only on purpose — a header travels
           with the deployment to any domain it is later attached to, including a
           *.aalpha.ai subdomain, where an indexed prospect report would compete
           in search with the practice we are pitching. `noarchive` also keeps it
           out of cached copies.

           Deployment Protection is the other half of this (the URL alone must not
           be access); it is an account-level setting, not a repo one. */
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
    ];
  },
};

export default nextConfig;
