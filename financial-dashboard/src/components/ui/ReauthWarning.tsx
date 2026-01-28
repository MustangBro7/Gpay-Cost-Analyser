'use client'

import * as React from 'react'
import { AlertTriangle, LogIn, Clock } from 'lucide-react'
import { Button } from './button'
import { useTokenStatus, TokenStatus } from '@/hooks/useTokenStatus'

interface ReauthWarningProps {
  className?: string
}

function formatTimeRemaining(hours: number): string {
  if (hours <= 0) return 'Expired'
  if (hours < 1) {
    const minutes = Math.round(hours * 60)
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`
  }
  const wholeHours = Math.floor(hours)
  const minutes = Math.round((hours - wholeHours) * 60)
  if (minutes === 0) {
    return `${wholeHours} hour${wholeHours !== 1 ? 's' : ''}`
  }
  return `${wholeHours}h ${minutes}m`
}

export function ReauthWarning({ className }: ReauthWarningProps) {
  const { needsReauth, urgentUser, isLoading } = useTokenStatus({ pollInterval: 30000 })
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  // Don't render anything if no re-auth needed or still loading
  if (isLoading || !needsReauth || !urgentUser) {
    return null
  }

  const isExpired = urgentUser.hours_remaining <= 0
  const timeRemaining = formatTimeRemaining(urgentUser.hours_remaining)

  const handleReauth = () => {
    // Open login in the same window - it will redirect back after successful auth
    window.location.href = `${apiUrl}/login`
  }

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center ${className || ''}`}>
      {/* Backdrop - semi-transparent with blur */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Warning Card */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-in fade-in-0 zoom-in-95 duration-300">
        <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Header with warning stripe */}
          <div className={`px-6 py-4 ${isExpired ? 'bg-destructive/20' : 'bg-amber-500/20'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isExpired ? 'bg-destructive/30' : 'bg-amber-500/30'}`}>
                <AlertTriangle className={`w-6 h-6 ${isExpired ? 'text-destructive' : 'text-amber-500'}`} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {isExpired ? 'Session Expired' : 'Session Expiring Soon'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {urgentUser.user_id}
                </p>
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-muted-foreground">
              {isExpired 
                ? 'Your authentication has expired. Please log in again to continue monitoring your transactions.'
                : 'Your authentication will expire soon. Please re-authenticate to ensure uninterrupted transaction monitoring.'
              }
            </p>
            
            {/* Time remaining display */}
            {!isExpired && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Time remaining:</span>
                <span className={`text-sm font-semibold ${urgentUser.hours_remaining < 1 ? 'text-destructive' : 'text-amber-500'}`}>
                  {timeRemaining}
                </span>
              </div>
            )}
            
            {/* Warning note */}
            <p className="text-xs text-muted-foreground/80 italic">
              Note: Transaction monitoring is paused until you re-authenticate. You may miss new transactions.
            </p>
          </div>
          
          {/* Footer with action button */}
          <div className="px-6 py-4 bg-muted/30 border-t border-border">
            <Button 
              onClick={handleReauth}
              className="w-full gap-2"
              size="lg"
            >
              <LogIn className="w-4 h-4" />
              Re-authenticate Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
