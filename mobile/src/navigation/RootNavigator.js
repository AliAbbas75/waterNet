import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import AccountMenu from "../components/AccountMenu.js";
import { hasRole, useAuth } from "../contexts/AuthContext.js";
import { colors } from "../lib/theme.js";

import LoginScreen from "../screens/LoginScreen.js";
import MyTasksScreen from "../screens/maintainer/MyTasksScreen.js";
import TaskDetailScreen from "../screens/maintainer/TaskDetailScreen.js";
import MaintainerAlertsScreen from "../screens/maintainer/AlertsScreen.js";
import NearbyScreen from "../screens/public/NearbyScreen.js";
import PlantDetailScreen from "../screens/public/PlantDetailScreen.js";
import ReportFormScreen from "../screens/public/ReportFormScreen.js";
import MyReportsScreen from "../screens/public/MyReportsScreen.js";
import Spinner from "../components/Spinner.js";

const RootStack = createNativeStackNavigator();
const MaintainerTabs = createBottomTabNavigator();
const PublicTabs = createBottomTabNavigator();

const tabsScreenOptions = {
  tabBarActiveTintColor: colors.brand700,
  tabBarInactiveTintColor: colors.textMuted,
  headerStyle: { backgroundColor: colors.card },
  headerTitleStyle: { color: colors.text, fontWeight: "600" },
  headerRight: () => <AccountMenu />,
  tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.card }
};

function MaintainerNavigator() {
  return (
    <MaintainerTabs.Navigator screenOptions={tabsScreenOptions}>
      <MaintainerTabs.Screen
        name="MyTasks"
        component={MyTasksScreen}
        options={{
          title: "My Tasks",
          tabBarIcon: ({ color, size }) => <Ionicons name="list" color={color} size={size} />
        }}
      />
      <MaintainerTabs.Screen
        name="Alerts"
        component={MaintainerAlertsScreen}
        options={{
          title: "Alerts",
          tabBarIcon: ({ color, size }) => <Ionicons name="warning" color={color} size={size} />
        }}
      />
    </MaintainerTabs.Navigator>
  );
}

function PublicNavigator() {
  return (
    <PublicTabs.Navigator screenOptions={tabsScreenOptions}>
      <PublicTabs.Screen
        name="Nearby"
        component={NearbyScreen}
        options={{
          title: "Nearby plants",
          tabBarIcon: ({ color, size }) => <Ionicons name="location" color={color} size={size} />
        }}
      />
      <PublicTabs.Screen
        name="Report"
        component={ReportFormScreen}
        options={{
          title: "Report",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses" color={color} size={size} />
          )
        }}
      />
      <PublicTabs.Screen
        name="MyReports"
        component={MyReportsScreen}
        options={{
          title: "My reports",
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text" color={color} size={size} />
        }}
      />
    </PublicTabs.Navigator>
  );
}

export default function RootNavigator() {
  const { user, status } = useAuth();

  if (status === "loading") {
    return <Spinner label="Loading…" fullscreen />;
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <RootStack.Screen name="Login" component={LoginScreen} />
        ) : hasRole(user, "MAINTAINER") ? (
          <>
            <RootStack.Screen name="MaintainerHome" component={MaintainerNavigator} />
            <RootStack.Screen
              name="TaskDetail"
              component={TaskDetailScreen}
              options={{ headerShown: true, title: "Task" }}
            />
            <RootStack.Screen
              name="PlantDetail"
              component={PlantDetailScreen}
              options={{ headerShown: true, title: "Plant" }}
            />
          </>
        ) : (
          <>
            <RootStack.Screen name="PublicHome" component={PublicNavigator} />
            <RootStack.Screen
              name="PlantDetail"
              component={PlantDetailScreen}
              options={{ headerShown: true, title: "Plant" }}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
