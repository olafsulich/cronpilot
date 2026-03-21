export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message)
    this.name = 'AppError'
    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }
}

export const ERROR_CODES = {
  MONITOR_NOT_FOUND: 'MONITOR_NOT_FOUND',
  TEAM_NOT_FOUND: 'TEAM_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  INTEGRATION_NOT_FOUND: 'INTEGRATION_NOT_FOUND',
  ALERT_NOT_FOUND: 'ALERT_NOT_FOUND',
  PLAN_LIMIT_REACHED: 'PLAN_LIMIT_REACHED',
  INVALID_CRON: 'INVALID_CRON',
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ALERT_RULE_NOT_FOUND: 'ALERT_RULE_NOT_FOUND',
  CHECKIN_NOT_FOUND: 'CHECKIN_NOT_FOUND',
  MEMBER_NOT_FOUND: 'MEMBER_NOT_FOUND',
  INVITE_EXPIRED: 'INVITE_EXPIRED',
  ALREADY_MEMBER: 'ALREADY_MEMBER',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError
}

export function toAppError(err: unknown): AppError {
  if (isAppError(err)) return err
  if (err instanceof Error) {
    return new AppError(ERROR_CODES.INTERNAL_ERROR, err.message, 500)
  }
  return new AppError(ERROR_CODES.INTERNAL_ERROR, 'An unexpected error occurred', 500)
}
