import { QuickStats } from '@/components/dashboard/QuickStats'
import { ProspectPipeline } from '@/components/dashboard/ProspectPipeline'
import { ActiveJobOpenings } from '@/components/dashboard/ActiveJobOpenings'
import { TasksWidget } from '@/components/dashboard/TasksWidget'
import { GoogleTasksWidget } from '@/components/dashboard/GoogleTasksWidget'
import { KeyRelationshipsWidget } from '@/components/dashboard/KeyRelationshipsWidget'
import { RotatingQuote } from '@/components/dashboard/RotatingQuote'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back. Here&apos;s what&apos;s happening.
          </p>
        </div>
        <RotatingQuote />
      </div>

      {/* Row 1: Quick Stats */}
      <QuickStats />

      {/* Row 2: Prospect Pipeline */}
      <div>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Prospect Pipeline
        </h2>
        <ProspectPipeline />
      </div>

      {/* Row 3: Two-column split */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Active Job Openings
          </h2>
          <ActiveJobOpenings />
        </div>
        <div className="space-y-4">
          <div>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Tasks
            </h2>
            <TasksWidget />
          </div>
          <GoogleTasksWidget />
        </div>
      </div>

      {/* Row 4: Key Relationships */}
      <div>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Key Relationships
        </h2>
        <KeyRelationshipsWidget />
      </div>

    </div>
  )
}
