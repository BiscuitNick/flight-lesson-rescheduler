export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header/Navigation will be implemented later */}
      <header className="border-b">
        <div className="container flex h-16 items-center px-4">
          <h2 className="text-lg font-semibold">Flight Lesson Rescheduler</h2>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 container py-6 px-4">
        {children}
      </main>
    </div>
  );
}
