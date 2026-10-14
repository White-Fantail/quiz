import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KidsLocaleProvider, useKidsLocale } from "../src/state/locale";
import { KidsSessionProvider, useKidsSession } from "../src/state/session";
import { useEffect } from "react";
import { KidsParentProvider } from "../src/state/parent";
import { KidsTimeProvider } from "../src/state/time";

function PinLocaleToGuardian(){
 const session=useKidsSession(),{chooseLocale}=useKidsLocale();
 useEffect(()=>{if(session.status==="active")chooseLocale(session.session.profile.locale);},
  [session.status,session.status==="active"?session.session.profile.locale:"",chooseLocale]);
 return null;
}
export default function RootLayout(){
 return <SafeAreaProvider><KidsLocaleProvider><KidsSessionProvider><KidsParentProvider><KidsTimeProvider><PinLocaleToGuardian/>
  <StatusBar style="dark"/>
  <Stack screenOptions={{headerShown:false}}><Stack.Screen name="game" options={{gestureEnabled:false}} /></Stack>
 </KidsTimeProvider></KidsParentProvider></KidsSessionProvider></KidsLocaleProvider></SafeAreaProvider>;
}
