'use client'

import * as React from "react"
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  useAuth,
  useClerk,
  useSignIn,
  useUser,
} from "@clerk/nextjs"
import { isLocalDevMockMode, localDevUserEmail, localDevUserId } from "@/lib/devMode"

const mockUser = {
  id: localDevUserId,
  firstName: "Local",
  primaryEmailAddress: {
    emailAddress: localDevUserEmail,
  },
  externalAccounts: [],
}

const mockAuthState = {
  isLoaded: true,
  isSignedIn: true,
  getToken: async () => null,
}

const mockUserState = {
  isLoaded: true,
  user: mockUser as unknown as ReturnType<typeof useUser>["user"],
}

const mockClerkState = {
  signOut: async () => undefined,
}

const mockSignInState = {
  isLoaded: true,
  signIn: undefined as ReturnType<typeof useSignIn>["signIn"],
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (isLocalDevMockMode) {
    return <>{children}</>
  }

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  if (!publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY. Set it in your deployment environment before building."
    )
  }

  return <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider>
}

export function AppSignedIn({ children }: { children: React.ReactNode }) {
  if (isLocalDevMockMode) {
    return <>{children}</>
  }

  return <SignedIn>{children}</SignedIn>
}

export function AppSignedOut({ children }: { children: React.ReactNode }) {
  if (isLocalDevMockMode) {
    return null
  }

  return <SignedOut>{children}</SignedOut>
}

export function useAppAuth() {
  if (isLocalDevMockMode) {
    return mockAuthState
  }

  return useAuth()
}

export function useAppUser() {
  if (isLocalDevMockMode) {
    return mockUserState
  }

  return useUser()
}

export function useAppClerk() {
  if (isLocalDevMockMode) {
    return mockClerkState
  }

  return useClerk()
}

export function useAppSignIn() {
  if (isLocalDevMockMode) {
    return mockSignInState
  }

  return useSignIn()
}
