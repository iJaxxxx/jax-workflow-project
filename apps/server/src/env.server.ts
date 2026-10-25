import "varlock/auto-load";

// biome-ignore lint/performance/noBarrelFile: entry point that loads env vars before re-exporting them
export { ENV } from "./env";
