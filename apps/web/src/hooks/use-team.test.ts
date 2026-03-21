import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Team, TeamMember } from '@cronpilot/shared'

// Mock SWR before importing the hook
vi.mock('swr')
vi.mock('@/lib/api', () => ({
  apiClient: { get: vi.fn() },
}))

import useSWR from 'swr'
import { useTeam } from './use-team'

const mockUseSWR = vi.mocked(useSWR)

const mockTeam: Team = {
  id: 'team-1',
  name: 'Acme Corp',
  slug: 'acme-corp',
  plan: 'pro',
  trialEndsAt: null,
  createdAt: new Date('2024-01-01'),
}

const mockMembers: TeamMember[] = [
  {
    userId: 'user-1',
    teamId: 'team-1',
    role: 'owner',
    user: {
      id: 'user-1',
      email: 'alice@acme.com',
      createdAt: new Date('2024-01-01'),
    },
  },
  {
    userId: 'user-2',
    teamId: 'team-1',
    role: 'member',
    user: {
      id: 'user-2',
      email: 'bob@acme.com',
      createdAt: new Date('2024-02-01'),
    },
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useTeam', () => {
  it('returns loading state with no data while fetching', () => {
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: true } as ReturnType<typeof useSWR>)

    const { result } = renderHook(() => useTeam())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.team).toBeUndefined()
    expect(result.current.members).toEqual([])
  })

  it('returns team and members when data is available', () => {
    mockUseSWR.mockReturnValue({
      data: { team: mockTeam, members: mockMembers },
      isLoading: false,
    } as ReturnType<typeof useSWR>)

    const { result } = renderHook(() => useTeam())

    expect(result.current.isLoading).toBe(false)
    expect(result.current.team).toEqual(mockTeam)
    expect(result.current.members).toEqual(mockMembers)
  })

  it('returns empty members array when members are not present in data', () => {
    mockUseSWR.mockReturnValue({
      data: { team: mockTeam, members: [] },
      isLoading: false,
    } as ReturnType<typeof useSWR>)

    const { result } = renderHook(() => useTeam())

    expect(result.current.members).toEqual([])
  })

  it('calls useSWR with the correct path and refreshInterval', () => {
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: true } as ReturnType<typeof useSWR>)

    renderHook(() => useTeam())

    expect(mockUseSWR).toHaveBeenCalledWith('/teams/me', expect.any(Function), {
      refreshInterval: 60_000,
    })
  })

  it('passes apiClient.get as the fetcher', async () => {
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: false } as ReturnType<typeof useSWR>)

    renderHook(() => useTeam())

    const [, fetcher] = mockUseSWR.mock.calls[0]!
    const { apiClient } = await import('@/lib/api')
    vi.mocked(apiClient.get).mockResolvedValue({ team: mockTeam, members: mockMembers })

    await (fetcher as (path: string) => Promise<unknown>)('/teams/me')

    expect(apiClient.get).toHaveBeenCalledWith('/teams/me')
  })
})
