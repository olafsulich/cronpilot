import { beforeEach, describe, expect, it, vi } from "vitest";
import { Cronpilot, CronpilotClientError, CronpilotServerError } from "../index.js";

const mockFetch = vi.fn<typeof fetch>();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
	mockFetch.mockReset();
});

function okResponse(status = 200) {
	return new Response(null, { status });
}

describe("ping happy path", () => {
	it("POSTs to the correct URL with default status ok", async () => {
		mockFetch.mockResolvedValueOnce(okResponse());
		const client = new Cronpilot({ token: "mon_test" });
		const result = await client.ping();

		expect(result).toBeUndefined();
		expect(mockFetch).toHaveBeenCalledOnce();
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toBe("https://api.cronpilot.com/ping/mon_test");
		expect(init?.method).toBe("POST");
		expect(JSON.parse(init?.body as string)).toEqual({ status: "ok" });
	});

	it("sends status, duration, and exitCode in body", async () => {
		mockFetch.mockResolvedValueOnce(okResponse());
		const client = new Cronpilot({ token: "mon_test" });
		await client.ping({ status: "fail", duration: 1234, exitCode: 1 });

		const [, init] = mockFetch.mock.calls[0];
		expect(JSON.parse(init?.body as string)).toEqual({
			status: "fail",
			duration: 1234,
			exitCode: 1,
		});
	});
});

describe("error classes", () => {
	it("4xx throws CronpilotClientError with status and does not retry", async () => {
		mockFetch.mockResolvedValue(new Response(null, { status: 422 }));
		const client = new Cronpilot({ token: "mon_test", retries: 2 });

		const err = await client.ping().catch((e) => e);
		expect(err).toBeInstanceOf(CronpilotClientError);
		expect(err.status).toBe(422);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it("5xx throws CronpilotServerError with status after exhausting retries", async () => {
		mockFetch.mockResolvedValue(new Response(null, { status: 503 }));
		const client = new Cronpilot({ token: "mon_test", retries: 0 });

		const err = await client.ping().catch((e) => e);
		expect(err).toBeInstanceOf(CronpilotServerError);
		expect(err.status).toBe(503);
	});

	it("network error throws CronpilotServerError with cause", async () => {
		const networkErr = new TypeError("fetch failed");
		mockFetch.mockRejectedValue(networkErr);
		const client = new Cronpilot({ token: "mon_test", retries: 0 });

		const err = await client.ping().catch((e) => e);
		expect(err).toBeInstanceOf(CronpilotServerError);
		expect(err.cause).toBe(networkErr);
	});
});
