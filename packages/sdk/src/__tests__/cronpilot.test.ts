import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Cronpilot, CronpilotClientError, CronpilotServerError } from "../index.js";

function mockResponse(status: number): Response {
	return { ok: status >= 200 && status < 300, status } as unknown as Response;
}

describe("Cronpilot", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it("default ping hits the right URL with empty JSON body", async () => {
		fetchMock.mockResolvedValueOnce(mockResponse(200));
		const client = new Cronpilot({ token: "mon_abc", retries: 0 });
		await client.ping();
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.cronpilot.com/ping/mon_abc",
			expect.objectContaining({ method: "POST", body: "{}" }),
		);
	});

	it("sends status, duration, and exitCode in body", async () => {
		fetchMock.mockResolvedValueOnce(mockResponse(200));
		const client = new Cronpilot({ token: "mon_abc", retries: 0 });
		await client.ping({ status: "fail", duration: 1234, exitCode: 1 });
		expect(fetchMock).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				body: JSON.stringify({ status: "fail", duration: 1234, exitCode: 1 }),
			}),
		);
	});

	it("4xx throws CronpilotClientError and does not retry", async () => {
		fetchMock.mockResolvedValue(mockResponse(404));
		const client = new Cronpilot({ token: "mon_abc", retries: 2 });
		await expect(client.ping()).rejects.toBeInstanceOf(CronpilotClientError);
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it("5xx retries up to retries times then throws CronpilotServerError", async () => {
		vi.useFakeTimers();
		fetchMock.mockResolvedValue(mockResponse(500));
		const client = new Cronpilot({ token: "mon_abc", retries: 2 });
		const promise = client.ping();
		const assertion = expect(promise).rejects.toBeInstanceOf(CronpilotServerError);
		await vi.runAllTimersAsync();
		await assertion;
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("network error retries up to retries times then throws CronpilotServerError", async () => {
		vi.useFakeTimers();
		fetchMock.mockRejectedValue(new Error("Network failure"));
		const client = new Cronpilot({ token: "mon_abc", retries: 2 });
		const promise = client.ping();
		const assertion = expect(promise).rejects.toBeInstanceOf(CronpilotServerError);
		await vi.runAllTimersAsync();
		await assertion;
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("timeout causes CronpilotServerError", async () => {
		const timeoutErr = new DOMException("The operation timed out.", "TimeoutError");
		fetchMock.mockRejectedValueOnce(timeoutErr);
		const client = new Cronpilot({ token: "mon_abc", retries: 0, timeout: 100 });
		await expect(client.ping()).rejects.toBeInstanceOf(CronpilotServerError);
	});
});
