"use client";

import { useEffect, useState } from "react";
import { UiTabsNav } from "@/components/ui/navigation/UiTabsNav";

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
    <UiTabsNav
      ariaLabel="Sporcu profili bölümleri"
      sticky
      size="sm"
      className={className}
      tabs={SECTIONS.map((section) => ({
        key: section.id,
        label: section.label,
        href: `#${section.id}`,
        active: activeId === section.id,
      }))}
    />
  );
}
