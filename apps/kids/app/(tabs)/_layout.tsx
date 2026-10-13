import { Tabs, Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useKidsSession } from "../../src/state/session";
import { useKidsTime } from "../../src/state/time";
import { KidsEmojiIcon } from "../../src/components/KidsIcon";
import { useKidsLocale } from "../../src/state/locale";
import { theme } from "../../src/theme";

const tabs = [
 {name:"index",label:"kids.nav.home",emoji:"🏠"},
 {name:"explore",label:"kids.nav.explore",emoji:"🧭"},
 {name:"packs",label:"kids.nav.packs",emoji:"📚"},
 {name:"challenge",label:"kids.nav.challenge",emoji:"🧩"},
 {name:"treasures",label:"kids.nav.treasures",emoji:"⭐"},
] as const;

export default function KidsTabs(){
 const {t}=useKidsLocale();
 const session=useKidsSession();
 const time=useKidsTime();
 if(session.status==="checking")return <View style={{flex:1,justifyContent:"center"}}><ActivityIndicator/></View>;
 if(session.status!=="active")return <Redirect href="/setup" />;
 if(time.status==="checking")return <View style={{flex:1,justifyContent:"center"}}><ActivityIndicator/></View>;
 if(time.status==="blocked")return <Redirect href="/time-up" />;
 return <Tabs screenOptions={{
  headerShown:false,tabBarActiveTintColor:theme.colors.accent,tabBarInactiveTintColor:theme.colors.muted,
  tabBarStyle:{height:68,paddingTop:5,paddingBottom:10,backgroundColor:theme.colors.card,borderTopColor:theme.colors.outline},
  tabBarLabelStyle:{fontSize:12,fontWeight:"700"},
 }}>
  {tabs.map(tab=><Tabs.Screen key={tab.name} name={tab.name}
    options={{title:t(tab.label),tabBarAccessibilityLabel:t(tab.label),
      tabBarIcon:({color})=> <KidsEmojiIcon emoji={tab.emoji} size={26} color={color}/>}}/>)}
 </Tabs>;
}
