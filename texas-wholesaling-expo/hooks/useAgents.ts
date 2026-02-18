// hooks/useAgents.ts
// ─────────────────────────────────────────────────────────────────────────────
// TEXAS WHOLESALING — Agent Management Hooks
//
// Custom React hooks for managing 11 AI agent state:
// - Zara TW (Receptionist)
// - 8 Cold Callers (Ace, Maya, Eli, Nova, Raven, Jett, Sage, Finn)
// - Luna (Follow-Up Agent)
// - Blaze (Disposition Agent)
//
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
  isAgentInSchedule,
  type OutboundCallContext,
  type AIAgent,
  type CallLog,
} from "../services/agents/vapiService";
import {
  triggerCallCompletedWebhook,
  triggerHotLeadWebhook,
} from "../services/api/makeWebhooks";
import {
  notifyAgentCallCompleted,
  notifyAgentError,
  notifyHotLead,
} from "../services/notifications/notificationService";

/**
 * useAgentList — Fetches and manages the list of all 11 AI agents.
 * Polls every 10 seconds to keep status indicators live.
 */
export function useAgentList() {
  const { agents, setAgents } = useAppStore();

  const query = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      // In production, this fetches from your backend/Supabase
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
 * useColdCallers — Returns only the 8 cold caller agents.
 */
export function useColdCallers() {
  const { agents } = useAppStore();
  return agents.filter((a) => a.role === "cold_caller");
}

/**
 * useAgentsByRole — Returns agents filtered by role.
 */
export function useAgentsByRole(role: AIAgent["role"]) {
  const { agents } = useAppStore();
  return agents.filter((a) => a.role === role);
}

/**
 * useAgentCall — Hook for initiating and monitoring a single AI agent call.
 *
 * USAGE:
 * const { startCall, stopCall, callStatus, isCallActive } = useAgentCall(agent);
 * startCall({
 *   contactPhone: "+1234567890",
 *   contactName: "John Smith",
 *   propertyAddress: "123 Main St, Houston TX",
 *   county: "Harris",
 *   dataSource: "tax_delinquent"
 * });
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
      // Check if agent is within scheduled calling window
      if (agent.role === "cold_caller" && !isAgentInSchedule(agent)) {
        throw new Error(
          `${agent.name} is outside their calling window (${agent.schedule})`
        );
      }
      return initiateOutboundCall(agent, context.contactPhone, context);
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
        motivationScore: finalStatus.analysis?.motivationScore || 0,
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

      // Push to Make.com for Supabase logging
      await triggerCallCompletedWebhook({
        agent_id: agent.id,
        agent_name: agent.name,
        direction: "outbound",
        contact_phone: callLog.contactPhone,
        contact_name: callLog.contactName,
        lead_id: callLog.leadId,
        county: callLog.county,
        status: "completed",
        start_time: callLog.startTime,
        end_time: completedLog.endTime,
        duration: completedLog.duration,
        recording_url: completedLog.recordingUrl,
        transcript_summary: completedLog.transcriptSummary,
        outcome: completedLog.outcome,
        motivation_score: completedLog.motivationScore,
        vapi_call_id: callLog.vapiCallId,
      });

      // If hot lead (7+), send special alert
      if (completedLog.motivationScore && completedLog.motivationScore >= 7) {
        await notifyHotLead({
          ownerName: callLog.contactName || "Unknown",
          propertyAddress: callLog.propertyAddress || "Unknown",
          county: callLog.county || "Unknown",
          motivationScore: completedLog.motivationScore,
          agentName: agent.name,
        });
      }

      // Send push notification
      await notifyAgentCallCompleted({
        agentName: agent.name,
        contactName: callLog.contactName || "Unknown",
        propertyAddress: callLog.propertyAddress || "Unknown",
        outcome: completedLog.outcome || "completed",
        duration: completedLog.duration,
        motivationScore: completedLog.motivationScore,
      });

      // Reset agent to idle after cooldown
      setTimeout(() => {
        updateAgent(agent.id, { status: "idle" });
      }, 5000);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["callLogs"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
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
export function useAgentMetrics(
  agent: AIAgent,
  dateRange: { start: string; end: string }
) {
  return useQuery({
    queryKey: ["agentMetrics", agent.id, dateRange],
    queryFn: () =>
      getCallAnalytics(agent.vapiAssistantId, dateRange.start, dateRange.end),
    staleTime: 60000, // Cache for 1 minute
  });
}

/**
 * useAgentQueue — Fetches the calling queue for a specific cold caller.
 * Returns leads assigned to their counties that haven't been called today.
 */
export function useAgentQueue(agent: AIAgent) {
  return useQuery({
    queryKey: ["agentQueue", agent.id, agent.assignedCounties],
    queryFn: async () => {
      // This would call supabaseService.getAgentQueue
      // For now, returns empty array
      return [];
    },
    enabled: agent.role === "cold_caller" && !!agent.assignedCounties?.length,
    staleTime: 30000,
  });
}

/**
 * useTodaysCallStats — Gets today's calling statistics by agent.
 */
export function useTodaysCallStats() {
  return useQuery({
    queryKey: ["todaysCallStats"],
    queryFn: async () => {
      // This would call supabaseService.getTodaysCallSummary
      return {};
    },
    refetchInterval: 60000, // Refresh every minute
  });
}
