// src/app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] w-full min-w-0 flex-col items-center justify-center overflow-x-hidden bg-black">
      {children}
    </div>
  );
}