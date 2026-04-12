/**
 * Cursor-based pagination helper for Prisma queries.
 *
 * Usage:
 *   const args = buildCursorPagination(cursor, limit)
 *   const rows = await prisma.monitor.findMany({ where: { teamId }, ...args, orderBy: { createdAt: 'desc' } })
 *   return formatPaginatedResult(rows, limit)
 */

export interface CursorPaginationArgs {
	take: number;
	cursor?: { id: string };
	skip?: number;
}

/**
 * Builds Prisma findMany args for cursor-based pagination.
 * Fetches limit+1 records so we can detect whether there is a next page.
 */
export function buildCursorPagination(
	cursor?: string,
	limit = 20,
): CursorPaginationArgs {
	return {
		take: limit + 1,
		...(cursor !== undefined && cursor !== ""
			? { cursor: { id: cursor }, skip: 1 }
			: {}),
	};
}

export interface PaginatedResult<T> {
	data: T[];
	nextCursor: string | null;
	total?: number;
}

/**
 * Slices the over-fetched result set and derives the next cursor.
 *
 * @param items  The raw array returned by Prisma (may be limit+1 long)
 * @param limit  The requested page size
 */
export function formatPaginatedResult<T extends { id: string }>(
	items: T[],
	limit: number,
): PaginatedResult<T> {
	const hasMore = items.length > limit;
	const data = hasMore ? items.slice(0, limit) : items;

	const lastItem = data[data.length - 1];
	const nextCursor = hasMore && lastItem !== undefined ? lastItem.id : null;

	return { data, nextCursor };
}
