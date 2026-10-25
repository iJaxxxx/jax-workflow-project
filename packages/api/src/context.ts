import type { Session } from "@jax-workflow-project/auth";
import type { Database } from "@jax-workflow-project/db";

// biome-ignore lint/style/useConsistentTypeDefinitions: tRPC adapters require an implicit index signature, which interfaces lack
export type Context = {
	db: Database;
	session: Session | null;
};
