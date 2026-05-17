import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("timeout", () => {
	it("passes AbortSignal.timeout(timeout) to fetch and wraps timeout error as CronpilotServerError", async () => {
		const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
		const abortError = new DOMException("The operation was aborted", "TimeoutError");
		mockFetch.mockRejectedValue(abortError);

		const client = new Cronpilot({ token: "mon_test", timeout: 1000, retries: 0 });
		const err = await client.ping().catch((e) => e);

		expect(timeoutSpy).toHaveBeenCalledWith(1000);
		expect(err).toBeInstanceOf(CronpilotServerError);
		expect(err.cause).toBe(abortError);

		timeoutSpy.mockRestore();
	});

	it("defaults to 5000ms timeout", async () => {
		const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
		mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

		const client = new Cronpilot({ token: "mon_test" });
		await client.ping();

		expect(timeoutSpy).toHaveBeenCalledWith(5000);

		timeoutSpy.mockRestore();
	});
});

describe("retry-backoff", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("5xx retries up to retries times (default 2) for 3 total attempts", async () => {
		mockFetch.mockResolvedValue(new Response(null, { status: 500 }));
		const client = new Cronpilot({ token: "mon_test" });

		const promise = client.ping().catch((e) => e);
		await vi.runAllTimersAsync();
		const err = await promise;

		expect(mockFetch).toHaveBeenCalledTimes(3);
		expect(err).toBeInstanceOf(CronpilotServerError);
	});

	it("network errors retry then throw CronpilotServerError", async () => {
		mockFetch.mockRejectedValue(new TypeError("fetch failed"));
		const client = new Cronpilot({ token: "mon_test" });

		const promise = client.ping().catch((e) => e);
		await vi.runAllTimersAsync();
		const err = await promise;

		expect(mockFetch).toHaveBeenCalledTimes(3);
		expect(err).toBeInstanceOf(CronpilotServerError);
	});

	it("uses 200ms * 2^attempt exponential backoff between retries", async () => {
		mockFetch.mockResolvedValue(new Response(null, { status: 500 }));
		const client = new Cronpilot({ token: "mon_test", retries: 2 });

		const promise = client.ping().catch(() => {});

		expect(mockFetch).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(200);
		expect(mockFetch).toHaveBeenCalledTimes(2);

		await vi.advanceTimersByTimeAsync(400);
		expect(mockFetch).toHaveBeenCalledTimes(3);

		await promise;
	});
});
