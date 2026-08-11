"use client";

import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

type AthleteCardProps = {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "aside";
  padding?: "sm" | "md";
};

const paddingClass = {
  sm: "!p-4 sm:!p-5",
  md: "!p-5 sm:!p-6",
};

export function AthleteCard({
  children,
  className = "",
  as: Tag = "div",
  padding = "md",
}: AthleteCardProps) {
  return (
    <Tag
      className={`min-w-0 rounded-2xl ${uiBrandingClasses.card.base} ${paddingClass[padding]} ${className}`}
    >
      {children}
    </Tag>
  );
}
