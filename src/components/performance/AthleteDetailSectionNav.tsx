"use client";

import { useEffect, useState } from "react";

const SECTIONS = [
  { id: "sporcu-ozet", label: "Özet" },
  { id: "performans-analitigi", label: "Performans" },
  { id: "alan-testleri", label: "Testler" },
  { id: "son-wellness", label: "Wellness" },
  { id: "sakatlik-gecmisi", label: "Sağlık" },
] as const;

export function AthleteDetailSectionNav({ className = "" }: { className?: string }) {
  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) {
          setActiveId(visible.target.id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.2, 0.5] }
    );

    for (const section of SECTIONS) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <nav
      aria-label="Sporcu profili bölümleri"
      className={`sticky top-14 z-10 -mx-1 flex gap-1 overflow-x-auto bg-[#0a0a0b]/95 px-1 py-2 backdrop-blur-md lg:top-0 ${className}`}
    >
      {SECTIONS.map((section) => {
        const active = activeId === section.id;
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-wide ${
              active
                ? "border-[#7c3aed]/40 bg-[#7c3aed]/10 text-[#c4b5fd]"
                : "border-white/10 bg-white/[0.03] text-gray-400 hover:text-white"
            }`}
          >
            {section.label}
          </a>
        );
      })}
    </nav>
  );
}
