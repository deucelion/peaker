"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Calendar,
  Loader2,
  CheckCircle2,
  Download,
  ChevronLeft,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { FieldTestAthletePicker } from "./FieldTestAthletePicker";
import { FieldTestSessionSubNav } from "./FieldTestSessionSubNav";
import { FieldTestSingleAthleteEntry } from "./FieldTestSingleAthleteEntry";
import { listManagementDirectory } from "@/lib/actions/managementDirectoryActions";
import {
  exportFieldTestResultsCSV,
  listAthleticResultsForActorByDate,
  listAthleticResultNotesByDate,
  listFieldTestDefinitionsForActor,
  listPreviousFieldTestResultsForActor,
  saveAthleticFieldResults,
  type FieldTestPreviousResultRow,
} from "@/lib/actions/athleticFieldActions";
import type { AthleticResultRow, ProfileBasic, TestDefinitionRow } from "@/types/domain";
import Notification from "@/components/Notification";
import EmptyState from "@/components/ui/EmptyState";
import InlineErrorState from "@/components/ui/data-display/InlineErrorState";
import { buildFieldTestCells, fieldTestCellKey, metricValueKindFromRow } from "@/lib/fieldTests/buildFieldTestSavePayload";
import {
  buildFieldTestValuesMapFromResults,
  buildPreviousFieldTestCellsMap,
  type FieldTestPreviousCell,
} from "@/lib/fieldTests/hydrateFieldTestValuesFromResults";
import { useUnsavedChangesGuard } from "@/lib/hooks/useUnsavedChangesGuard";
import { isTextMetricValueType } from "@/lib/fieldTests/metricValueType";
import { fetchMeRoleClient } from "@/lib/auth/meRoleClient";
import { useMeAccessOrganizationFeatures } from "@/lib/auth/useMeAccess";
import { EXPORT_ENDPOINT_IDS } from "@/lib/organization/features/surfaces/exportEntitlementMap";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import { shouldRenderExportUi } from "@/lib/navigation/exportFeatureVisibility";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { buildOfflineScopeKey } from "@/lib/offline/scope";
import { fieldTestDraftKey, fieldTestSessionQueueIdempotencyKey } from "@/lib/offline/draftKeys";
import { enqueueOfflineAction, listOfflineActions } from "@/lib/offline/offlineActionQueue";
import {
  clearScopedFormDraft,
  loadScopedFormDraft,
  saveScopedFormDraft,
} from "@/lib/offline/scopedFormDrafts";
import { hrefFieldTestSession } from "@/lib/fieldTests/fieldTestSessionRoutes";
import {
  hasFieldTestPendingSave,
  shouldDeferFieldTestAutosave,
  shouldFlushFieldTestAfterSave,
  shouldPreserveLocalFieldTestValuesOnFetch,
  shouldSkipFieldTestAutosave,
} from "@/lib/fieldTests/fieldTestAutosave";
import {
  clearSavedFieldTestDirtyKeysIfUnchanged,
  incrementFieldTestDirtyGeneration,
  mergeFieldTestValuesForSave,
  reconcileFieldTestOfflineQueueCompletion,
  snapshotFieldTestDirtyGenerations,
  type FieldTestOfflineQueuedBatch,
} from "@/lib/fieldTests/fieldTestSaveSnapshot";
import { PerformanceTabsNav } from "@/components/performance/PerformanceTabsNav";
import { PerformanceBreadcrumb } from "@/components/performance/PerformanceBreadcrumb";
import { PerformanceExportHint } from "@/components/performance/PerformanceExportHint";
import { FieldTestSessionNextSteps } from "@/components/performance/FieldTestSessionNextSteps";
import { PATHS } from "@/lib/navigation/routeRegistry";

function metricIsText(m: TestDefinitionRow): boolean {
  const ext = m as TestDefinitionRow & { valueType?: unknown };
  return isTextMetricValueType(ext.value_type ?? ext.valueType);
}

export function FieldTestSessionEntry({ sessionDate }: { sessionDate: string }) {
  const router = useRouter();
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveErrorDetail, setSaveErrorDetail] = useState<{
    title: string;
    description: string;
    correlationId?: string;
  } | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<
    "idle" | "dirty" | "saving" | "saved" | "queued" | "error"
  >("idle");
  const [exportBusy, setExportBusy] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const organizationFeatures = useMeAccessOrganizationFeatures();
  const [contextPulse, setContextPulse] = useState(false);
  
  const [metrics, setMetrics] = useState<TestDefinitionRow[]>([]); 
  const [players, setPlayers] = useState<ProfileBasic[]>([]); 
  const [testValues, setTestValues] = useState<Record<string, string | number>>({});
  const testValuesRef = useRef<Record<string, string | number>>({});
  const [previousTestCells, setPreviousTestCells] = useState<Record<string, FieldTestPreviousCell>>({});
  const [generalNotes, setGeneralNotes] = useState<Record<string, string>>({});
  const generalNotesRef = useRef<Record<string, string>>({});
  const [activeAthleteId, setActiveAthleteId] = useState<string | null>(null);
  const online = useOnlineStatus();
  const [scopeKey, setScopeKey] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [fieldDraftRestored, setFieldDraftRestored] = useState(false);
  const fetchRunRef = useRef(0);
  const cellRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const saveFeedbackRef = useRef(saveFeedback);
  const dirtyCellKeysRef = useRef<Set<string>>(new Set());
  const dirtyNoteProfileIdsRef = useRef<Set<string>>(new Set());
  const dirtyCellGenerationRef = useRef<Map<string, number>>(new Map());
  const dirtyNoteGenerationRef = useRef<Map<string, number>>(new Map());
  const saveInFlightRef = useRef(false);
  const pendingFlushAfterSaveRef = useRef(false);
  const offlineQueuedBatchesRef = useRef<FieldTestOfflineQueuedBatch[]>([]);
  const flushAutosaveRef = useRef<() => Promise<void>>(async () => {});

  const clearDirtyFieldTestState = useCallback(() => {
    dirtyCellKeysRef.current.clear();
    dirtyNoteProfileIdsRef.current.clear();
    dirtyCellGenerationRef.current.clear();
    dirtyNoteGenerationRef.current.clear();
    offlineQueuedBatchesRef.current = [];
  }, []);

  const fetchData = useCallback(async () => {
    const runId = ++fetchRunRef.current;
    setLoading(true);
    try {
      const dir = await listManagementDirectory();
      if (runId !== fetchRunRef.current) return;
      if ("error" in dir) {
        setPlayers([]);
        setDirectoryError(dir.error ?? "Kadro yüklenemedi.");
        setMetrics([]);
        setTestValues({});
        return;
      }
      setDirectoryError(null);

      const roster: ProfileBasic[] = dir.athletes.map((a) => ({
        id: a.id,
        full_name: a.full_name || "Sporcu",
        height: a.height ?? null,
        weight: a.weight ?? null,
      }));

      // 1. Organizasyona özel metrik tanımları (server action -> RLS etkilenmez)
      const defsRes = await listFieldTestDefinitionsForActor();
      if (runId !== fetchRunRef.current) return;
      const loadedMetrics: TestDefinitionRow[] =
        "error" in defsRes ? [] : (((defsRes.metrics || []) as unknown) as TestDefinitionRow[]);
      if ("error" in defsRes) {
        setSaveMessage(defsRes.error ?? "Metrik listesi alınamadı.");
        setMetrics([]);
      } else {
        setMetrics(loadedMetrics);
      }

      // 2. Mevcut sonuçlar — server action (org + koç yetkisi)
      const playerIds = roster.map((p) => p.id);
      let existingResults: AthleticResultRow[] = [];
      let existingNotes: Record<string, string> = {};
      let previousResults: FieldTestPreviousResultRow[] = [];
      if (playerIds.length > 0) {
        const [res, notesRes, prevRes] = await Promise.all([
          listAthleticResultsForActorByDate({
            profileIds: playerIds,
            testDate: sessionDate,
          }),
          listAthleticResultNotesByDate({
            profileIds: playerIds,
            testDate: sessionDate,
          }),
          listPreviousFieldTestResultsForActor({
            profileIds: playerIds,
            beforeTestDate: sessionDate,
          }),
        ]);
        if (runId !== fetchRunRef.current) return;
        if ("error" in res) {
          setSaveMessage(res.error ?? "Sonuçlar alınamadı.");
        } else {
          existingResults = res.results;
        }
        if (!("error" in notesRes)) {
          existingNotes = (notesRes.notes || []).reduce<Record<string, string>>((acc, row) => {
            acc[row.profile_id] = row.note || "";
            return acc;
          }, {});
        }
        if (!("error" in prevRes)) {
          previousResults = prevRes.results;
        }
      }
      if (runId !== fetchRunRef.current) return;

      setPlayers(roster);

      const metricValueTypeByTestId = Object.fromEntries(
        loadedMetrics.map((m) => [m.id, metricValueKindFromRow(m)])
      ) as Record<string, "number" | "text">;
      const metricUnitByTestId = Object.fromEntries(
        loadedMetrics.map((m) => [m.id, m.unit ?? ""])
      ) as Record<string, string>;
      const resultsMap = buildFieldTestValuesMapFromResults(existingResults, metricValueTypeByTestId);
      const previousMap = buildPreviousFieldTestCellsMap(
        previousResults,
        sessionDate,
        metricValueTypeByTestId,
        metricUnitByTestId
      );
      setPreviousTestCells(previousMap);
      if (!shouldPreserveLocalFieldTestValuesOnFetch(saveFeedbackRef.current)) {
        setTestValues(resultsMap);
        testValuesRef.current = resultsMap;
        setGeneralNotes(existingNotes);
        generalNotesRef.current = existingNotes;
        setSaveFeedback("idle");
        clearDirtyFieldTestState();
      }
    } catch (error) {
      console.error("Veri çekme hatası:", error);
    } finally {
      if (runId === fetchRunRef.current) {
        setLoading(false);
      }
    }
  }, [sessionDate, clearDirtyFieldTestState]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!scopeKey) return;

    const reconcileOfflineQueue = () => {
      const activeQueueItemIds = new Set(listOfflineActions(scopeKey).map((item) => item.id));
      offlineQueuedBatchesRef.current = reconcileFieldTestOfflineQueueCompletion(
        offlineQueuedBatchesRef.current,
        activeQueueItemIds,
        dirtyCellKeysRef.current,
        dirtyNoteProfileIdsRef.current,
        dirtyCellGenerationRef.current,
        dirtyNoteGenerationRef.current
      );

      const stillDirty = hasFieldTestPendingSave(
        dirtyCellKeysRef.current,
        dirtyNoteProfileIdsRef.current
      );
      const hasQueued = offlineQueuedBatchesRef.current.length > 0;

      if (!stillDirty && !hasQueued && saveFeedbackRef.current === "queued") {
        setSaveFeedback("saved");
        setLastSavedAt(new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }));
        void fetchData();
      } else if (stillDirty && hasQueued) {
        setSaveFeedback("queued");
      } else if (stillDirty) {
        setSaveFeedback("dirty");
      }
    };

    window.addEventListener("peaker-offline-queue-changed", reconcileOfflineQueue);
    return () => window.removeEventListener("peaker-offline-queue-changed", reconcileOfflineQueue);
  }, [scopeKey, fetchData]);

  useEffect(() => {
    void (async () => {
      const me = await fetchMeRoleClient();
      if (!me.ok) return;
      setActorUserId(me.userId);
      setScopeKey(buildOfflineScopeKey(me.organizationId, me.userId));
    })();
  }, []);

  const showFieldTestExportUi = shouldRenderExportUi(EXPORT_ENDPOINT_IDS.fieldTestResultsCsv, {
    roleAllowed: true,
    permissionAllowed: true,
    organizationFeatures,
  });

  const fieldDraftStorageKey = useMemo(() => {
    if (!actorUserId || !activeAthleteId) return "";
    return fieldTestDraftKey(activeAthleteId, sessionDate, actorUserId);
  }, [actorUserId, activeAthleteId, sessionDate]);

  useEffect(() => {
    if (!scopeKey || !fieldDraftStorageKey) return;
    const id = window.setTimeout(() => {
      saveScopedFormDraft(scopeKey, fieldDraftStorageKey, {
        testDate: sessionDate,
        selectedProfileIds: activeAthleteId ? [activeAthleteId] : [],
        testValues,
        generalNotes,
        metricSnapshot: metrics.map((m) => ({
          id: m.id,
          valueType: metricIsText(m) ? "text" : "number",
        })),
      });
    }, 700);
    return () => clearTimeout(id);
  }, [scopeKey, fieldDraftStorageKey, sessionDate, activeAthleteId, testValues, generalNotes, metrics]);

  useEffect(() => {
    if (!scopeKey || !fieldDraftStorageKey || fieldDraftRestored) return;
    const draft = loadScopedFormDraft(scopeKey, fieldDraftStorageKey);
    if (!draft?.payload) return;
    if (String(draft.payload.testDate) !== sessionDate) return;
    const ids = draft.payload.selectedProfileIds as string[] | undefined;
    const values = draft.payload.testValues as Record<string, string | number> | undefined;
    const notes = draft.payload.generalNotes as Record<string, string> | undefined;
    if (ids?.length) setActiveAthleteId(ids[0] ?? null);
    if (values) {
      setTestValues(values);
      testValuesRef.current = values;
      for (const key of Object.keys(values)) {
        dirtyCellKeysRef.current.add(key);
        incrementFieldTestDirtyGeneration(dirtyCellGenerationRef.current, key);
      }
    }
    if (notes) {
      setGeneralNotes(notes);
      generalNotesRef.current = notes;
      for (const profileId of Object.keys(notes)) {
        dirtyNoteProfileIdsRef.current.add(profileId);
        incrementFieldTestDirtyGeneration(dirtyNoteGenerationRef.current, profileId);
      }
    }
    setFieldDraftRestored(true);
    setSaveFeedback("dirty");
  }, [scopeKey, fieldDraftStorageKey, sessionDate, fieldDraftRestored]);

  useEffect(() => {
    if (saveFeedback !== "saved") return;
    const timeout = window.setTimeout(() => {
      setSaveFeedback("idle");
    }, 1400);
    return () => window.clearTimeout(timeout);
  }, [saveFeedback]);

  useEffect(() => {
    saveFeedbackRef.current = saveFeedback;
  }, [saveFeedback]);

  useEffect(() => {
    setContextPulse(true);
    const timeout = window.setTimeout(() => setContextPulse(false), 260);
    return () => window.clearTimeout(timeout);
  }, [activeAthleteId, metrics.length, sessionDate, saveFeedback]);

  useEffect(() => {
    if (players.length === 0) return;
    setActiveAthleteId((current) => {
      if (current && players.some((p) => p.id === current)) return current;
      return players[0]!.id;
    });
  }, [players]);

  const activeAthlete = useMemo(
    () => players.find((p) => p.id === activeAthleteId) ?? null,
    [players, activeAthleteId]
  );

  const activeAthleteIndex = useMemo(
    () => (activeAthleteId ? players.findIndex((p) => p.id === activeAthleteId) : -1),
    [players, activeAthleteId]
  );

  const completedAthleteIds = useMemo(() => {
    const set = new Set<string>();
    for (const player of players) {
      for (const metric of metrics) {
        const raw = testValues[fieldTestCellKey(player.id, metric.id)];
        if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
          set.add(player.id);
          break;
        }
      }
      if (generalNotes[player.id]?.trim()) {
        set.add(player.id);
      }
    }
    return set;
  }, [players, metrics, testValues, generalNotes]);

  const selectActiveAthlete = useCallback(
    async (athleteId: string) => {
      if (athleteId === activeAthleteId) return;
      await flushAutosaveRef.current();
      if (
        saveFeedbackRef.current === "dirty" ||
        saveFeedbackRef.current === "queued" ||
        saveFeedbackRef.current === "error"
      ) {
        const ok = window.confirm("Kaydedilmemiş değişiklikler var. Sporcu değiştirilsin mi?");
        if (!ok) return;
      }
      setActiveAthleteId(athleteId);
    },
    [activeAthleteId]
  );

  const goToAthleteByOffset = useCallback(
    (offset: number) => {
      if (activeAthleteIndex < 0) return;
      const next = players[activeAthleteIndex + offset];
      if (!next) return;
      selectActiveAthlete(next.id);
    },
    [activeAthleteIndex, players, selectActiveAthlete]
  );

  const handleValueChange = (playerId: string, metricId: string, val: string) => {
    const key = fieldTestCellKey(playerId, metricId);
    dirtyCellKeysRef.current.add(key);
    incrementFieldTestDirtyGeneration(dirtyCellGenerationRef.current, key);
    setTestValues((prev) => {
      const next = { ...prev, [key]: val };
      testValuesRef.current = next;
      return next;
    });
    setSaveFeedback("dirty");
  };

  const handleGeneralNoteChange = (playerId: string, val: string) => {
    dirtyNoteProfileIdsRef.current.add(playerId);
    incrementFieldTestDirtyGeneration(dirtyNoteGenerationRef.current, playerId);
    setGeneralNotes((prev) => {
      const next = { ...prev, [playerId]: val };
      generalNotesRef.current = next;
      return next;
    });
    setSaveFeedback("dirty");
  };

  const orderedCellKeys = useMemo(() => {
    if (!activeAthleteId) return [];
    return metrics.map((metric) => fieldTestCellKey(activeAthleteId, metric.id));
  }, [activeAthleteId, metrics]);

  const pendingFocusAthleteRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeAthleteId) {
      pendingFocusAthleteRef.current = activeAthleteId;
    }
  }, [activeAthleteId]);

  useEffect(() => {
    if (!activeAthleteId || metrics.length === 0) return;
    if (pendingFocusAthleteRef.current !== activeAthleteId) return;
    pendingFocusAthleteRef.current = null;
    const firstKey = fieldTestCellKey(activeAthleteId, metrics[0].id);
    const timeout = window.setTimeout(() => {
      const first = cellRefs.current[firstKey];
      if (first && document.activeElement !== first) {
        first.focus();
      }
    }, 80);
    return () => window.clearTimeout(timeout);
  }, [activeAthleteId, metrics.length, sessionDate]);

  const focusSiblingCell = (currentKey: string, direction: 1 | -1) => {
    const index = orderedCellKeys.indexOf(currentKey);
    if (index === -1) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= orderedCellKeys.length) return;
    const nextInput = cellRefs.current[orderedCellKeys[nextIndex]];
    if (nextInput) {
      nextInput.focus();
      nextInput.select();
    }
  };

  const saveDirtyChanges = async (options?: { silent?: boolean }) => {
    if (saveInFlightRef.current) {
      pendingFlushAfterSaveRef.current = true;
      return;
    }

    const dirtyCellKeys = new Set(dirtyCellKeysRef.current);
    const dirtyNoteIds = [...dirtyNoteProfileIdsRef.current];

    if (dirtyCellKeys.size === 0 && dirtyNoteIds.length === 0) {
      if (!options?.silent) {
        setSaveMessage("Kaydedilecek değişiklik yok.");
        setSaveFeedback("idle");
      }
      return;
    }

    const cellGenerationsAtSave = snapshotFieldTestDirtyGenerations(
      dirtyCellKeys,
      dirtyCellGenerationRef.current
    );
    const noteGenerationsAtSave = snapshotFieldTestDirtyGenerations(
      dirtyNoteIds,
      dirtyNoteGenerationRef.current
    );

    saveInFlightRef.current = true;
    setSaveLoading(true);
    if (!options?.silent) {
      setSaveMessage(null);
    }
    setSaveErrorDetail(null);
    setSaveFeedback("saving");
    try {
      const saveProfileIds = Array.from(
        new Set([
          ...[...dirtyCellKeys].map((key) => key.slice(0, 36)),
          ...dirtyNoteIds,
        ])
      );

      const valuesForSave = mergeFieldTestValuesForSave(testValues, testValuesRef.current);
      const notesForSave = { ...generalNotes, ...generalNotesRef.current };

      const cellEditSeqs = new Map<string, number>();
      for (const key of dirtyCellKeys) {
        cellEditSeqs.set(key, dirtyCellGenerationRef.current.get(key) ?? 0);
      }

      const built = buildFieldTestCells({
        selectedProfileIds: saveProfileIds,
        metrics: metrics.map((m) => ({
          id: m.id,
          valueType: metricValueKindFromRow(m),
        })),
        testValues: valuesForSave,
        onlyCellKeys: dirtyCellKeys,
        cellEditSeqs,
      });
      if (built.error) {
        setSaveMessage(built.error);
        setSaveErrorDetail({
          title: "Veri doğrulanamadı",
          description: "Bazı metrik alanları geçersiz olabilir.",
        });
        setSaveFeedback("error");
        return;
      }
      const cells = built.cells;

      const notesPayload = dirtyNoteIds.map((profileId) => ({
        profileId,
        note: notesForSave[profileId]?.trim() || null,
      }));

      if (!online) {
        if (!scopeKey) {
          setSaveMessage("Çevrimdışı kayıt için oturum doğrulanamadı.");
          setSaveFeedback("error");
          return;
        }
        const draftId =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `ft-${Date.now()}`;
        const queued = enqueueOfflineAction({
          kind: "field_test_draft",
          scopeKey,
          draftId,
          idempotencyKey: fieldTestSessionQueueIdempotencyKey(scopeKey, sessionDate),
          payload: {
            testDate: sessionDate,
            selectedProfileIds: saveProfileIds,
            cells,
            notes: notesPayload,
          },
          title: `Saha testi · ${sessionDate}`,
          organizationFeatures,
        });
        if ("error" in queued) {
          setSaveMessage(queued.error);
          setSaveFeedback("error");
        } else {
          const batchPayload = {
            queueItemId: queued.id,
            cellKeys: dirtyCellKeys,
            noteProfileIds: dirtyNoteIds,
            cellGenerationsAtQueue: cellGenerationsAtSave,
            noteGenerationsAtQueue: noteGenerationsAtSave,
          };
          const existingBatchIdx = offlineQueuedBatchesRef.current.findIndex(
            (batch) => batch.queueItemId === queued.id
          );
          if (existingBatchIdx >= 0) {
            const prev = offlineQueuedBatchesRef.current[existingBatchIdx]!;
            offlineQueuedBatchesRef.current[existingBatchIdx] = {
              ...batchPayload,
              cellKeys: new Set([...prev.cellKeys, ...dirtyCellKeys]),
              noteProfileIds: Array.from(new Set([...prev.noteProfileIds, ...dirtyNoteIds])),
            };
          } else {
            offlineQueuedBatchesRef.current.push(batchPayload);
          }
          if (!options?.silent) {
            setSaveMessage(
              "Saha testi kuyruğa alındı. Senkron merkezinden onaylayarak gönderebilirsiniz."
            );
          } else {
            setSaveMessage(null);
          }
          setSaveFeedback("queued");
        }
        return;
      }

      const result = await saveAthleticFieldResults({
        testDate: sessionDate,
        selectedProfileIds: saveProfileIds,
        cells,
        notes: notesPayload,
        writeSource: "online",
      });

      if ("error" in result && result.error) {
        setSaveMessage(result.error);
        setSaveErrorDetail({
          title: "Saha testi kaydedilemedi",
          description: result.error,
          correlationId: "correlationId" in result ? result.correlationId : undefined,
        });
        if (process.env.NODE_ENV !== "production") {
          console.error("[field-test save]", result);
        }
        setSaveFeedback("error");
      } else {
        if (scopeKey && fieldDraftStorageKey) {
          clearScopedFormDraft(scopeKey, fieldDraftStorageKey);
          setFieldDraftRestored(false);
        }
        clearSavedFieldTestDirtyKeysIfUnchanged(
          dirtyCellKeysRef.current,
          dirtyNoteProfileIdsRef.current,
          dirtyCellKeys,
          dirtyNoteIds,
          cellGenerationsAtSave,
          noteGenerationsAtSave,
          dirtyCellGenerationRef.current,
          dirtyNoteGenerationRef.current
        );
        const stillDirty = hasFieldTestPendingSave(
          dirtyCellKeysRef.current,
          dirtyNoteProfileIdsRef.current
        );
        if (!options?.silent) {
          setSaveMessage(stillDirty ? null : "Sonuçlar başarıyla kaydedildi.");
        } else {
          setSaveMessage(null);
        }
        setSaveFeedback(stillDirty ? "dirty" : "saved");
        if (!stillDirty) {
          setLastSavedAt(new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }));
        }
        if (!options?.silent && !stillDirty) {
          void fetchData();
        }
      }
    } catch (err) {
      console.error(err);
      setSaveMessage("Kayıt sırasında beklenmedik bir hata oluştu.");
      setSaveFeedback("error");
    } finally {
      setSaveLoading(false);
      saveInFlightRef.current = false;
      const shouldFlush = shouldFlushFieldTestAfterSave({
        pendingFlushRequested: pendingFlushAfterSaveRef.current,
        dirtyCellKeys: dirtyCellKeysRef.current,
        dirtyNoteProfileIds: dirtyNoteProfileIdsRef.current,
      });
      pendingFlushAfterSaveRef.current = false;
      if (shouldFlush) {
        void saveDirtyChanges({ silent: true });
      }
    }
  };

  flushAutosaveRef.current = async () => {
    if (
      shouldDeferFieldTestAutosave({
        saveInFlight: saveInFlightRef.current,
        dirtyCellKeys: dirtyCellKeysRef.current,
        dirtyNoteProfileIds: dirtyNoteProfileIdsRef.current,
      })
    ) {
      pendingFlushAfterSaveRef.current = true;
      return;
    }
    if (
      shouldSkipFieldTestAutosave({
        saveInFlight: saveInFlightRef.current,
        saveLoading,
        dirtyCellKeys: dirtyCellKeysRef.current,
        dirtyNoteProfileIds: dirtyNoteProfileIdsRef.current,
      })
    ) {
      return;
    }
    await saveDirtyChanges({ silent: true });
  };

  const saveSelectedResults = () => void saveDirtyChanges({ silent: false });

  const contextStatus = (() => {
    if (saveFeedback === "saving") return { label: "Kaydediliyor...", tone: "text-amber-200 border-amber-500/30 bg-amber-500/10", dot: "bg-amber-400" };
    if (saveFeedback === "saved")
      return {
        label: lastSavedAt ? `Kaydedildi · ${lastSavedAt}` : "Kaydedildi",
        tone: "text-emerald-200 border-emerald-500/30 bg-emerald-500/10",
        dot: "bg-emerald-400",
      };
    if (saveFeedback === "queued")
      return {
        label: "Senkronizasyon bekliyor",
        tone: "text-sky-200 border-sky-500/30 bg-sky-500/10",
        dot: "bg-sky-400",
      };
    if (saveFeedback === "error") return { label: "Kaydedilemedi", tone: "text-rose-200 border-rose-500/30 bg-rose-500/10", dot: "bg-rose-400" };
    if (saveFeedback === "dirty") return { label: "Kaydedilmemiş değişiklik var", tone: "text-amber-200 border-amber-500/30 bg-amber-500/10", dot: "bg-amber-400" };
    if (!activeAthleteId) return { label: "Sporcu seçimi bekleniyor", tone: "text-gray-300 ui-kpi-band", dot: "bg-gray-500" };
    return { label: "Değişiklik yok", tone: "text-gray-300 ui-kpi-band", dot: "bg-gray-500" };
  })();

  const hasUnsavedChanges =
    saveFeedback === "dirty" ||
    saveFeedback === "queued" ||
    saveFeedback === "error" ||
    hasFieldTestPendingSave(dirtyCellKeysRef.current, dirtyNoteProfileIdsRef.current);
  const canSave = (saveFeedback === "dirty" || saveFeedback === "queued") && !saveLoading;
  useUnsavedChangesGuard({ enabled: hasUnsavedChanges });

  useEffect(() => {
    clearDirtyFieldTestState();
    setFieldDraftRestored(false);
    setSaveFeedback("idle");
  }, [sessionDate, clearDirtyFieldTestState]);

  const handleDateChange = (nextDate: string) => {
    if (nextDate === sessionDate) return;
    void (async () => {
      await flushAutosaveRef.current();
      if (
        saveFeedbackRef.current === "dirty" ||
        saveFeedbackRef.current === "queued" ||
        saveFeedbackRef.current === "error"
      ) {
        const ok = window.confirm("Kayıt edilmemiş değişiklikler var, devam etmek istiyor musunuz?");
        if (!ok) return;
      }
      clearDirtyFieldTestState();
      router.push(hrefFieldTestSession(nextDate));
    })();
  };


  if (loading && players.length === 0) return (
    <div className="ui-loading-panel min-h-[50dvh] px-4 min-w-0 overflow-x-hidden pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] text-center">
      <Loader2 className="ui-loading-panel__spinner w-10 h-10 animate-spin" aria-hidden />
      <p className="ui-loading-panel__label italic tracking-wide sm:tracking-widest break-words max-w-md">
        Saha testleri hazırlanıyor...
      </p>
    </div>
  );

  return (
    <div className="ui-page min-w-0 overflow-x-hidden pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      
      {/* HEADER */}
      <header className="flex flex-col gap-4 min-w-0">
        <div className="space-y-2 min-w-0">
          <Link
            href="/saha-testleri"
            className="inline-flex min-h-10 items-center gap-2 text-[10px] font-black uppercase tracking-wider text-gray-500 transition sm:hover:text-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_70%,white)]"
          >
            <ChevronLeft size={14} aria-hidden />
            Oturum listesi
          </Link>
          <h1 className="ui-h1 break-words">
            SAHA <span className="text-[color:var(--peaker-ui-PRIMARY)]">TEST OTURUMU</span>
          </h1>
          <p className="text-[11px] font-bold text-gray-500">
            Sporcu seçin, metrikleri doldurun, sonraki sporcuya geçin. Alan dışına çıkınca değişiklikler otomatik kaydedilir.
          </p>
          {!online ? (
            <Notification
              message="Çevrimdışı: değerler taslağa kaydedilir; gönderim senkron merkezinden onaylıdır."
              variant="info"
            />
          ) : null}
        </div>
        <PerformanceBreadcrumb
          items={[
            { label: "Performans", href: PATHS.performans },
            { label: "Saha Testleri", href: PATHS.sahaTestleri },
            { label: "Oturum" },
          ]}
        />
        <PerformanceTabsNav activeKey="saha" />
        <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
          <PerformanceExportHint scope="session-csv" className="max-w-xl" />
          {showFieldTestExportUi ? (
          <button
            type="button"
            disabled={exportBusy}
            onClick={async () => {
              setExportBusy(true);
              setExportMessage(null);
              try {
                const res = await exportFieldTestResultsCSV({});
                if ("error" in res) {
                  setExportMessage(typeof res.error === "string" ? res.error : "CSV indirilemedi.");
                } else {
                  const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = res.filename;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  setExportMessage(
                    res.truncated
                      ? `İlk ${res.cap} sonuç indirildi. Tarih filtresiyle daraltabilirsiniz.`
                      : `${res.rowCount} sonuç indirildi.`
                  );
                }
              } catch {
                setExportMessage("CSV indirilemedi.");
              } finally {
                setExportBusy(false);
              }
            }}
            className="ui-btn-ghost inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-wide text-gray-300 hover:border-emerald-500/40 hover:text-white disabled:opacity-50 sm:min-h-10"
            aria-label="Saha testi sonuçlarını CSV olarak indir"
          >
            {exportBusy ? (
              <Loader2 className="size-3.5 animate-spin text-emerald-400" aria-hidden />
            ) : (
              <Download size={12} className="opacity-80" aria-hidden />
            )}
            CSV indir
          </button>
          ) : null}
        </div>
        {exportMessage ? (
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300" role="status">
            {exportMessage}
          </p>
        ) : null}

        <FieldTestSessionSubNav />

        <div className="ui-card grid gap-2 p-2.5 sm:grid-cols-4">
          <div className="ui-kpi-card px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-wider text-gray-500">Oturum tarihi</p>
            <p className={`mt-1 text-xs font-black text-white transition ${contextPulse ? "scale-[1.02]" : "scale-100"}`}>{new Date(`${sessionDate}T00:00:00`).toLocaleDateString("tr-TR")}</p>
          </div>
          <div className="ui-kpi-card px-3 py-2 sm:col-span-2">
            <p className="text-[9px] font-black uppercase tracking-wider text-gray-500">Aktif sporcu</p>
            <p className={`mt-1 truncate text-xs font-black text-white transition ${contextPulse ? "scale-[1.02]" : "scale-100"}`}>
              {activeAthlete?.full_name ?? "—"}
            </p>
          </div>
          <div className="ui-kpi-card px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-wider text-gray-500">Tamamlanan</p>
            <p className={`mt-1 text-xs font-black text-white tabular-nums transition ${contextPulse ? "scale-[1.02]" : "scale-100"}`}>
              {completedAthleteIds.size}/{players.length}
            </p>
          </div>
        </div>

        <div className={`rounded-xl border px-3 py-2 ${contextStatus.tone} transition-colors`}>
          <p className="text-[9px] font-black uppercase tracking-wider">Kayıt durumu</p>
          <p className="mt-1 inline-flex items-center gap-2 text-xs font-black">
            <span className={`h-2 w-2 rounded-full ${contextStatus.dot} ${saveFeedback === "saving" ? "animate-pulse" : ""}`} />
            {contextStatus.label}
          </p>
        </div>

        <div className="ui-card flex flex-col gap-2 p-2.5 sm:flex-row sm:items-end">
          <div className="ui-card-inner flex min-h-11 min-w-0 flex-1 items-center gap-3 px-4 py-2 md:flex-none">
            <Calendar size={16} className="shrink-0 text-[color:var(--peaker-ui-PRIMARY)]" aria-hidden />
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-wider text-gray-500">Tarih</p>
              <input
                type="date"
                className="min-w-0 w-full bg-transparent text-[11px] font-black outline-none text-white cursor-pointer touch-manipulation"
                value={sessionDate}
                onChange={(e) => handleDateChange(e.target.value)}
              />
            </div>
          </div>
          <p className="text-[10px] font-bold text-gray-500 sm:max-w-xs">
            Bu ekrandaki tüm girişler seçilen tarihe kaydedilir.
          </p>
          <Link
            href="/saha-testleri/genel-rapor"
            title="Takım analiz raporunu aç"
            className="ui-btn-ghost inline-flex min-h-11 items-center justify-center gap-2 px-4 text-[10px] font-black uppercase tracking-wide text-gray-300 sm:hover:border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_35%,transparent)] sm:hover:text-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_70%,white)]"
          >
            <Trophy size={14} className="shrink-0 text-[color:var(--peaker-ui-PRIMARY)]" aria-hidden /> Takım analiz raporu
          </Link>
          <Link
            href="/saha-testleri/metrikler"
            title="Metrik ayarlarını aç"
            className="ui-btn-ghost inline-flex min-h-11 items-center justify-center gap-2 px-4 text-[10px] font-black uppercase tracking-wide text-gray-300 sm:hover:border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_35%,transparent)] sm:hover:text-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_70%,white)]"
          >
            <Settings2 size={14} className="shrink-0" aria-hidden /> Metrikler
          </Link>
          <button
            type="button"
            onClick={() => void saveSelectedResults()}
            disabled={!canSave}
            className={`ui-btn-primary min-h-11 flex-1 touch-manipulation sm:flex-none ${canSave ? "" : "cursor-not-allowed opacity-40 shadow-none"}`}
          >
            {saveLoading ? (
              <Loader2 className="animate-spin" size={18} aria-hidden />
            ) : saveFeedback === "saved" ? (
              <CheckCircle2 size={16} className="text-emerald-300" aria-hidden />
            ) : (
              <CheckCircle2 size={16} aria-hidden />
            )}
            {saveLoading ? "Kaydediliyor..." : "Değişiklikleri kaydet"}
          </button>
        </div>
      </header>

      {/* TEK SPORCU OTURUMU */}
      <div className="min-w-0 space-y-4">
        {metrics.length === 0 ? (
          <div className="ui-card px-4 py-3">
            <p className="text-[11px] font-bold text-gray-300">
              Önce{" "}
              <Link href="/saha-testleri/metrikler" className="text-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_70%,white)] underline underline-offset-2">
                metrik tanımlayın
              </Link>
              , ardından veri girişi yapabilirsiniz.
            </p>
          </div>
        ) : null}
        {players.length === 0 ? (
          <EmptyState
            variant="onboarding"
            title="İlk sporcunu ekle"
            description="Saha testi oturumu için aktif sporcu listesi boş görünüyor."
            reason="Sporcu eklendikten sonra tek tek test girişi yapabilirsiniz."
            primaryAction={{ label: "Sporcu ekle", href: "/sporcular/yeni" }}
            secondaryAction={{ label: "Sporculara git", href: "/oyuncular" }}
            compact
          />
        ) : (
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(260px,320px)_1fr]">
            <FieldTestAthletePicker
              players={players}
              activeAthleteId={activeAthleteId}
              completedAthleteIds={completedAthleteIds}
              onSelect={selectActiveAthlete}
            />
            {activeAthlete ? (
              <FieldTestSingleAthleteEntry
                athlete={activeAthlete}
                metrics={metrics}
                metricIsTextFn={metricIsText}
                testValues={testValues}
                previousTestCells={previousTestCells}
                generalNote={generalNotes[activeAthlete.id] || ""}
                athleteIndex={Math.max(activeAthleteIndex, 0)}
                athleteTotal={players.length}
                onPrev={() => goToAthleteByOffset(-1)}
                onNext={() => goToAthleteByOffset(1)}
                onValueChange={(metricId, value) => handleValueChange(activeAthlete.id, metricId, value)}
                onGeneralNoteChange={(value) => handleGeneralNoteChange(activeAthlete.id, value)}
                onAutosaveBlur={() => void flushAutosaveRef.current()}
                cellRefs={cellRefs}
                onMetricEnter={(metricId, reverse) => {
                  if (!activeAthleteId) return;
                  focusSiblingCell(fieldTestCellKey(activeAthleteId, metricId), reverse ? -1 : 1);
                }}
              />
            ) : (
              <div className="ui-card p-8 text-center">
                <p className="text-sm font-semibold text-gray-500">Soldan bir sporcu seçin.</p>
              </div>
            )}
          </div>
        )}
      </div>
      {directoryError && (
        <div className="min-w-0 break-words">
          <Notification message={directoryError} variant="error" className="px-6 py-4" />
        </div>
      )}
      {saveErrorDetail ? (
        <InlineErrorState
          errorKind="fetch_error"
          title={saveErrorDetail.title}
          description={
            saveErrorDetail.correlationId
              ? `${saveErrorDetail.description} · Korelasyon: ${saveErrorDetail.correlationId}`
              : saveErrorDetail.description
          }
          onRetry={() => void saveSelectedResults()}
          className="mx-0"
        />
      ) : null}
      {saveFeedback === "saved" ? <FieldTestSessionNextSteps sessionDate={sessionDate} className="mt-4" /> : null}
      {saveMessage && !saveErrorDetail ? (
        <div className="min-w-0 break-words">
          <Notification message={saveMessage} variant={saveFeedback === "error" ? "error" : "success"} className="px-6 py-4" />
        </div>
      ) : null}
      {saveMessage && saveErrorDetail && saveFeedback !== "error" ? (
        <div className="min-w-0 break-words">
          <Notification message={saveMessage} variant="success" className="px-6 py-4" />
        </div>
      ) : null}
    </div>
  );
}