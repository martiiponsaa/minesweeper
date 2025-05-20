// app/stats/page.tsx
import React, { Suspense } from 'react'
import StatsPageContent from './StatsPageContent'

export default function StatsPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading stats...</div>}>
      <StatsPageContent />
    </Suspense>
  )
}