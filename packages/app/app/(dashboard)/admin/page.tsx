export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage school settings and system configuration
        </p>
      </div>

      {/* Dashboard content to be implemented */}
      <div className="grid gap-4">
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">System Status</h2>
          <p className="text-sm text-muted-foreground">
            Monitoring dashboard to be implemented with tRPC
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">User Management</h2>
          <p className="text-sm text-muted-foreground">
            User admin panel to be implemented with tRPC
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Weather Minimums Config</h2>
          <p className="text-sm text-muted-foreground">
            Configuration UI to be implemented with tRPC
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Notification Settings</h2>
          <p className="text-sm text-muted-foreground">
            Notification config to be implemented with tRPC
          </p>
        </div>
      </div>
    </div>
  );
}
