'use client';
// app/stats/page.tsx
import React, { Suspense } from 'react'
import StatsPageContent from './StatsPageContent'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export default function StatsPage() {
  const searchParams = useSearchParams()
  const friendUserId = searchParams.get('friendUserId')
  const { user } = useAuth()

  return (
    <Suspense fallback={<div className="p-4">Loading stats...</div>}>
      <StatsPageContent />
    </Suspense>
  )
}