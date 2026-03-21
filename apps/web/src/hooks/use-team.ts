'use client'

import type { Team, TeamMember } from '@cronpilot/shared'
import useSWR from 'swr'
import { apiClient } from '@/lib/api'

interface TeamWithMembers {
  team: Team
  members: TeamMember[]
}

function fetcher<T>(path: string): Promise<T> {
  return apiClient.get<T>(path)
}

export function useTeam(): {
  team: Team | undefined
  members: TeamMember[]
  isLoading: boolean
} {
  const { data, isLoading } = useSWR<TeamWithMembers>('/teams/me', fetcher, {
    refreshInterval: 60_000,
  })

  return {
    team: data?.team,
    members: data?.members ?? [],
    isLoading,
  }
}
