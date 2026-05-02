'use client'

import { useAppClerk, useAppUser } from "@/lib/auth"
import { isLocalDevMockMode } from "@/lib/devMode"

export function BrutalHeader() {
  const { user } = useAppUser()
  const { signOut } = useAppClerk()

  return (
    <nav className="border-b-4 border-black px-4 sm:px-6 py-4 flex items-center justify-between bg-[#FFEE00] sticky top-0 z-40">
      <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight">
        MONEY<span className="text-[#FF3366]">.</span>TRACKER
      </h1>

      <div className="flex items-center gap-3">
        {user && (
          <>
            <span className="hidden sm:inline text-xs font-mono font-bold bg-black text-[#FFEE00] px-2 py-1">
              {user.primaryEmailAddress?.emailAddress || user.firstName || "USER"}
            </span>
            {isLocalDevMockMode ? (
              <span className="text-xs font-black uppercase border-2 border-black px-3 py-1.5 bg-white">
                LOCAL DEV
              </span>
            ) : (
              <button
                onClick={() => signOut()}
                className="text-xs font-black uppercase border-2 border-black px-3 py-1.5 hover:bg-[#FF3366] hover:text-white hover:border-[#FF3366] transition-colors"
              >
                LOGOUT
              </button>
            )}
          </>
        )}
      </div>
    </nav>
  )
}
