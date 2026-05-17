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
