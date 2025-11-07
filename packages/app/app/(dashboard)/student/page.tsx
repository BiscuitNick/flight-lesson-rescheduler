export default function StudentDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Student Dashboard</h1>
        <p className="text-muted-foreground">
          View and manage your flight lessons
        </p>
      </div>

      {/* Dashboard content to be implemented */}
      <div className="grid gap-4">
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Upcoming Lessons</h2>
          <p className="text-sm text-muted-foreground">
            Lesson list to be implemented with tRPC
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Weather Alerts</h2>
          <p className="text-sm text-muted-foreground">
            Weather notifications to be implemented with SSE
          </p>
        </div>
      </div>
    </div>
  );
}
