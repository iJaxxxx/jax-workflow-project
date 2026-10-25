import { protectedProcedure, publicProcedure, router } from "../index";
import { userRouter } from "./user";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => "OK"),
	privateData: protectedProcedure.query(({ ctx }) => ({
		message: "This is private",
		user: ctx.session.user,
	})),
	user: userRouter,
});
export type AppRouter = typeof appRouter;
