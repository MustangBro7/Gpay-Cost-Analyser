"use client"

import * as React from "react"
import { useAuth } from "@clerk/nextjs"

export function useAuthedFetch() {
  const { getToken } = useAuth()

  return React.useCallback(async (url: string, init: RequestInit = {}) => {
    const token = await getToken()
    const headers = new Headers(init.headers || {})
    if (token) {
      headers.set("Authorization", `Bearer ${token}`)
    }
    return fetch(url, { ...init, headers })
  }, [getToken])
}
