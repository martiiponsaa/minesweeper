// app/stats/page.tsx
import React, { Suspense } from 'react'
import HistoryPageContent from './HistoryPageContent'

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading history...</div>}>
      <HistoryPageContent />
    </Suspense>
  )
}