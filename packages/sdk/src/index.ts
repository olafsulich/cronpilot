export class CronpilotClientError extends Error {
	status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = "CronpilotClientError";
		this.status = status;
	}
}

export class CronpilotServerError extends Error {
	status?: number;
	override cause?: unknown;

	constructor(message: string, init?: { status?: number; cause?: unknown }) {
		super(message);
		this.name = "CronpilotServerError";
		if (init?.status !== undefined) this.status = init.status;
		if (init !== undefined && "cause" in init) this.cause = init.cause;
	}
}

type CronpilotOptions = {
	token: string;
	baseUrl?: string;
	timeout?: number;
	retries?: number;
};

type PingOptions = {
	status?: "ok" | "fail";
	duration?: number;
	exitCode?: number;
};

export class Cronpilot {
	private readonly token: string;
	private readonly baseUrl: string;
	private readonly timeout: number;
	private readonly retries: number;

	constructor(options: CronpilotOptions) {
		this.token = options.token;
		this.baseUrl = options.baseUrl ?? "https://api.cronpilot.com";
		this.timeout = options.timeout ?? 5000;
		this.retries = options.retries ?? 2;
	}

	async ping(options: PingOptions = {}): Promise<void> {
		const url = `${this.baseUrl}/ping/${this.token}`;
		const body: Record<string, unknown> = {};
		if (options.status !== undefined) body["status"] = options.status;
		if (options.duration !== undefined) body["duration"] = options.duration;
		if (options.exitCode !== undefined) body["exitCode"] = options.exitCode;
		const bodyStr = JSON.stringify(body);

		let lastError: CronpilotServerError | undefined;

		for (let attempt = 0; attempt <= this.retries; attempt++) {
			if (attempt > 0) {
				await new Promise<void>((resolve) => setTimeout(resolve, 200 * 2 ** (attempt - 1)));
			}

			try {
				const response = await fetch(url, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: bodyStr,
					signal: AbortSignal.timeout(this.timeout),
				});

				if (response.ok) return;

				if (response.status >= 400 && response.status < 500) {
					throw new CronpilotClientError(
						`Request failed with status ${response.status}`,
						response.status,
					);
				}

				lastError = new CronpilotServerError(`Request failed with status ${response.status}`, {
					status: response.status,
				});
			} catch (err) {
				if (err instanceof CronpilotClientError) throw err;
				if (err instanceof CronpilotServerError) {
					lastError = err;
				} else {
					lastError = new CronpilotServerError("Network error", { cause: err });
				}
			}
		}

		throw lastError ?? new CronpilotServerError("Request failed");
	}
}
