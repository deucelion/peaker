"use client";

import { notFound } from "next/navigation";
import { useParams } from "next/navigation";
import { FieldTestSessionEntry } from "../../_components/FieldTestSessionEntry";
import { isFieldTestSessionDate } from "@/lib/fieldTests/fieldTestSessionRoutes";

export default function FieldTestSessionPage() {
  const params = useParams();
  const raw = typeof params.date === "string" ? params.date : "";

  if (!isFieldTestSessionDate(raw)) {
    notFound();
  }

  return <FieldTestSessionEntry sessionDate={raw} />;
}
