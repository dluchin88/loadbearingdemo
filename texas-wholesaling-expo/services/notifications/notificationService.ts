// services/notifications/notificationService.ts
// ─────────────────────────────────────────────────────────────────────────────
// QUIET HOURS VALET — Push Notification Service
//
// Manages all push notifications for the app. Critical for real-time alerts
// when AI agents complete calls, find hot leads, encounter errors, or when
// service routes need attention.
//
// NOTIFICATION CATEGORIES:
// 🤖 Agent Alerts  — Call completed, agent error, escalation needed
// 📊 Pipeline      — New lead found, lead converted, proposal opened
// 🚛 Operations    — Route started, stop completed, weather delay
// 💰 Financial     — Payment received, invoice overdue
// ⚠️  System       — VAPI error, Twilio issue, webhook failure
// ─────────────────────────────────────────────────────────────────────────────

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import type { AppNotification, NotificationType } from "../../types";

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Configure notification behavior.
 * - Show alerts even when app is in foreground
 * - Play sound for high-priority notifications
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
 * This token is sent to the backend so Make.com scenarios can
 * push notifications to this specific device.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("[NOTIFICATIONS] Push notifications require a physical device");
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

  // Android requires a notification channel
  if (Platform.OS === "android") {
    await createAndroidChannels();
  }

  return tokenData.data;
}

/**
 * Create Android notification channels for different alert types.
 */
async function createAndroidChannels() {
  // Agent alerts — high priority, custom sound
  await Notifications.setNotificationChannelAsync("agent-alerts", {
    name: "AI Agent Alerts",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#8B5CF6", // Violet for AI
    sound: "agent-alert.wav",
  });

  // Pipeline updates — medium priority
  await Notifications.setNotificationChannelAsync("pipeline", {
    name: "Pipeline Updates",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: "#00E5A0", // Teal for success
  });

  // Operations — high priority
  await Notifications.setNotificationChannelAsync("operations", {
    name: "Service Operations",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 500, 250, 500],
    lightColor: "#F59E0B", // Amber for attention
  });

  // Financial — medium priority
  await Notifications.setNotificationChannelAsync("financial", {
    name: "Financial Alerts",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: "#06B6D4", // Cyan for info
  });

  // System errors — max priority
  await Notifications.setNotificationChannelAsync("system", {
    name: "System Alerts",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 500, 500],
    lightColor: "#F43F5E", // Red for errors
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION BUILDERS
// Each function creates a properly formatted notification for its category.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Send a local notification when an AI agent completes a call.
 * Includes the outcome and any required follow-up action.
 */
export async function notifyAgentCallCompleted(data: {
  agentName: string;
  contactName: string;
  complexName: string;
  outcome: string;
  duration: number;
  nextAction?: string;
}) {
  const outcomeEmoji = getOutcomeEmoji(data.outcome);
  const durationStr = formatDuration(data.duration);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${outcomeEmoji} ${data.agentName} — Call Complete`,
      body: `${data.contactName} at ${data.complexName}\n${formatOutcome(data.outcome)} • ${durationStr}${data.nextAction ? `\nNext: ${data.nextAction}` : ""}`,
      data: {
        type: "agent_call_completed" as NotificationType,
        priority: data.outcome === "appointment_set" ? "high" : "medium",
        screen: "/agents",
      },
      ...(Platform.OS === "android" && {
        channelId: "agent-alerts",
      }),
    },
    trigger: null, // Immediate
  });
}

/**
 * Send notification when an agent encounters an error.
 * These are critical — usually VAPI transport errors or Twilio issues.
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
 * Send notification when the Prospector Agent finds a high-value lead.
 */
export async function notifyNewHotLead(data: {
  complexName: string;
  unitCount: number;
  score: number;
  estimatedValue: number;
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🔥 Hot Lead Found — Score: ${data.score}`,
      body: `${data.complexName} (${data.unitCount} units)\nEstimated value: $${data.estimatedValue.toLocaleString()}/month`,
      data: {
        type: "new_lead" as NotificationType,
        priority: "high",
        screen: "/pipeline",
      },
      ...(Platform.OS === "android" && {
        channelId: "pipeline",
      }),
    },
    trigger: null,
  });
}

/**
 * Send notification when a lead converts to a paying client.
 */
export async function notifyLeadConverted(data: {
  complexName: string;
  monthlyValue: number;
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🎉 New Client Signed!`,
      body: `${data.complexName}\n$${data.monthlyValue.toLocaleString()}/month in new revenue`,
      data: {
        type: "lead_converted" as NotificationType,
        priority: "high",
        screen: "/clients",
      },
      ...(Platform.OS === "android" && {
        channelId: "pipeline",
      }),
    },
    trigger: null,
  });
}

/**
 * Send notification when an agent needs human intervention.
 * This is the "hot transfer" alert — highest priority.
 */
export async function notifyEscalationNeeded(data: {
  agentName: string;
  reason: string;
  contactName: string;
  contactPhone: string;
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🚨 ESCALATION — ${data.agentName}`,
      body: `${data.reason}\n${data.contactName}: ${data.contactPhone}\nCall back ASAP`,
      data: {
        type: "escalation_needed" as NotificationType,
        priority: "urgent",
        screen: "/agents",
        phone: data.contactPhone,
      },
      ...(Platform.OS === "android" && {
        channelId: "system",
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
    appointment_set: "📅",
    proposal_sent: "📄",
    interested: "👍",
    not_interested: "👎",
    callback_requested: "📞",
    voicemail_left: "📱",
    wrong_number: "❌",
    issue_resolved: "✅",
    escalated_to_human: "🚨",
    contract_renewed: "🎉",
    upsell_accepted: "💰",
  };
  return emojiMap[outcome] || "📋";
}

function formatOutcome(outcome: string): string {
  return outcome.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}
