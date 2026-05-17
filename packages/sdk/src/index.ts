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
	override cause: unknown;
	constructor(message: string, status?: number, cause?: unknown) {
		super(message);
		this.name = "CronpilotServerError";
		if (status !== undefined) this.status = status;
		this.cause = cause;
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
	private token: string;
	private baseUrl: string;
	private timeout: number;
	private retries: number;

	constructor(options: CronpilotOptions) {
		this.token = options.token;
		this.baseUrl = options.baseUrl ?? "https://api.cronpilot.com";
		this.timeout = options.timeout ?? 5000;
		this.retries = options.retries ?? 2;
	}

	async ping(options: PingOptions = {}): Promise<void> {
		const url = `${this.baseUrl}/ping/${this.token}`;
		const body = JSON.stringify({
			status: options.status ?? "ok",
			...(options.duration !== undefined && { duration: options.duration }),
			...(options.exitCode !== undefined && { exitCode: options.exitCode }),
		});

		let lastError: unknown;

		for (let attempt = 0; attempt <= this.retries; attempt++) {
			if (attempt > 0) {
				await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** (attempt - 1)));
			}

			try {
				const response = await fetch(url, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body,
					signal: AbortSignal.timeout(this.timeout),
				});

				if (response.ok) return;

				if (response.status >= 400 && response.status < 500) {
					throw new CronpilotClientError(
						`Request failed with status ${response.status}`,
						response.status,
					);
				}

				lastError = new CronpilotServerError(
					`Request failed with status ${response.status}`,
					response.status,
				);
			} catch (err) {
				if (err instanceof CronpilotClientError) throw err;
				lastError =
					err instanceof CronpilotServerError
						? err
						: new CronpilotServerError("Network error", undefined, err);
			}
		}

		if (lastError instanceof CronpilotServerError) throw lastError;
		throw new CronpilotServerError("Request failed", undefined, lastError);
	}
}
