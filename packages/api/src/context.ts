import type { Session } from "@jax-workflow-project/auth";
import type { Database } from "@jax-workflow-project/db";

export type Context = {
  session: Session | null;
  db: Database;
};
