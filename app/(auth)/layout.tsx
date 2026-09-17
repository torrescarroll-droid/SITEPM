export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-stone-100 px-4 py-10">
      {children}
    </div>
  );
}
