// app/profile/page.tsx
import React, { Suspense } from 'react'
import ProfilePageContent from './ProfilePageContent'

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="p-4">Loading profile...</div>}>
      <ProfilePageContent />
    </Suspense>
  )
}