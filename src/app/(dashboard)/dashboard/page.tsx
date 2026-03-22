import { QuickStats } from '@/components/dashboard/QuickStats'
import { ProspectPipeline } from '@/components/dashboard/ProspectPipeline'
import { ActiveJobOpenings } from '@/components/dashboard/ActiveJobOpenings'
import { OverdueNextSteps } from '@/components/dashboard/OverdueNextSteps'
import { PipelineSnapshot } from '@/components/dashboard/PipelineSnapshot'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back. Here&apos;s what&apos;s happening.
        </p>
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
        <div>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Overdue Next Steps
          </h2>
          <OverdueNextSteps />
        </div>
      </div>

      {/* Row 4: Pipeline Snapshot */}
      <div>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Pipeline Snapshot (All Jobs)
        </h2>
        <PipelineSnapshot />
      </div>
    </div>
  )
}
