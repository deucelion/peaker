import * as Sentry from "@sentry/nextjs";
import { getPeakerSentryInitOptions } from "@/sentry.shared";

Sentry.init(getPeakerSentryInitOptions());

/** Next.js + Sentry: derleme uyarısını gidermek için (performans örneklemesi kapalı olsa da hook gerekli). */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
