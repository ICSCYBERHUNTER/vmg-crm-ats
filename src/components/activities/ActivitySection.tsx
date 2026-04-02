'use client'

import { useState } from 'react'
import { ActivityForm } from './ActivityForm'
import { ActivityList } from './ActivityList'
import type { ActivityEntityType } from '@/types/database'

interface ActivitySectionProps {
  entityType: ActivityEntityType
  entityId: string
}

export function ActivitySection({ entityType, entityId }: ActivitySectionProps) {
  const [refreshKey, setRefreshKey] = useState(0)

  function handleActivityAdded() {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="space-y-6">
      <ActivityForm
        entityType={entityType}
        entityId={entityId}
        onActivityAdded={handleActivityAdded}
      />

      <ActivityList
        entityType={entityType}
        entityId={entityId}
        refreshKey={refreshKey}
      />
    </div>
  )
}
