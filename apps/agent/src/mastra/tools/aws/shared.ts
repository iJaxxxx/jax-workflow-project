// AWS 工具共用的配置。凭证走 SDK 默认链（本机 `aws login` 的会话、环境变量等），这里不写任何密钥。
// 默认资源名对应 docs/aws-architecture.html 里的那套环境，可以用环境变量覆盖。
export const awsConfig = { region: process.env.AWS_REGION ?? "ap-southeast-2" };

export const defaults = {
	ecsCluster: process.env.OPS_ECS_CLUSTER,
	ecsService: process.env.OPS_ECS_SERVICE ?? "go-github-users",
	lambdaFunction: process.env.OPS_LAMBDA_FUNCTION ?? "go-caller-sam",
	logGroup: process.env.OPS_LOG_GROUP ?? "/aws/lambda/go-caller-sam",
};

const MS_PER_MINUTE = 60_000;

// 小模型不擅长算时间戳，所以工具只收「往前看多少分钟」
export function lookbackWindow(minutes: number) {
	const end = new Date();
	return { end, start: new Date(end.getTime() - minutes * MS_PER_MINUTE) };
}

const CREDENTIAL_ERRORS =
	/expired|credential|token|UnrecognizedClient|InvalidClientTokenId/i;

// 把 AWS 报错转成模型和人都能看懂的一句话
export async function callAws<T>(action: string, fn: () => Promise<T>) {
	try {
		return await fn();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (CREDENTIAL_ERRORS.test(message)) {
			throw new Error(
				`${action}失败：AWS 凭证无效或已过期，请先在终端执行 aws login。原始错误：${message}`,
				{ cause: error }
			);
		}
		throw new Error(`${action}失败：${message}`, { cause: error });
	}
}
