import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useKidsLocale } from "../../src/state/locale";
import { theme } from "../../src/theme";

const tabs = [
 {name:"index",label:"kids.nav.home",emoji:"🏠"},
 {name:"explore",label:"kids.nav.explore",emoji:"🧭"},
 {name:"challenge",label:"kids.nav.challenge",emoji:"🧩"},
 {name:"treasures",label:"kids.nav.treasures",emoji:"⭐"},
] as const;

export default function KidsTabs(){
 const {t}=useKidsLocale();
 return <Tabs screenOptions={{
  headerShown:false,tabBarActiveTintColor:theme.colors.accent,tabBarInactiveTintColor:theme.colors.muted,
  tabBarStyle:{height:68,paddingTop:5,paddingBottom:10,backgroundColor:theme.colors.card,borderTopColor:theme.colors.outline},
  tabBarLabelStyle:{fontSize:12,fontWeight:"700"},
 }}>
  {tabs.map(tab=><Tabs.Screen key={tab.name} name={tab.name}
    options={{title:t(tab.label),tabBarAccessibilityLabel:t(tab.label),
      tabBarIcon:()=> <Text style={{fontSize:23}}>{tab.emoji}</Text>}}/>)}
 </Tabs>;
}
