'use client'

import { useState, useEffect, useCallback } from 'react'

export interface TokenStatus {
  user_id: string
  authenticated: boolean
  auth_timestamp: string | null
  expires_at: string | null
  hours_remaining: number
  needs_reauth: boolean
  message: string
}

interface UseTokenStatusOptions {
  pollInterval?: number // in milliseconds, default 30 seconds
}

export function useTokenStatus(options: UseTokenStatusOptions = {}) {
  const { pollInterval = 30000 } = options
  const [tokenStatuses, setTokenStatuses] = useState<TokenStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  const fetchTokenStatus = useCallback(async () => {
    if (!apiUrl) {
      setError('API URL not configured')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch(`${apiUrl}/token-status`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setTokenStatuses(Array.isArray(data) ? data : [data])
      setError(null)
    } catch (err) {
      console.error('Failed to fetch token status:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [apiUrl])

  // Initial fetch
  useEffect(() => {
    fetchTokenStatus()
  }, [fetchTokenStatus])

  // Set up polling
  useEffect(() => {
    const interval = setInterval(fetchTokenStatus, pollInterval)
    return () => clearInterval(interval)
  }, [fetchTokenStatus, pollInterval])

  // Derived state: check if any user needs re-authentication
  const needsReauth = tokenStatuses.some(status => status.needs_reauth)
  
  // Get the user with the most urgent re-auth need
  const urgentUser = tokenStatuses
    .filter(s => s.needs_reauth)
    .sort((a, b) => a.hours_remaining - b.hours_remaining)[0] || null

  return {
    tokenStatuses,
    isLoading,
    error,
    needsReauth,
    urgentUser,
    refetch: fetchTokenStatus,
  }
}
