import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KidsLocaleProvider } from "../src/state/locale";

export default function RootLayout(){
 return <SafeAreaProvider><KidsLocaleProvider>
  <StatusBar style="dark"/>
  <Stack screenOptions={{headerShown:false}} />
 </KidsLocaleProvider></SafeAreaProvider>;
}
