import { TRPCError } from "@trpc/server";
import z from "zod";

import { adminProcedure, router } from "../index";

const PAGE_SIZE = 20;

export const userRouter = router({
	list: adminProcedure
		.input(
			z.object({
				page: z.number().int().min(1).default(1),
				search: z.string().trim().max(100).optional(),
			})
		)
		.query(async ({ ctx, input }) => {
			const { page, search } = input;
			const where = search
				? {
						OR: [
							{ name: { contains: search, mode: "insensitive" as const } },
							{ email: { contains: search, mode: "insensitive" as const } },
						],
					}
				: {};

			const [total, items] = await ctx.db.$transaction([
				ctx.db.user.count({ where }),
				ctx.db.user.findMany({
					orderBy: { createdAt: "desc" },
					select: {
						banned: true,
						createdAt: true,
						email: true,
						id: true,
						name: true,
						role: true,
					},
					skip: (page - 1) * PAGE_SIZE,
					take: PAGE_SIZE,
					where,
				}),
			]);

			return { items, page, pageSize: PAGE_SIZE, total };
		}),

	setBanned: adminProcedure
		.input(
			z.object({
				banned: z.boolean(),
				userId: z.string().min(1),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { userId, banned } = input;

			if (userId === ctx.session.user.id) {
				throw new TRPCError({ code: "FORBIDDEN", message: "不能禁用自己" });
			}

			const target = await ctx.db.user.findUnique({
				select: { banned: true, id: true },
				where: { id: userId },
			});

			if (!target) {
				throw new TRPCError({ code: "NOT_FOUND", message: "用户不存在" });
			}

			if (target.banned === banned) {
				return { banned: target.banned, id: target.id };
			}

			return await ctx.db.$transaction(async (tx) => {
				const updated = await tx.user.update({
					data: { banned },
					select: { banned: true, id: true },
					where: { id: userId },
				});

				if (banned) {
					await tx.session.deleteMany({ where: { userId } });
				}

				return updated;
			});
		}),
});
