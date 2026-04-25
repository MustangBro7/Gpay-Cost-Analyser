'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthedFetch } from '@/lib/useAuthedFetch'

export interface TokenStatus {
  user_id: string
  authenticated: boolean
  auth_timestamp: string | null
  expires_at: string | null
  hours_remaining: number
  needs_reauth: boolean
  message: string
  google_email?: string | null
  auth_status?: 'disconnected' | 'active' | 'reauth_required' | 'error'
  watch_expires_at?: string | null
  last_sync_at?: string | null
  reauth_reason?: string | null
}

interface UseTokenStatusOptions {
  pollInterval?: number // in milliseconds, default 30 seconds
}

export function useTokenStatus(options: UseTokenStatusOptions = {}) {
  const { pollInterval = 30000 } = options
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isMountedRef = useRef(true)
  const inFlightRef = useRef(false)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  const authedFetch = useAuthedFetch()

  const fetchTokenStatus = useCallback(async () => {
    if (!apiUrl) {
      setError('API URL not configured')
      setIsLoading(false)
      return
    }

    if (inFlightRef.current) {
      return
    }

    try {
      inFlightRef.current = true
      const response = await authedFetch(`${apiUrl}/token-status`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      if (!isMountedRef.current) {
        return
      }
      setTokenStatus(data)
      setError(null)
    } catch (err) {
      if (!isMountedRef.current) {
        return
      }
      console.error('Failed to fetch token status:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      inFlightRef.current = false
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [apiUrl, authedFetch])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchTokenStatus()
  }, [fetchTokenStatus])

  // Set up polling
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return
      }
      fetchTokenStatus()
    }, pollInterval)
    return () => clearInterval(interval)
  }, [fetchTokenStatus, pollInterval])

  // Derived state: check if any user needs re-authentication
  const needsReauth = Boolean(tokenStatus?.needs_reauth)
  const urgentUser = tokenStatus

  return {
    tokenStatus,
    isLoading,
    error,
    needsReauth,
    urgentUser,
    refetch: fetchTokenStatus,
  }
}
