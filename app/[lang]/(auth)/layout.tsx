export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold tracking-wide">
            <span className="text-pa-green">PACK</span>
            <span className="text-text-primary">ATTACK</span>
            <span className="text-pa-green">.GG</span>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
