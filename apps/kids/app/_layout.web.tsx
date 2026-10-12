import { Slot } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
// The web preview intentionally has no KidsSessionProvider or API/device providers.
export default function WebLayout(){return <SafeAreaProvider><Slot/></SafeAreaProvider>;}
