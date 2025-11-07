export default function InstructorDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Instructor Dashboard</h1>
        <p className="text-muted-foreground">
          Manage students and lesson schedules
        </p>
      </div>

      {/* Dashboard content to be implemented */}
      <div className="grid gap-4">
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Today&apos;s Schedule</h2>
          <p className="text-sm text-muted-foreground">
            Schedule view to be implemented with tRPC
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Student List</h2>
          <p className="text-sm text-muted-foreground">
            Student management to be implemented with tRPC
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Weather Conditions</h2>
          <p className="text-sm text-muted-foreground">
            Current conditions to be implemented with SSE
          </p>
        </div>
      </div>
    </div>
  );
}
