import Link from 'next/link';
import { Plane, Cloud, Calendar, Users } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Plane className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Flight Lesson Rescheduler
            </h1>
          </div>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-16">
        <div className="text-center">
          <h2 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
            Weather-Aware Flight
            <br />
            Lesson Scheduling
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600 dark:text-gray-400">
            AI-powered flight lesson rescheduling based on real-time weather
            conditions. Keep your students safe and your schedule optimized.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-md bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-gray-300 px-6 py-3 text-base font-semibold text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
            >
              View Demo
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-24 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <Cloud className="h-8 w-8 text-blue-600" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
              Real-Time Weather Monitoring
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Hourly weather checks for upcoming flights with automated alerts
              when conditions don&apos;t meet minimums.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <Calendar className="h-8 w-8 text-blue-600" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
              AI-Powered Rescheduling
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              GPT-4 analyzes schedules and suggests optimal reschedule times
              based on weather forecasts.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <Users className="h-8 w-8 text-blue-600" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
              Multi-Role Dashboards
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Separate interfaces for students, instructors, and administrators
              with role-based permissions.
            </p>
          </div>
        </div>

        {/* Quick Access (Development) */}
        <div className="mt-16 rounded-lg border border-gray-300 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Quick Access (Development)
          </h3>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/student"
              className="rounded-md bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800"
            >
              Student Dashboard
            </Link>
            <Link
              href="/instructor"
              className="rounded-md bg-green-100 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800"
            >
              Instructor Dashboard
            </Link>
            <Link
              href="/admin"
              className="rounded-md bg-purple-100 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-300 dark:hover:bg-purple-800"
            >
              Admin Dashboard
            </Link>
            <Link
              href="/student/reschedules"
              className="rounded-md bg-orange-100 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-300 dark:hover:bg-orange-800"
            >
              Reschedules
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 py-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Built with Next.js 16, tRPC, Prisma, and AWS
        </div>
      </footer>
    </div>
  );
}
