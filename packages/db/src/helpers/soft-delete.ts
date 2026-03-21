import type { PrismaClient } from '@prisma/client'

/**
 * Soft-delete pattern for Cronpilot.
 *
 * Models that opt into soft deletion must add a `deletedAt DateTime?` field
 * to their Prisma schema. This module provides helpers that make it easy to
 * apply soft deletes and filter them out of queries.
 *
 * Example schema addition:
 *   model SomeModel {
 *     id        String    @id @default(cuid())
 *     // ... other fields ...
 *     deletedAt DateTime?
 *     @@index([deletedAt])
 *   }
 *
 * Example usage:
 *   // Instead of prisma.someModel.delete({ where: { id } })
 *   await softDelete(prisma, 'someModel', id)
 *
 *   // Filter deleted records out of a query
 *   const items = await prisma.someModel.findMany({
 *     where: { ...withoutDeleted(), teamId },
 *   })
 */

/**
 * Returns a Prisma `where` fragment that excludes soft-deleted records.
 * Merge this into any `where` clause on a soft-delete-enabled model.
 *
 * @example
 *   await prisma.someModel.findMany({ where: { ...withoutDeleted(), teamId } })
 */
export function withoutDeleted(): { deletedAt: null } {
  return { deletedAt: null }
}

/**
 * Returns true if the given record has been soft-deleted.
 */
export function isDeleted(record: { deletedAt: Date | null }): boolean {
  return record.deletedAt !== null
}

/**
 * Performs a soft delete by setting `deletedAt` to the current timestamp.
 *
 * @param prisma  The Prisma client instance
 * @param model   The Prisma model delegate name (e.g. 'someModel')
 * @param id      The record's ID
 *
 * NOTE: TypeScript cannot statically verify that `model` has a `deletedAt`
 * field because Prisma generates per-model types. Callers are responsible for
 * only invoking this on models that declare `deletedAt DateTime?`.
 */
export async function softDelete(
  prisma: PrismaClient,
  model: string,
  id: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (prisma as any)[model]
  if (typeof delegate?.update !== 'function') {
    throw new Error(`softDelete: unknown model "${model}"`)
  }
  await delegate.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
}

/**
 * Restores a soft-deleted record by clearing its `deletedAt` field.
 *
 * @param prisma  The Prisma client instance
 * @param model   The Prisma model delegate name
 * @param id      The record's ID
 */
export async function softRestore(
  prisma: PrismaClient,
  model: string,
  id: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (prisma as any)[model]
  if (typeof delegate?.update !== 'function') {
    throw new Error(`softRestore: unknown model "${model}"`)
  }
  await delegate.update({
    where: { id },
    data: { deletedAt: null },
  })
}
