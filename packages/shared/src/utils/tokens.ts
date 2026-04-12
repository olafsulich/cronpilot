import crypto from "node:crypto";

/**
 * Generates a cryptographically secure 32-byte (64 hex char) ping token.
 * Used as the secret identifier embedded in check-in URLs.
 * IMPORTANT: Never log these tokens.
 */
export function generatePingToken(): string {
	return crypto.randomBytes(32).toString("hex");
}

/**
 * Generates a cryptographically secure 32-byte (64 hex char) invite token.
 * Sent to users via email as a one-time team invitation link.
 * IMPORTANT: Never log these tokens.
 */
export function generateInviteToken(): string {
	return crypto.randomBytes(32).toString("hex");
}

/**
 * Returns the SHA-256 hex digest of a token.
 * Store this hash in the database instead of the raw token
 * so that a DB breach does not expose valid tokens.
 */
export function hashToken(token: string): string {
	return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Constant-time comparison of two strings to prevent timing attacks.
 * Use when comparing tokens or hashes.
 */
export function safeCompare(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	const aBuf = Buffer.from(a);
	const bBuf = Buffer.from(b);
	return crypto.timingSafeEqual(aBuf, bBuf);
}
