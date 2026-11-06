import { varlockNextConfigPlugin } from "@varlock/nextjs-integration/plugin";

const withVarlock = varlockNextConfigPlugin();

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Static HTML in `out/`, deployed to Cloudflare Pages (no Node server).
	images: { unoptimized: true },
	output: "export",
	reactCompiler: true,
	typedRoutes: true,
};

export default withVarlock(nextConfig);
