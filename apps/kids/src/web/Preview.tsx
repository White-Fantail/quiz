import { useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { kidsT } from "@quizdip/i18n/kids";
import { Screen, Banner } from "../components/Screen";
import { AdventureTile } from "../components/AdventureTile";
import { theme } from "../theme";

type Lang="en"|"ko";
type Tab="home"|"explore"|"challenge"|"treasures"|"game";
type Words={en:string;ko:string};
type Example={emoji:string;type:"animal"|"place"|"concept";name:Words;prompt:Words;
  clues:[Words,Words];answers:[Words,Words,Words];correct:0|1|2};
const examples:Example[]=[
 {emoji:"🐳",type:"animal",name:{en:"Ocean mystery",ko:"바닷속 수수께끼"},
  prompt:{en:"Which animal am I?",ko:"어떤 동물일까요?"},
  clues:[{en:"I breathe air but live in the ocean.",ko:"공기를 마시지만 바다에 살아요."},
         {en:"I am a very large mammal.",ko:"나는 아주 커다란 포유류예요."}],
  answers:[{en:"Lion",ko:"사자"},{en:"Whale",ko:"고래"},{en:"Eagle",ko:"독수리"}],correct:1},
 {emoji:"🦒",type:"animal",name:{en:"Tall explorer",ko:"키 큰 탐험가"},
  prompt:{en:"Follow the animal clues.",ko:"동물 단서를 따라가요."},
  clues:[{en:"I eat leaves from tall trees.",ko:"높은 나무의 잎을 먹어요."},
         {en:"My neck is very long.",ko:"목이 아주 길어요."}],
  answers:[{en:"Giraffe",ko:"기린"},{en:"Penguin",ko:"펭귄"},{en:"Shark",ko:"상어"}],correct:0},
 {emoji:"🌍",type:"place",name:{en:"Our blue home",ko:"푸른 우리의 집"},
  prompt:{en:"Which place is this?",ko:"어디일까요?"},
  clues:[{en:"There are oceans and mountains here.",ko:"바다와 산이 있어요."},
         {en:"People and animals live here.",ko:"사람과 동물들이 살아요."}],
  answers:[{en:"Moon",ko:"달"},{en:"Mars",ko:"화성"},{en:"Earth",ko:"지구"}],correct:2}
];
const copy={
 en:{flag:"BROWSER PREVIEW · SAMPLE DATA ONLY",notice:"This is an interactive design preview. No real child data, account pairing, guardian PIN, server quiz, or media is accessed.",
  profile:"Sample explorer",about:"The guardian-only controls, real play and time limits run in the iPad/Android app.",
  explore:"Choose a sample question",begin:"Start 3-question sample",weekly:"Real weekly challenges are available only in the native app.",
  all:"All",animal:"Animals",place:"Places",concept:"Science",play:"Try sample",clue:"Clue",reveal:"Reveal next clue",
  answer:"Choose an answer",correct:"Wonderful!",wrong:"Try again!",next:"Next question",done:"Sample challenge finished!",
  back:"Explore more",again:"Start again",treasure:"Sample rewards",privacy:"Example badges and progress only; no child activity is recorded."},
 ko:{flag:"브라우저 미리보기 · 샘플 데이터",notice:"인터페이스를 미리 볼 수 있어요. 실제 어린이 정보, 계정 연결, 보호자 PIN, 서버 문제, 미디어에 접근하지 않습니다.",
  profile:"샘플 탐험가",about:"보호자 설정, 실제 게임과 시간 제한은 iPad/Android 앱에서 동작합니다.",
  explore:"샘플 문제를 선택하세요",begin:"샘플 3문제 시작",weekly:"실제 주간 챌린지는 네이티브 앱에서만 사용할 수 있습니다.",
  all:"전체",animal:"동물",place:"장소",concept:"과학",play:"샘플 풀기",clue:"단서",reveal:"다음 단서 보기",
  answer:"정답 고르기",correct:"정답이에요!",wrong:"다시 도전해요!",next:"다음 문제",done:"샘플 챌린지 완료!",
  back:"더 둘러보기",again:"다시 시작",treasure:"샘플 보상",privacy:"배지와 점수는 예시이며 어린이 활동을 기록하지 않습니다."}
} as const;
const local=(w:Words,lang:Lang)=>w[lang];

export default function Preview({initialTab="home"}:{initialTab?:Tab}){
 const [lang,setLang]=useState<Lang>("en"),[tab,setTab]=useState<Tab>(initialTab);
 const [filter,setFilter]=useState<"all"|"animal"|"place"|"concept">("all");
 const [question,setQuestion]=useState(0),[round,setRound]=useState(0);
 const [batch,setBatch]=useState(false),[hint,setHint]=useState(1),[answer,setAnswer]=useState<number|null>(null);
 const [score,setScore]=useState(0),[finished,setFinished]=useState(false);
 const {width}=useWindowDimensions(),s=copy[lang],t=(key:Parameters<typeof kidsT>[1])=>kidsT(lang,key);
 const sample=examples[question];
 const start=(n:number,isBatch=false)=>{
  setQuestion(n);setRound(0);setBatch(isBatch);setHint(1);setAnswer(null);setScore(0);setFinished(false);setTab("game");
 };
 const choose=(n:number)=>{
  if(answer!==null)return;
  setAnswer(n);
  if(n===sample.correct)setScore(p=>p+1);
 };
 const next=()=>{
  if(round===examples.length-1){setFinished(true);return;}
  setRound(n=>n+1);setQuestion(round+1);setHint(1);setAnswer(null);
 };
 const tabs=[["home","🏠","kids.nav.home"],["explore","🧭","kids.nav.explore"],
  ["challenge","🧩","kids.nav.challenge"],["treasures","⭐","kids.nav.treasures"]] as const;
 return <View style={styles.shell}>
  <View style={styles.header}>
   <Text style={styles.brand}>QuizDip <Text style={{color:theme.colors.ink}}>Kids ✨</Text></Text>
   <View style={styles.row}>
    {(["en","ko"] as const).map(l=><Pressable key={l} accessibilityRole="button"
      accessibilityState={{selected:lang===l}} onPress={()=>setLang(l)}
      style={[styles.pill,lang===l&&styles.selected]}>
     <Text style={styles.pillText}>{l==="en"?"English":"한국어"}</Text>
    </Pressable>)}
   </View>
  </View>
  <View style={styles.notice}><Text style={styles.noticeTitle}>🧪 {s.flag}</Text>
   <Text style={styles.detail}>{s.notice}</Text></View>
  <View style={styles.nav}>{tabs.map(([id,emoji,label])=><Pressable key={id}
    accessibilityRole="button" accessibilityState={{selected:tab===id}}
    style={[styles.pill,tab===id&&styles.selected]} onPress={()=>setTab(id)}>
    <Text style={styles.pillText}>{emoji} {t(label)}</Text>
  </Pressable>)}</View>
  {tab==="home"?<Screen title={t("kids.welcome")} subtitle={t("kids.subtitle")}>
   <Banner emoji="✨" title="QuizDip Kids" detail={t("native.choose")}/>
   <View style={styles.card}><Text style={styles.title}>🧒 {s.profile}</Text><Text style={styles.detail}>{s.about}</Text></View>
   <Text style={styles.heading}>{t("kids.chooseTopic")}</Text>
   <View style={styles.grid}>{([
    {emoji:"🦕",name:"kids.topic.dinosaurs",detail:"kids.topic.dinosaursDesc",type:"animal",tint:theme.colors.lilac},
    {emoji:"🦁",name:"kids.topic.animals",detail:"kids.topic.animalsDesc",type:"animal",tint:theme.colors.peach},
    {emoji:"🌍",name:"kids.topic.world",detail:"kids.topic.worldDesc",type:"place",tint:theme.colors.mint},
    {emoji:"🚀",name:"kids.topic.science",detail:"kids.topic.scienceDesc",type:"concept",tint:theme.colors.sky}
   ] as const).map(v=><View key={v.name} style={{width:width>=720?"48%":"100%"}}>
    <AdventureTile emoji={v.emoji} title={t(v.name)} detail={t(v.detail)} tint={v.tint}
      onPress={()=>{setFilter(v.type);setTab("explore");}}/></View>)}</View>
  </Screen>:null}
  {tab==="explore"?<Screen title={t("kids.explore.title")} subtitle={s.explore}>
   <View style={styles.row}>{(["all","animal","place","concept"] as const).map(k=><Pressable key={k}
    accessibilityRole="button" accessibilityState={{selected:filter===k}} onPress={()=>setFilter(k)}
    style={[styles.pill,filter===k&&styles.selected]}>
    <Text style={styles.pillText}>{s[k]}</Text></Pressable>)}</View>
   {examples.filter(q=>filter==="all"||q.type===filter).map(q=><Pressable key={q.name.en}
      accessibilityRole="button" onPress={()=>start(examples.indexOf(q))} style={styles.cardRow}>
     <Text style={styles.emoji}>{q.emoji}</Text><View style={{flex:1}}>
      <Text style={styles.title}>{local(q.name,lang)}</Text>
      <Text style={styles.detail}>{local(q.prompt,lang)}</Text>
      <Text style={styles.link}>▶ {s.play}</Text></View>
    </Pressable>)}
   {filter==="concept"?<Text style={styles.detail}>{t("native.noQuizzes")}</Text>:null}
  </Screen>:null}
  {tab==="challenge"?<Screen title={t("kids.challenge.title")} subtitle={s.begin}>
   <Banner emoji="🧩" title={t("native.play.chooseMode")} detail={s.begin} tint={theme.colors.sky}/>
   <Pressable accessibilityRole="button" style={styles.action} onPress={()=>start(0,true)}>
    <Text style={styles.actionText}>🎲 {s.begin}</Text></Pressable>
   <Text style={styles.detail}>{s.weekly}</Text>
  </Screen>:null}
  {tab==="treasures"?<Screen title={t("kids.treasures.title")} subtitle={s.privacy}>
   <Banner emoji="⭐" title={s.treasure} detail={s.privacy}/>
   <View style={styles.card}><Text style={styles.emoji}>🏅</Text>
    <Text style={styles.title}>⭐ 🥇 🎯</Text><Text style={styles.detail}>{s.privacy}</Text></View>
  </Screen>:null}
  {tab==="game"?<Screen title={finished?s.done:local(sample.name,lang)}
    subtitle={finished?s.privacy:local(sample.prompt,lang)}>
   {finished?<View style={styles.card}>
    <Text style={styles.emoji}>🏆</Text><Text style={styles.heading}>{score} / {examples.length}</Text>
    <Pressable accessibilityRole="button" style={styles.action} onPress={()=>start(0,true)}>
     <Text style={styles.actionText}>{s.again}</Text></Pressable>
   </View>:<>
    <View style={styles.progress}><Text style={styles.title}>{batch?round+1+"/"+examples.length:s.play}</Text>
      <Text style={styles.title}>{s.clue} {hint}/2</Text></View>
    <View style={styles.card}><Text style={styles.emoji}>{sample.emoji}</Text>
     {sample.clues.slice(0,hint).map((c,i)=><View key={i} style={styles.clue}>
      <Text style={styles.link}>✨ {s.clue} {i+1}</Text>
      <Text style={styles.title}>{local(c,lang)}</Text></View>)}
    </View>
    {answer!==null?<Text style={styles.heading}>{answer===sample.correct?s.correct:s.wrong}</Text>:null}
    <Text style={styles.heading}>{s.answer}</Text>
    {sample.answers.map((choice,i)=><Pressable key={i} accessibilityRole="button" disabled={answer!==null}
      style={[styles.option,answer===i&&styles.selected]} onPress={()=>choose(i)}>
      <Text style={styles.optionText}>{local(choice,lang)}</Text></Pressable>)}
    {answer===null&&hint<2?<Pressable accessibilityRole="button" style={styles.action}
       onPress={()=>setHint(2)}><Text style={styles.actionText}>✨ {s.reveal}</Text></Pressable>:null}
    {answer!==null&&answer!==sample.correct?<Pressable accessibilityRole="button"
      style={styles.action} onPress={()=>setAnswer(null)}><Text style={styles.actionText}>{s.again}</Text></Pressable>:null}
    {answer===sample.correct?<Pressable accessibilityRole="button" style={styles.action}
      onPress={()=>batch?next():setTab("explore")}>
      <Text style={styles.actionText}>{batch?s.next:s.back}</Text></Pressable>:null}
   </>}
  </Screen>:null}
 </View>;
}
const styles=StyleSheet.create({
 shell:{flex:1,minHeight:"100%",backgroundColor:theme.colors.background},
 header:{backgroundColor:theme.colors.card,flexDirection:"row",justifyContent:"space-between",
   padding:18,alignItems:"center",flexWrap:"wrap",gap:10},
 brand:{color:theme.colors.accent,fontSize:24,fontWeight:"900"},
 row:{flexDirection:"row",flexWrap:"wrap",gap:9},
 pill:{borderRadius:13,paddingHorizontal:14,paddingVertical:12,backgroundColor:theme.colors.card},
 selected:{backgroundColor:theme.colors.lilac},
 pillText:{fontSize:14,fontWeight:"800",color:theme.colors.ink},
 notice:{padding:15,backgroundColor:theme.colors.sky,gap:6},
 noticeTitle:{fontSize:12,fontWeight:"900",color:theme.colors.ink},
 detail:{fontSize:14,lineHeight:21,color:theme.colors.muted},
 nav:{flexDirection:"row",flexWrap:"wrap",gap:9,padding:12,backgroundColor:theme.colors.card},
 card:{padding:21,gap:11,backgroundColor:theme.colors.card,borderRadius:20},
 cardRow:{flexDirection:"row",gap:14,alignItems:"center",padding:20,backgroundColor:theme.colors.card,borderRadius:20},
 title:{fontSize:18,color:theme.colors.ink,fontWeight:"800"},
 heading:{fontSize:23,color:theme.colors.ink,fontWeight:"900"},
 link:{fontSize:14,color:theme.colors.accent,fontWeight:"800",paddingTop:7},
 grid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",gap:13},
 emoji:{fontSize:40},progress:{flexDirection:"row",justifyContent:"space-between",backgroundColor:theme.colors.lilac,padding:16,borderRadius:16},
 clue:{padding:10,borderTopWidth:1,borderColor:theme.colors.outline,gap:6},
 option:{padding:18,borderRadius:16,backgroundColor:theme.colors.peach},
 optionText:{fontSize:19,fontWeight:"800",textAlign:"center",color:theme.colors.ink},
 action:{borderRadius:16,padding:17,backgroundColor:theme.colors.accent,alignItems:"center"},
 actionText:{fontSize:17,fontWeight:"800",color:"#FFFFFF"}
});
