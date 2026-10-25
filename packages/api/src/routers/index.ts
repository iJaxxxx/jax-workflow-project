import { protectedProcedure, publicProcedure, router } from "../index";
import { operationLogRouter } from "./operation-log";
import { userRouter } from "./user";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => "OK"),
	operationLog: operationLogRouter,
	privateData: protectedProcedure.query(({ ctx }) => ({
		message: "This is private",
		user: ctx.session.user,
	})),
	user: userRouter,
});
export type AppRouter = typeof appRouter;
