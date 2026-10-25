import { buttonVariants } from "@jax-workflow-project/ui/components/button";
import Link from "next/link";

export default function Forbidden() {
	return (
		<div className="container mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
			<h1 className="font-semibold text-2xl">无权限访问</h1>
			<p className="text-muted-foreground text-sm">
				当前账号不是管理员，无法访问后台管理页面。如需权限，请联系管理员。
			</p>
			<Link className={buttonVariants({ variant: "outline" })} href="/">
				返回首页
			</Link>
		</div>
	);
}
