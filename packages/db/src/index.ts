import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma
}

export { Prisma } from '@prisma/client'
export type {
  Monitor,
  Checkin,
  Alert,
  Team,
  User,
  TeamMember,
  Integration,
  AlertRule,
} from '@prisma/client'

export { buildCursorPagination, formatPaginatedResult } from './helpers/paginate.js'
export { softDelete, withoutDeleted, isDeleted } from './helpers/soft-delete.js'
