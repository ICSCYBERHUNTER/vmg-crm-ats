'use client'

import { useState } from 'react'
import { KanbanBoard } from './KanbanBoard'
import { JobCandidatesList } from './JobCandidatesList'

interface JobPipelineSectionProps {
  jobOpeningId: string
}

export function JobPipelineSection({ jobOpeningId }: JobPipelineSectionProps) {
  const [kanbanRefreshKey, setKanbanRefreshKey] = useState(0)
  const [listRefreshKey, setListRefreshKey] = useState(0)

  return (
    <>
      <KanbanBoard
        jobOpeningId={jobOpeningId}
        refreshKey={kanbanRefreshKey}
        onStageChange={() => setListRefreshKey(prev => prev + 1)}
      />
      <JobCandidatesList
        jobOpeningId={jobOpeningId}
        refreshKey={listRefreshKey}
        onApplicationChange={() => setKanbanRefreshKey(prev => prev + 1)}
      />
    </>
  )
}
