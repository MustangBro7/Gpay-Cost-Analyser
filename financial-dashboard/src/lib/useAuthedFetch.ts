"use client"

import * as React from "react"
import { useAuth } from "@clerk/nextjs"

export class AuthTokenUnavailableError extends Error {
  code = "AUTH_TOKEN_UNAVAILABLE"

  constructor(message = "Clerk auth token is not available yet.") {
    super(message)
    this.name = "AuthTokenUnavailableError"
  }
}

export function isAuthTokenUnavailableError(error: unknown): error is AuthTokenUnavailableError {
  return error instanceof AuthTokenUnavailableError
}

export function useAuthedFetch() {
  const { getToken, isLoaded, isSignedIn } = useAuth()

  return React.useCallback(async (url: string, init: RequestInit = {}) => {
    if (!isLoaded) {
      throw new AuthTokenUnavailableError("Clerk is still loading.")
    }

    if (!isSignedIn) {
      throw new AuthTokenUnavailableError("User is not signed in.")
    }

    const token = await getToken()
    if (!token) {
      throw new AuthTokenUnavailableError()
    }

    const headers = new Headers(init.headers || {})
    headers.set("Authorization", `Bearer ${token}`)
    return fetch(url, { ...init, headers })
  }, [getToken, isLoaded, isSignedIn])
}
