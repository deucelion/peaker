"use client";

type NotificationVariant = "success" | "error" | "info";

interface NotificationProps {
  message: string;
  variant?: NotificationVariant;
  className?: string;
}

const variantClassMap: Record<NotificationVariant, string> = {
  success: "bg-green-500/10 border-green-500/20 text-green-300",
  error: "bg-red-500/10 border-red-500/20 text-red-300",
  info: "bg-white/5 border-white/10 text-gray-300",
};

export default function Notification({ message, variant = "info", className = "" }: NotificationProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`min-w-0 max-w-full break-words px-5 py-3 rounded-2xl border text-[10px] font-black uppercase italic tracking-widest ${variantClassMap[variant]} ${className}`}
    >
      {message}
    </div>
  );
}
