export default function PagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[1600px] mx-auto w-full px-4 md:px-6 py-6 md:py-8 flex-1">
      {children}
    </div>
  );
}
