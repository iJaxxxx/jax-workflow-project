import z from "zod";

import { adminProcedure, router } from "../index";

const PAGE_SIZE = 20;

const userSummarySelect = {
	email: true,
	id: true,
	name: true,
} as const;

export const operationLogRouter = router({
	list: adminProcedure
		.input(
			z.object({
				action: z.enum(["USER_BAN", "USER_UNBAN"]).optional(),
				page: z.number().int().min(1).default(1),
			})
		)
		.query(async ({ ctx, input }) => {
			const { page, action } = input;
			const where = action ? { action } : {};

			const [total, items] = await ctx.db.$transaction([
				ctx.db.operationLog.count({ where }),
				ctx.db.operationLog.findMany({
					orderBy: [{ createdAt: "desc" }, { id: "desc" }],
					select: {
						action: true,
						createdAt: true,
						id: true,
						operator: { select: userSummarySelect },
						target: { select: userSummarySelect },
					},
					skip: (page - 1) * PAGE_SIZE,
					take: PAGE_SIZE,
					where,
				}),
			]);

			return { items, page, pageSize: PAGE_SIZE, total };
		}),
});
