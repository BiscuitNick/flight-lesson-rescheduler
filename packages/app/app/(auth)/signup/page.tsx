export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6 px-4">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Create Account</h1>
          <p className="text-muted-foreground">
            Sign up for a new flight school account
          </p>
        </div>

        {/* Signup form will be implemented with Amplify Auth */}
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Registration form to be implemented with AWS Amplify
          </p>
        </div>
      </div>
    </div>
  );
}
