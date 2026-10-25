import { createAuth } from "@jax-workflow-project/auth";
import { createPrismaClient } from "@jax-workflow-project/db";

import { ENV } from "./env.server";

export const db = createPrismaClient(ENV);
export const auth = createAuth(ENV, db);
