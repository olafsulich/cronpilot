import { AppError, ERROR_CODES } from "@cronpilot/shared";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

function getApiInternalUrl(): string {
	const url = process.env.API_INTERNAL_URL;
	if (!url) throw new Error("API_INTERNAL_URL is not set");
	return url;
}

function getServiceToken(): string {
	const token = process.env.API_SERVICE_TOKEN;
	if (!token) throw new Error("API_SERVICE_TOKEN is not set");
	return token;
}

async function handleResponse<T>(res: Response): Promise<T> {
	if (!res.ok) {
		let body: unknown;
		try {
			body = await res.json();
		} catch {
			throw new AppError(
				ERROR_CODES.INTERNAL_ERROR,
				`API error: ${res.status} ${res.statusText}`,
				res.status,
			);
		}
		const parsed = body as { error?: { code?: string; message?: string } };
		if (parsed.error) {
			throw new AppError(
				parsed.error.code ?? ERROR_CODES.INTERNAL_ERROR,
				parsed.error.message ?? "Unknown API error",
				res.status,
			);
		}
		throw new AppError(
			ERROR_CODES.INTERNAL_ERROR,
			`API error: ${res.status}`,
			res.status,
		);
	}

	const body = (await res.json()) as { data: T };
	return body.data;
}

/**
 * Server-side fetch using the internal API URL and service token.
 * Use this in Server Components and Route Handlers that need backend access.
 */
export async function serverFetch<T>(
	path: string,
	options: RequestInit = {},
): Promise<T> {
	const baseUrl = getApiInternalUrl();
	const token = getServiceToken();

	// Attempt to get the user session to forward their teamId context
	let authHeader: string = `Bearer ${token}`;
	try {
		const session = await getServerSession(authOptions);
		if (session?.accessToken) {
			authHeader = `Bearer ${session.accessToken}`;
		}
	} catch {
		// Running outside of a request context (e.g. build time) – fall back to service token
	}

	const res = await fetch(`${baseUrl}${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			Authorization: authHeader,
			...options.headers,
		},
		// Disable Next.js caching for API calls by default
		cache: options.cache ?? "no-store",
	});

	return handleResponse<T>(res);
}

/**
 * Client-side API client that routes through the Next.js /api proxy.
 * Use this in Client Components with SWR or direct fetches.
 */
async function clientFetch<T>(
	path: string,
	options: RequestInit = {},
): Promise<T> {
	const res = await fetch(`/api${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...options.headers,
		},
	});

	return handleResponse<T>(res);
}

export const apiClient = {
	get<T>(path: string): Promise<T> {
		return clientFetch<T>(path, { method: "GET" });
	},

	post<T>(path: string, body: unknown): Promise<T> {
		return clientFetch<T>(path, {
			method: "POST",
			body: JSON.stringify(body),
		});
	},

	patch<T>(path: string, body: unknown): Promise<T> {
		return clientFetch<T>(path, {
			method: "PATCH",
			body: JSON.stringify(body),
		});
	},

	delete<T>(path: string): Promise<T> {
		return clientFetch<T>(path, { method: "DELETE" });
	},
};
