import * as Sentry from "@sentry/nextjs";
import { getPeakerSentryInitOptions } from "@/sentry.shared";

Sentry.init(getPeakerSentryInitOptions());
