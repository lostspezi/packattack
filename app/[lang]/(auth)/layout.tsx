export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <img
            src="/images/logo.svg"
            alt="PackAttack.gg"
            className="h-7 w-auto"
          />
        </div>
        {children}
      </div>
    </div>
  );
}
