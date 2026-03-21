import { z } from 'zod'

export type ApiResponse<T> = { data: T }
export type ApiError = { error: { code: string; message: string } }
export type PaginatedResponse<T> = {
  data: T[]
  nextCursor: string | null
  total: number
}

export const PaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export type PaginationParams = z.infer<typeof PaginationSchema>

export const MonitorCreateSchema = z.object({
  name: z.string().min(1).max(255),
  schedule: z.string().min(1),
  timezone: z.string().default('UTC'),
  gracePeriod: z.number().int().min(0).max(86400).default(300),
})

export type MonitorCreateParams = z.infer<typeof MonitorCreateSchema>

export const MonitorUpdateSchema = MonitorCreateSchema.partial().extend({
  status: z.enum(['active', 'paused']).optional(),
})

export type MonitorUpdateParams = z.infer<typeof MonitorUpdateSchema>

export const AlertRuleCreateSchema = z.object({
  integrationId: z.string().cuid(),
  notifyAfter: z.number().int().min(1).max(100).default(1),
})

export type AlertRuleCreateParams = z.infer<typeof AlertRuleCreateSchema>

export const IntegrationCreateSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('slack'),
    name: z.string().min(1).max(255),
    webhookUrl: z.string().url(),
    channel: z.string().min(1),
  }),
  z.object({
    type: z.literal('pagerduty'),
    name: z.string().min(1).max(255),
    integrationKey: z.string().min(1),
  }),
  z.object({
    type: z.literal('webhook'),
    name: z.string().min(1).max(255),
    url: z.string().url(),
    secret: z.string().min(1),
  }),
  z.object({
    type: z.literal('email'),
    name: z.string().min(1).max(255),
    address: z.string().email(),
  }),
])

export type IntegrationCreateParams = z.infer<typeof IntegrationCreateSchema>

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export type LoginParams = z.infer<typeof LoginSchema>

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  teamName: z.string().min(1).max(255),
})

export type RegisterParams = z.infer<typeof RegisterSchema>

export const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
})

export type InviteMemberParams = z.infer<typeof InviteMemberSchema>
