import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../lib/prisma'
import { AppError } from '@cronpilot/shared'

export interface AuthUser {
  id: string
  email: string
}

export interface AuthTeam {
  id: string
  name: string
  slug: string
  plan: string
}

// Augment FastifyRequest to carry auth context
declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser
    team: AuthTeam
  }
}

export interface JwtPayload {
  userId: string
  teamId: string
  iat?: number
  exp?: number
}

export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  let payload: JwtPayload
  try {
    payload = await request.jwtVerify<JwtPayload>()
  } catch {
    throw new AppError('UNAUTHORIZED', 'Invalid or missing access token', 401)
  }

  const { userId, teamId } = payload

  // Load user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  })
  if (!user) {
    throw new AppError('UNAUTHORIZED', 'User not found', 401)
  }

  // Verify the user is a member of the requested team
  const membership = await prisma.teamMember.findUnique({
    where: {
      userId_teamId: { userId, teamId },
    },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
        },
      },
    },
  })
  if (!membership) {
    throw new AppError('FORBIDDEN', 'You are not a member of this team', 403)
  }

  request.user = { id: user.id, email: user.email }
  request.team = {
    id: membership.team.id,
    name: membership.team.name,
    slug: membership.team.slug,
    plan: membership.team.plan,
  }
}
