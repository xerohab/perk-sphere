// Event name mapping between Base44 partner event types and Linux API event types.
// Partners send business-level events to the Linux API; Linux independently verifies
// and forwards session-level events to Base44's trustedActivityBridge for reward
// processing.
//
// This mapping is the canonical reference for cross-system event translation.
// Unsupported events are never silently treated as successful — they are rejected
// with a clear error code.

// ─── Base44 Partner Event Types (business-level, sent by partners to Linux) ──────
export const PARTNER_EVENT_TYPES = [
  "ACCOUNT_REGISTERED",
  "ACCOUNT_LINKED",
  "ACCOUNT_DISABLED",
  "VIDEO_WATCH_PROGRESS",
  "STREAM_STARTED",
  "STREAM_VIEW_PROGRESS",
  "STREAM_ENDED",
  "PURCHASE_COMPLETED",
  "PURCHASE_REFUNDED",
  "CHARGEBACK_ISSUED",
  "SUBSCRIPTION_ACTIVATED",
  "SUBSCRIPTION_RENEWED",
  "SUBSCRIPTION_CANCELLED"
];

// ─── Linux Bridge Event Types (session-level, forwarded by Linux to bridge) ─────
export const LINUX_BRIDGE_EVENT_TYPES = [
  "SESSION_STARTED",
  "SESSION_PROGRESS",
  "SESSION_PAUSED",
  "SESSION_RESUMED",
  "SESSION_ENDED",
  "PAGE_PROGRESS",
  "TASK_PROGRESS_VERIFIED",
  "SESSION_INVALIDATED"
];

// ─── Linux-specific refund/chargeback events (not forwarded to bridge) ─────────
export const LINUX_REFUND_EVENT_TYPES = [
  "PARTNER_REFUND",
  "PARTNER_CHARGEBACK"
];

// ─── Mapping: partner event → Linux bridge event ──────────────────────────────
// Partners send business events; Linux translates to session events for the bridge.
// Refund/chargeback events are handled separately (not forwarded as session events).
export const PARTNER_TO_LINUX_EVENT_MAP = {
  "ACCOUNT_REGISTERED": "TASK_PROGRESS_VERIFIED",
  "ACCOUNT_LINKED": "TASK_PROGRESS_VERIFIED",
  "ACCOUNT_DISABLED": "SESSION_INVALIDATED",
  "VIDEO_WATCH_PROGRESS": "SESSION_PROGRESS",
  "STREAM_STARTED": "SESSION_STARTED",
  "STREAM_VIEW_PROGRESS": "SESSION_PROGRESS",
  "STREAM_ENDED": "SESSION_ENDED",
  "PURCHASE_COMPLETED": "TASK_PROGRESS_VERIFIED",
  "PURCHASE_REFUNDED": "PARTNER_REFUND",
  "CHARGEBACK_ISSUED": "PARTNER_CHARGEBACK",
  "SUBSCRIPTION_ACTIVATED": "TASK_PROGRESS_VERIFIED",
  "SUBSCRIPTION_RENEWED": "TASK_PROGRESS_VERIFIED",
  "SUBSCRIPTION_CANCELLED": "SESSION_INVALIDATED"
};

// ─── Reverse mapping: Linux bridge event → partner event (for diagnostics) ─────
export const LINUX_TO_PARTNER_EVENT_MAP = {
  "SESSION_STARTED": "STREAM_STARTED",
  "SESSION_PROGRESS": "VIDEO_WATCH_PROGRESS",
  "SESSION_ENDED": "STREAM_ENDED",
  "SESSION_INVALIDATED": "ACCOUNT_DISABLED",
  "TASK_PROGRESS_VERIFIED": "PURCHASE_COMPLETED",
  "PARTNER_REFUND": "PURCHASE_REFUNDED",
  "PARTNER_CHARGEBACK": "CHARGEBACK_ISSUED"
};

export function mapPartnerEventToLinux(partnerEvent) {
  return PARTNER_TO_LINUX_EVENT_MAP[partnerEvent] || null;
}

export function mapLinuxEventToPartner(linuxEvent) {
  return LINUX_TO_PARTNER_EVENT_MAP[linuxEvent] || null;
}

export function isSupportedPartnerEvent(eventType) {
  return PARTNER_EVENT_TYPES.includes(eventType);
}

export function isLinuxBridgeEvent(eventType) {
  return LINUX_BRIDGE_EVENT_TYPES.includes(eventType);
}

export function isLinuxRefundEvent(eventType) {
  return LINUX_REFUND_EVENT_TYPES.includes(eventType);
}