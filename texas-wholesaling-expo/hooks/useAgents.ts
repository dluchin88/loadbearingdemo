// hooks/useAgents.ts
// ─────────────────────────────────────────────────────────────────────────────
// QUIET HOURS VALET — Agent Management Hooks
//
// Custom React hooks for managing AI agent state, triggering calls,
// monitoring live calls, and fetching agent performance data.
// Uses React Query for caching and background refetching.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "../store/useAppStore";
import {
  initiateOutboundCall,
  getCallStatus,
  endCall,
  getCallTranscript,
  getCallAnalytics,
  type OutboundCallContext,
} from "../services/agents/vapiService";
import { triggerCallCompletedWebhook } from "../services/api/makeWebhooks";
import {
  notifyAgentCallCompleted,
  notifyAgentError,
} from "../services/notifications/notificationService";
import type { AIAgent, CallLog } from "../types";

/**
 * useAgentList — Fetches and manages the list of all 7 AI agents.
 * Polls every 10 seconds to keep status indicators live.
 */
export function useAgentList() {
  const { agents, setAgents } = useAppStore();

  const query = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      // In production, this fetches from your backend/Google Sheets
      // For now, returns the agents from Zustand store
      return agents;
    },
    refetchInterval: 10000, // Poll every 10s for status updates
  });

  return {
    agents: query.data || agents,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

/**
 * useAgentCall — Hook for initiating and monitoring a single AI agent call.
 *
 * USAGE:
 * const { startCall, stopCall, callStatus, isCallActive } = useAgentCall(agent);
 * startCall({ contactName: "John", propertyName: "Retreat at Westchase", ... });
 */
export function useAgentCall(agent: AIAgent) {
  const queryClient = useQueryClient();
  const { updateAgent, addCallLog, setLiveCall } = useAppStore();
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [callStatus, setCallStatus] = useState<string>("idle");
  const [activeCallId, setActiveCallId] = useState<string | null>(null);

  // ── Start Call Mutation ────────────────────────────────────────────────
  const startCallMutation = useMutation({
    mutationFn: async (context: OutboundCallContext) => {
      return initiateOutboundCall(agent, context.contactPhone || "", context);
    },
    onSuccess: (callLog: CallLog) => {
      setActiveCallId(callLog.vapiCallId);
      setCallStatus("ringing");
      setLiveCall(callLog);
      addCallLog(callLog);
      updateAgent(agent.id, {
        status: "on_call",
        activeCallId: callLog.vapiCallId,
        totalCallsToday: agent.totalCallsToday + 1,
      });

      // Start polling for call status updates
      pollIntervalRef.current = setInterval(async () => {
        try {
          const status = await getCallStatus(callLog.vapiCallId);
          setCallStatus(status.status);

          if (status.status === "ended" || status.status === "failed") {
            handleCallEnded(callLog, status);
          }
        } catch (err) {
          console.error("[AGENT CALL] Status poll failed:", err);
        }
      }, 3000);
    },
    onError: (error: Error) => {
      setCallStatus("error");
      updateAgent(agent.id, { status: "error" });
      notifyAgentError({
        agentName: agent.name,
        errorMessage: error.message,
      });
    },
  });

  // ── Handle Call End ────────────────────────────────────────────────────
  const handleCallEnded = useCallback(
    async (callLog: CallLog, finalStatus: any) => {
      // Stop polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      // Get transcript and summary
      const transcript = await getCallTranscript(callLog.vapiCallId);

      // Update the call log with final data
      const completedLog: CallLog = {
        ...callLog,
        status: "completed",
        endTime: new Date().toISOString(),
        duration: transcript.duration,
        transcriptSummary: transcript.summary,
        recordingUrl: transcript.recordingUrl,
        outcome: finalStatus.analysis?.outcome || "information_gathered",
        sentimentScore: finalStatus.analysis?.sentimentScore || 0.5,
        keyTopics: finalStatus.analysis?.keyTopics || [],
      };

      // Update state
      setCallStatus("idle");
      setActiveCallId(null);
      setLiveCall(null);
      updateAgent(agent.id, {
        status: "cooldown",
        activeCallId: undefined,
        totalCallsMade: agent.totalCallsMade + 1,
      });

      // Push to Make.com for Google Sheets logging
      await triggerCallCompletedWebhook(completedLog);

      // Send push notification
      await notifyAgentCallCompleted({
        agentName: agent.name,
        contactName: callLog.contactName || "Unknown",
        complexName: callLog.complexName || "Unknown",
        outcome: completedLog.outcome,
        duration: completedLog.duration,
      });

      // Reset agent to idle after cooldown
      setTimeout(() => {
        updateAgent(agent.id, { status: "idle" });
      }, 5000);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["callLogs"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
    [agent, queryClient, updateAgent, setLiveCall]
  );

  // ── Stop Call ──────────────────────────────────────────────────────────
  const stopCall = useCallback(async () => {
    if (activeCallId) {
      await endCall(activeCallId);
      setCallStatus("idle");
      setActiveCallId(null);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    }
  }, [activeCallId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return {
    startCall: startCallMutation.mutate,
    stopCall,
    callStatus,
    isCallActive: callStatus === "ringing" || callStatus === "in-progress",
    isStarting: startCallMutation.isPending,
    error: startCallMutation.error,
  };
}

/**
 * useAgentMetrics — Fetches performance analytics for a specific agent.
 * Powers the charts on the Agent Detail screen.
 */
export function useAgentMetrics(agent: AIAgent, dateRange: { start: string; end: string }) {
  return useQuery({
    queryKey: ["agentMetrics", agent.id, dateRange],
    queryFn: () =>
      getCallAnalytics(agent.vapiAssistantId, dateRange.start, dateRange.end),
    staleTime: 60000, // Cache for 1 minute
  });
}
