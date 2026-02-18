// services/notifications/notificationService.ts
// ─────────────────────────────────────────────────────────────────────────────
// TEXAS WHOLESALING — Push Notification Service
//
// Manages all push notifications for the wholesaling command center.
// Critical for real-time alerts when:
// - Hot motivated seller found (7+ motivation score)
// - AI agent completes a call
// - Deal needs attention (contract expiring)
// - Cash buyer makes an offer
// - System errors occur
//
// NOTIFICATION CATEGORIES:
// 🔥 Hot Leads    — Motivated seller found, needs immediate callback
// 🤖 Agent Alerts — Call completed, agent error, transfer needed
// 💰 Deals        — Contract signed, offer received, closing soon
// 📊 Pipeline     — New lead imported, stage change
// ⚠️ System       — VAPI error, Twilio issue, webhook failure
// ─────────────────────────────────────────────────────────────────────────────

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

// ══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════════

export type NotificationType =
  | "hot_lead"
  | "agent_call_completed"
  | "agent_error"
  | "deal_update"
  | "offer_received"
  | "contract_expiring"
  | "escalation_needed"
  | "system_alert";

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Configure notification behavior.
 * - Show alerts even when app is in foreground
 * - Play sound for high-priority notifications (hot leads, errors)
 * - Set badge count for unread notifications
 */
export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const priority = notification.request.content.data?.priority;
      return {
        shouldShowAlert: true,
        shouldPlaySound: priority === "high" || priority === "urgent",
        shouldSetBadge: true,
      };
    },
  });
}

/**
 * Register for push notifications and get the device push token.
 * This token is sent to the backend so Make.com can push notifications.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn(
      "[NOTIFICATIONS] Push notifications require a physical device"
    );
    return null;
  }

  // Request permission
  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("[NOTIFICATIONS] Permission not granted");
    return null;
  }

  // Get the push token
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  // Android requires notification channels
  if (Platform.OS === "android") {
    await createAndroidChannels();
  }

  return tokenData.data;
}

/**
 * Create Android notification channels for different alert types.
 */
async function createAndroidChannels() {
  // Hot leads — HIGHEST priority, custom sound
  await Notifications.setNotificationChannelAsync("hot-leads", {
    name: "Hot Lead Alerts",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500],
    lightColor: "#D4A017", // Gold for money
    sound: "hot-lead.wav",
  });

  // Agent alerts — high priority
  await Notifications.setNotificationChannelAsync("agent-alerts", {
    name: "AI Agent Alerts",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#8B5CF6", // Violet for AI
  });

  // Deal updates — medium priority
  await Notifications.setNotificationChannelAsync("deals", {
    name: "Deal Updates",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: "#10B981", // Emerald for success
  });

  // System errors — max priority
  await Notifications.setNotificationChannelAsync("system", {
    name: "System Alerts",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 500, 500],
    lightColor: "#EF4444", // Red for errors
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION BUILDERS — TEXAS WHOLESALING SPECIFIC
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 🔥 HOT LEAD ALERT — Motivation 7+, immediate callback needed
 * This is the most important notification in the app.
 */
export async function notifyHotLead(data: {
  ownerName: string;
  propertyAddress: string;
  county: string;
  motivationScore: number;
  askingPrice?: number;
  agentName: string;
}) {
  const priceStr = data.askingPrice
    ? ` • Asking $${data.askingPrice.toLocaleString()}`
    : "";

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🔥 HOT SELLER — Motivation ${data.motivationScore}/10`,
      body: `${data.ownerName} at ${data.propertyAddress}\n${data.county} County${priceStr}\nFound by ${data.agentName} — CALL BACK ASAP`,
      data: {
        type: "hot_lead" as NotificationType,
        priority: "urgent",
        screen: "/leads",
      },
      ...(Platform.OS === "android" && {
        channelId: "hot-leads",
      }),
    },
    trigger: null, // Immediate
  });
}

/**
 * 🤖 AGENT CALL COMPLETED — Cold caller finished a call
 */
export async function notifyAgentCallCompleted(data: {
  agentName: string;
  contactName: string;
  propertyAddress: string;
  outcome: string;
  duration: number;
  motivationScore?: number;
}) {
  const scoreStr = data.motivationScore
    ? ` • Score: ${data.motivationScore}/10`
    : "";
  const durationStr = formatDuration(data.duration);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${getOutcomeEmoji(data.outcome)} ${data.agentName} — Call Complete`,
      body: `${data.contactName} at ${data.propertyAddress}\n${formatOutcome(data.outcome)} • ${durationStr}${scoreStr}`,
      data: {
        type: "agent_call_completed" as NotificationType,
        priority: data.motivationScore && data.motivationScore >= 7 ? "high" : "medium",
        screen: "/agents",
      },
      ...(Platform.OS === "android" && {
        channelId: "agent-alerts",
      }),
    },
    trigger: null,
  });
}

/**
 * ⚠️ AGENT ERROR — VAPI transport error, Twilio issue, etc.
 */
export async function notifyAgentError(data: {
  agentName: string;
  errorMessage: string;
  callId?: string;
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `⚠️ ${data.agentName} — Error`,
      body: data.errorMessage,
      data: {
        type: "agent_error" as NotificationType,
        priority: "urgent",
        screen: "/agents",
        callId: data.callId,
      },
      ...(Platform.OS === "android" && {
        channelId: "system",
      }),
    },
    trigger: null,
  });
}

/**
 * 💰 OFFER RECEIVED — Cash buyer made an offer on a deal
 */
export async function notifyOfferReceived(data: {
  buyerName: string;
  propertyAddress: string;
  offerAmount: number;
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `💰 Offer Received — $${data.offerAmount.toLocaleString()}`,
      body: `${data.buyerName} made an offer on ${data.propertyAddress}`,
      data: {
        type: "offer_received" as NotificationType,
        priority: "high",
        screen: "/deals",
      },
      ...(Platform.OS === "android" && {
        channelId: "deals",
      }),
    },
    trigger: null,
  });
}

/**
 * 📋 CONTRACT EXPIRING — Deal needs attention
 */
export async function notifyContractExpiring(data: {
  propertyAddress: string;
  daysRemaining: number;
  buyer?: string;
}) {
  const buyerStr = data.buyer ? ` No buyer assigned.` : ` Buyer: ${data.buyer}`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `⏰ Contract Expires in ${data.daysRemaining} Days`,
      body: `${data.propertyAddress}${buyerStr}`,
      data: {
        type: "contract_expiring" as NotificationType,
        priority: data.daysRemaining <= 7 ? "urgent" : "high",
        screen: "/deals",
      },
      ...(Platform.OS === "android" && {
        channelId: "deals",
      }),
    },
    trigger: null,
  });
}

/**
 * 🚨 ESCALATION NEEDED — Warm transfer to Domonique
 */
export async function notifyEscalationNeeded(data: {
  agentName: string;
  reason: string;
  contactName: string;
  contactPhone: string;
  propertyAddress?: string;
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🚨 ESCALATION — ${data.agentName}`,
      body: `${data.reason}\n${data.contactName}: ${data.contactPhone}${data.propertyAddress ? `\n${data.propertyAddress}` : ""}\nCall back ASAP`,
      data: {
        type: "escalation_needed" as NotificationType,
        priority: "urgent",
        screen: "/agents",
        phone: data.contactPhone,
      },
      ...(Platform.OS === "android" && {
        channelId: "hot-leads",
      }),
    },
    trigger: null,
  });
}

/**
 * 📊 NEW LEAD IMPORTED — From skip tracing batch
 */
export async function notifyNewLeadsImported(data: {
  count: number;
  counties: string[];
  source: string;
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `📊 ${data.count} New Leads Imported`,
      body: `Source: ${data.source}\nCounties: ${data.counties.join(", ")}`,
      data: {
        type: "pipeline" as NotificationType,
        priority: "medium",
        screen: "/leads",
      },
      ...(Platform.OS === "android" && {
        channelId: "agent-alerts",
      }),
    },
    trigger: null,
  });
}

/**
 * 🎉 DEAL CLOSED — Assignment fee earned!
 */
export async function notifyDealClosed(data: {
  propertyAddress: string;
  assignmentFee: number;
  buyerName: string;
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🎉 DEAL CLOSED — $${data.assignmentFee.toLocaleString()}`,
      body: `${data.propertyAddress}\nBuyer: ${data.buyerName}`,
      data: {
        type: "deal_update" as NotificationType,
        priority: "high",
        screen: "/deals",
      },
      ...(Platform.OS === "android" && {
        channelId: "deals",
      }),
    },
    trigger: null,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

function getOutcomeEmoji(outcome: string): string {
  const emojiMap: Record<string, string> = {
    hot_lead: "🔥",
    warm_lead: "👍",
    cold_lead: "❄️",
    callback_scheduled: "📅",
    voicemail_left: "📱",
    not_interested: "👎",
    wrong_number: "❌",
    dnc_requested: "🚫",
    transferred_to_human: "🚨",
    information_gathered: "📋",
  };
  return emojiMap[outcome] || "📞";
}

function formatOutcome(outcome: string): string {
  return outcome.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}
