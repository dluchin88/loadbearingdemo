// app/_layout.tsx
// ─────────────────────────────────────────────────────────────────────────────
// TEXAS WHOLESALING — Root Layout
//
// Top-level layout for the wholesaling command center app. Handles:
// - Font loading (Clash Display + Satoshi)
// - Splash screen management
// - React Query provider setup
// - Push notification configuration
// - Global theme application
// - Agent initialization (11 AI agents)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Font from "expo-font";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  configureNotifications,
  registerForPushNotifications,
} from "../services/notifications/notificationService";
import { useAppStore } from "../store/useAppStore";
import { initializeAgents } from "../services/agents/vapiService";
import { Colors } from "../constants";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Create React Query client with sensible defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30000,
      gcTime: 300000,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

export default function RootLayout() {
  const { setUser, setLoading, setAgents } = useAppStore();

  useEffect(() => {
    async function initialize() {
      try {
        // ── Load custom fonts ──────────────────────────────────────────
        await Font.loadAsync({
          "ClashDisplay-Bold": require("../assets/fonts/ClashDisplay-Bold.otf"),
          "ClashDisplay-Semibold": require("../assets/fonts/ClashDisplay-Semibold.otf"),
          "Satoshi-Regular": require("../assets/fonts/Satoshi-Regular.otf"),
          "Satoshi-Medium": require("../assets/fonts/Satoshi-Medium.otf"),
          "Satoshi-Bold": require("../assets/fonts/Satoshi-Bold.otf"),
          "JetBrainsMono-Regular": require("../assets/fonts/JetBrainsMono-Regular.ttf"),
        });

        // ── Configure push notifications ───────────────────────────────
        configureNotifications();
        const pushToken = await registerForPushNotifications();
        if (pushToken) {
          console.log("[INIT] Push token registered:", pushToken);
          // TODO: Send push token to backend for Make.com integration
        }

        // ── Initialize 11 AI Agents ────────────────────────────────────
        const agents = initializeAgents();
        setAgents(agents);
        console.log(`[INIT] Initialized ${agents.length} AI agents`);

        // ── Set authenticated user (Domonique — Owner) ─────────────────
        setUser({
          id: "user_domonique",
          name: "Domonique",
          email: "tc@loadbearingcapital.com",
          phone: "+13468605428",
          role: "owner",
          preferences: {
            theme: "dark",
            notificationsEnabled: true,
            dailySummaryTime: "08:00",
          },
        });
      } catch (error) {
        console.error("[INIT] Initialization failed:", error);
      } finally {
        setLoading(false);
        await SplashScreen.hideAsync();
      }
    }

    initialize();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" backgroundColor={Colors.primary[900]} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.primary[900] },
          animation: "slide_from_right",
        }}
      >
        {/* Tab Navigator (main app) */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Agent Modal Screens */}
        <Stack.Screen
          name="screens/agents/AgentDetailScreen"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="screens/agents/LiveCallScreen"
          options={{
            presentation: "fullScreenModal",
            animation: "fade",
          }}
        />

        {/* Lead Modal Screens */}
        <Stack.Screen
          name="screens/leads/LeadDetailScreen"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />

        {/* Deal Modal Screens */}
        <Stack.Screen
          name="screens/deals/DealDetailScreen"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />

        {/* Buyer Modal Screens */}
        <Stack.Screen
          name="screens/buyers/BuyerDetailScreen"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
