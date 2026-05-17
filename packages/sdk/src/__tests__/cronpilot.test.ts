import { beforeEach, describe, expect, it, vi } from "vitest";
import { Cronpilot, CronpilotClientError, CronpilotServerError } from "../index.js";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function okResponse(): Response {
	return { ok: true, status: 200 } as Response;
}

function errorResponse(status: number): Response {
	return { ok: false, status } as Response;
}

describe("Cronpilot", () => {
	beforeEach(() => {
		fetchMock.mockReset();
		vi.useRealTimers();
	});

	it("default ping hits the right URL with empty JSON body", async () => {
		fetchMock.mockResolvedValueOnce(okResponse());
		const client = new Cronpilot({ token: "mon_xxx" });
		await client.ping();
		expect(fetchMock).toHaveBeenCalledOnce();
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://api.cronpilot.com/ping/mon_xxx");
		expect(JSON.parse(init.body as string)).toEqual({});
	});

	it("sends status, duration, and exitCode in the body", async () => {
		fetchMock.mockResolvedValueOnce(okResponse());
		const client = new Cronpilot({ token: "mon_xxx" });
		await client.ping({ status: "fail", duration: 1234, exitCode: 1 });
		const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(JSON.parse(init.body as string)).toEqual({
			status: "fail",
			duration: 1234,
			exitCode: 1,
		});
	});

	it("4xx throws CronpilotClientError and does not retry", async () => {
		fetchMock.mockResolvedValue(errorResponse(404));
		const client = new Cronpilot({ token: "mon_xxx" });
		await expect(client.ping()).rejects.toBeInstanceOf(CronpilotClientError);
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it("5xx retries then throws CronpilotServerError", async () => {
		fetchMock.mockResolvedValue(errorResponse(500));
		vi.useFakeTimers();
		const client = new Cronpilot({ token: "mon_xxx", retries: 2 });
		// Attach catch before advancing timers to avoid unhandled rejection warnings
		const caught = client.ping().catch((e: unknown) => e);
		await vi.runAllTimersAsync();
		const error = await caught;
		expect(error).toBeInstanceOf(CronpilotServerError);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("network error retries then throws CronpilotServerError", async () => {
		fetchMock.mockRejectedValue(new Error("Network failure"));
		vi.useFakeTimers();
		const client = new Cronpilot({ token: "mon_xxx", retries: 2 });
		// Attach catch before advancing timers to avoid unhandled rejection warnings
		const caught = client.ping().catch((e: unknown) => e);
		await vi.runAllTimersAsync();
		const error = await caught;
		expect(error).toBeInstanceOf(CronpilotServerError);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("uses AbortSignal.timeout with the configured timeout", async () => {
		const abortSignalSpy = vi.spyOn(AbortSignal, "timeout");
		fetchMock.mockResolvedValueOnce(okResponse());
		const client = new Cronpilot({ token: "mon_xxx", timeout: 3000 });
		await client.ping();
		expect(abortSignalSpy).toHaveBeenCalledWith(3000);
		abortSignalSpy.mockRestore();
	});
});
