'use client'

import * as React from "react"
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  useAuth,
  useSignIn,
  useUser,
} from "@clerk/nextjs"
import { isLocalDevMockMode, localDevUserEmail, localDevUserId } from "@/lib/devMode"

type AppAuthState = ReturnType<typeof useAuth>
type AppUserState = ReturnType<typeof useUser>
type AppSignInState = ReturnType<typeof useSignIn>

const AuthContext = React.createContext<AppAuthState | null>(null)
const UserContext = React.createContext<AppUserState | null>(null)
const SignInContext = React.createContext<AppSignInState | null>(null)

const mockUser = {
  id: localDevUserId,
  firstName: "Local",
  primaryEmailAddress: {
    emailAddress: localDevUserEmail,
  },
  externalAccounts: [],
} as unknown as AppUserState["user"]

const mockAuthState = {
  isLoaded: true,
  isSignedIn: true,
  getToken: async () => null,
} as AppAuthState

const mockUserState = {
  isLoaded: true,
  isSignedIn: true,
  user: mockUser,
} as AppUserState

const mockSignInState = {
  isLoaded: false,
  signIn: undefined,
  setActive: undefined,
} as unknown as AppSignInState

function useRequiredContext<T>(context: React.Context<T | null>, name: string): T {
  const value = React.useContext(context)
  if (!value) {
    throw new Error(`${name} must be used within AuthProvider.`)
  }
  return value
}

function ClerkStateBridge({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  const user = useUser()
  const signIn = useSignIn()

  return (
    <AuthContext.Provider value={auth}>
      <UserContext.Provider value={user}>
        <SignInContext.Provider value={signIn}>{children}</SignInContext.Provider>
      </UserContext.Provider>
    </AuthContext.Provider>
  )
}

function LocalDevAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={mockAuthState}>
      <UserContext.Provider value={mockUserState}>
        <SignInContext.Provider value={mockSignInState}>{children}</SignInContext.Provider>
      </UserContext.Provider>
    </AuthContext.Provider>
  )
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (isLocalDevMockMode) {
    return <LocalDevAuthProvider>{children}</LocalDevAuthProvider>
  }

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  if (!publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY. Set it in your deployment environment before building."
    )
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkStateBridge>{children}</ClerkStateBridge>
    </ClerkProvider>
  )
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
  return useRequiredContext(AuthContext, "useAppAuth")
}

export function useAppUser() {
  return useRequiredContext(UserContext, "useAppUser")
}

export function useAppSignIn() {
  return useRequiredContext(SignInContext, "useAppSignIn")
}
