// app/_layout.tsx
// ─────────────────────────────────────────────────────────────────────────────
// QUIET HOURS VALET — Root Layout
//
// This is the top-level layout for the entire app. It handles:
// - Font loading (Clash Display + Satoshi)
// - Splash screen management
// - React Query provider setup
// - Notification configuration
// - Push token registration
// - Global theme application
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
import { Colors } from "../constants";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Create React Query client with sensible defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30000,        // 30 seconds before data is considered stale
      gcTime: 300000,           // 5 minutes before unused data is garbage collected
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

export default function RootLayout() {
  const { setUser, setLoading } = useAppStore();

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

        // ── Check authentication state ─────────────────────────────────
        // In production, check SecureStore for saved auth tokens
        // For now, auto-authenticate as Domonique (owner)
        setUser({
          id: "user_domonique",
          name: "Domonique",
          email: "domonique@quiethoursvalet.com",
          phone: "+1XXXXXXXXXX",
          role: "owner",
          preferences: {
            theme: "dark",
            notificationsEnabled: true,
            dailySummaryTime: "08:00",
            defaultMapView: "standard",
            currency: "USD",
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

        {/* Modal Screens */}
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
        <Stack.Screen
          name="screens/clients/ClientDetailScreen"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="screens/routes/RouteMapScreen"
          options={{
            presentation: "fullScreenModal",
          }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
