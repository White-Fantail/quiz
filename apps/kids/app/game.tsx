import { useCallback,useEffect,useRef,useState, type PropsWithChildren } from "react";
import { ActivityIndicator,Alert,Animated,BackHandler,ScrollView,StyleSheet,Text,TextInput,View } from "react-native";
import { Redirect,useLocalSearchParams,useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useAudioPlayer } from "expo-audio";
import type { KidQuestion,KidRunResult,KidGuessResult,KidClue,LocalBundleQuestion } from "@quizdip/api-client";
import { ApiError } from "@quizdip/api-client";
import { activeImageStage, initialLocalProgress, guessLocalAnswer, revealLocalClue, localSummary,
 type LocalProgress } from "@quizdip/domain";
import { Screen } from "../src/components/Screen";
import { KidsEmojiIcon } from "../src/components/KidsIcon";
import { KidsTap } from "../src/components/KidsTap";
import { KidClueView,SafeKidMedia } from "../src/components/KidClueView";
import { useKidsLocale } from "../src/state/locale";
import { useKidsSession } from "../src/state/session";
import { useKidsTime } from "../src/state/time";
import { kidsApi } from "../src/services/api";
import { theme } from "../src/theme";

const SAVED="quizdip-kids-active-game-v1";
type LocalContent={id:string;questions:LocalBundleQuestion[]};
const progressKey=(id:string)=>"quizdip-kids-progress:"+id;
async function savedProgress(id:string):Promise<Record<number,LocalProgress>>{
 try{
   const key=progressKey(id),raw=await SecureStore.getItemAsync(key);
   if(!raw)return {};
   if(!raw.startsWith("chunks:"))return JSON.parse(raw);
   const count=Number(raw.slice(7));
   if(!Number.isInteger(count)||count<1||count>100)return {};
   const chunks=await Promise.all(Array.from({length:count},(_,i)=>
     SecureStore.getItemAsync(key+":"+i)));
   if(chunks.some(part=>part===null))return {};
   return JSON.parse(chunks.join(""));
 }catch{return {};}
}
async function persistProgress(id:string,progress:Record<number,LocalProgress>){
 try{
   // Chunk progress to avoid platform keychain value-size limitations.
   const key=progressKey(id),json=JSON.stringify(progress),size=1100;
   const chunks=json.match(new RegExp(".{1,"+size+"}","gs"))??["{}"];
   await Promise.all(chunks.map((chunk,i)=>SecureStore.setItemAsync(key+":"+i,chunk)));
   await SecureStore.setItemAsync(key,"chunks:"+chunks.length);
 }catch{/* A failed save must not block a quiz answer. */}
}
async function clearProgress(id:string){
 try{
   const key=progressKey(id),raw=await SecureStore.getItemAsync(key);
   const count=raw?.startsWith("chunks:")?Number(raw.slice(7)):0;
   await SecureStore.deleteItemAsync(key);
   for(let i=0;i<count&&i<100;i++)await SecureStore.deleteItemAsync(key+":"+i);
 }catch{}
}
// Tiny bundled cues need no network access. Audio failure never blocks gameplay.
function playCue(player:ReturnType<typeof useAudioPlayer>){
 void player.seekTo(0).then(()=>player.play()).catch(()=>{});
}
function PopIn({children,celebrate=false}:PropsWithChildren<{celebrate?:boolean}>) {
 const motion=useRef(new Animated.Value(0)).current;
 useEffect(()=>{
  const animation=Animated.spring(motion,{toValue:1,tension:celebrate?175:125,friction:celebrate?7:10,useNativeDriver:true});
  animation.start();
  return ()=>animation.stop();
 },[motion]);
 return <Animated.View style={{opacity:motion,transform:[{
  translateY:motion.interpolate({inputRange:[0,1],outputRange:[12,0]})
 },{scale:motion.interpolate({inputRange:[0,1],outputRange:[celebrate?0.77:0.97,1]})}]}}>{children}</Animated.View>;
}
type Ref= {kind:"run";runId:string;runToken:string;mode:"RANDOM_FIVE"|"PACK"} |
          {kind:"single";sessionId:string;sessionToken:string;options?:string[]};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function finished(v:KidQuestion|KidRunResult):v is KidRunResult {
 return "status" in v && v.status==="FINISHED" && !("sessionId" in v);
}
async function save(value:Ref|null) {
 if(value)await SecureStore.setItemAsync(SAVED,JSON.stringify(value),{
  keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
 });
 else await SecureStore.deleteItemAsync(SAVED);
}
async function read():Promise<Ref|null>{
 try {
  const raw=await SecureStore.getItemAsync(SAVED);
  if(!raw)return null;
  const v=JSON.parse(raw);
  if(v?.kind==="run" && uuid.test(v.runId) && /^[\w-]{32,200}$/.test(v.runToken) &&
   ["RANDOM_FIVE","PACK"].includes(v.mode))return v as Ref;
  if(v?.kind==="single" && uuid.test(v.sessionId) && /^[\w-]{32,200}$/.test(v.sessionToken))
   return v as Ref;
 }catch{/* Unknown state is not trusted. */}
 await save(null);
 return null;
}
export default function KidGameScreen(){
 const params=useLocalSearchParams<{quizId?:string;packId?:string;mode?:string}>();
 const kid=useKidsSession(),{t}=useKidsLocale(),router=useRouter();
 const time=useKidsTime();
 const clueCue=useAudioPlayer(require("../assets/feedback-clue.wav"),{updateInterval:1200});
 const successCue=useAudioPlayer(require("../assets/feedback-success.wav"),{updateInterval:1200});
 const retryCue=useAudioPlayer(require("../assets/feedback-try-again.wav"),{updateInterval:1200});
 useEffect(()=>{
  clueCue.volume=0.22;successCue.volume=0.30;retryCue.volume=0.22;
 },[clueCue,successCue,retryCue]);
 const localContent=useRef<LocalContent|null>(null);
 const localProgress=useRef<Record<number,LocalProgress>>({});
 const [reference,setReference]=useState<Ref|null>(null);
 const [question,setQuestion]=useState<KidQuestion|null>(null);
 const [summary,setSummary]=useState<KidRunResult|null>(null);
 const [result,setResult]=useState<KidGuessResult|null>(null);
 const [guess,setGuess]=useState("");
 const [reportNotice,setReportNotice]=useState("");
 const [reportOpen,setReportOpen]=useState(false);
 const [dismissedBreak,setDismissedBreak]=useState(-1);
 const [pending,setPending]=useState(false);
 const pendingRef=useRef(false);
 const [busyAction,setBusyAction]=useState<"clue"|"guess"|"next"|null>(null);
 const [selectedAnswer,setSelectedAnswer]=useState<string|null>(null);
 const scrollRef=useRef<ScrollView>(null);
 const focusClue=useRef(0);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const boot=useRef("");
 const token=kid.status==="active"?kid.token:null;
 const syncLocal=(ref:Ref,deviceToken:string)=>{
  if(!kidsApi)return;
  const progress=localProgress.current;
  const id=ref.kind==="run"?ref.runId:ref.sessionId;
  void persistProgress(id,progress);
  if(ref.kind==="run"){
    const results=Object.entries(progress).filter(([,p])=>p.status!=="ACTIVE")
      .map(([position,p])=>({position:Number(position),cluesUsed:p.clueIndex,
        status:p.status as "SOLVED"|"FAILED",score:p.score}));
    if(results.length)void kidsApi.runSync(deviceToken,ref.runId,ref.runToken,results)
      .then(async()=>{
        if(localContent.current?.id!==ref.runId ||
           results.length!==localContent.current.questions.length)return;
        const stored=await read();
        if(stored?.kind==="run"&&stored.runId===ref.runId){await save(null);await clearProgress(ref.runId);}
      }).catch(()=>{});
  }else{
    const p=progress[0];
    if(p?.status==="SOLVED"||p?.status==="FAILED")
      void kidsApi.singleSync(deviceToken,ref.sessionId,ref.sessionToken,{
        cluesUsed:p.clueIndex,status:p.status,score:p.score
      }).then(async()=>{
        const stored=await read();
        if(stored?.kind==="single"&&stored.sessionId===ref.sessionId){await save(null);await clearProgress(ref.sessionId);}
      }).catch(()=>{});
  }
 };
 const retrieve=useCallback(async(ref:Ref,deviceToken:string)=>{
  if(!kidsApi)throw new ApiError("missing_api_origin");
  const id=ref.kind==="run"?ref.runId:ref.sessionId;
  if(localContent.current?.id!==id){
    let questions:LocalBundleQuestion[];
    let progressOnServer:Array<LocalProgress&{position:number}>;
    if(ref.kind==="run"){
      const data=await kidsApi.runBundle(deviceToken,ref.runId,ref.runToken);
      questions=data.questions;
      progressOnServer=data.progress;
    }else{
      const data=await kidsApi.singleBundle(deviceToken,ref.sessionId,ref.sessionToken);
      questions=[data.question];
      progressOnServer=[data.progress];
    }
    const age=kid.status==="active"?kid.session.profile.ageBand:"OLDER";
    if(age!=="OLDER"){
      for(const q of questions){
        if(q.answer.responseMode==="multiple-choice")continue;
        const correct=q.answer.canonical;
        const decoys=[...new Set(questions.filter(item=>item.quizId!==q.quizId)
          .map(item=>item.answer.canonical).filter(value=>value!==correct))];
        const needed=age==="EARLY"?1:2;
        if(decoys.length>=needed){
          const options=[correct,...decoys.slice(0,Math.min(3,decoys.length))];
          // Display multiple-choice without altering the original question's scoring rule.
          const shift=q.position%options.length;
          q.options=[...options.slice(shift),...options.slice(0,shift)];
          q.responseMode="multiple-choice";
        }
      }
    }
    if(ref.kind==="single"&&ref.options?.length){
      questions[0].options=ref.options;
      questions[0].responseMode="multiple-choice";
    }
    localContent.current={id,questions};
    localProgress.current=await savedProgress(id);
    for(const p of progressOnServer)
      if(!localProgress.current[p.position])localProgress.current[p.position]=p;
  }
  const content=localContent.current;
  const index=content.questions.findIndex(q=>
    !localProgress.current[q.position]||localProgress.current[q.position].status==="ACTIVE");
  if(index<0){
    const totals=localSummary(Object.values(localProgress.current));
    setSummary({runId:id,status:"FINISHED",completed:totals.completed,total:content.questions.length,
      score:totals.score,solved:totals.solved,failed:totals.failed,official:false});
    setQuestion(null);syncLocal(ref,deviceToken);return;
  }
  const q=content.questions[index],p=localProgress.current[q.position]??initialLocalProgress();
  // Reuse the existing native UI model while gameplay is entirely local.
  const sessionId=ref.kind==="run"
    ?`local-run:${ref.runId}:${q.position}`:`local-single:${ref.sessionId}`;
  const current:KidQuestion={sessionId,sessionToken:ref.kind==="run"?ref.runToken:ref.sessionToken,
    quizId:q.quizId,title:q.title,prompt:q.prompt,promptMediaIds:q.promptMediaIds,
    clues:q.clues.slice(0,p.clueIndex) as unknown as KidClue[],clueIndex:p.clueIndex,
    clueCount:q.clues.length,sessionStatus:p.status,
    canGuess:p.status==="ACTIVE"&&!p.mustReveal,
    responseMode:q.responseMode??q.answer.responseMode??"text",options:q.options??q.answer.options,
    ...(ref.kind==="run"?{runId:ref.runId,runToken:ref.runToken,
      round:q.position+1,total:content.questions.length}:{})};
  setSummary(null);setQuestion(current);
  setResult(null);setGuess("");
  syncLocal(ref,deviceToken);
 },[kid.status,kid.status==="active"?kid.session.profile.ageBand:null]);
 useEffect(()=>{
  if(!token || !kidsApi)return;
  const key=token+":"+(params.quizId??"")+":"+(params.packId??"")+":"+(params.mode??"");
  if(boot.current===key)return;
  boot.current=key;
  let active=true;
  setQuestion(null);setSummary(null);setResult(null);setSelectedAnswer(null);setError("");setLoading(true);
  void (async()=>{
   const beganAt=Date.now();
   try{
    let ref:Ref|null=null;
    if(params.packId&&uuid.test(params.packId)){
      const started=await kidsApi!.startPack(token,params.packId);
      ref={kind:"run",runId:started.runId,runToken:started.runToken,mode:"PACK"};
      // Save alongside initial question lookup below.
    }else if(params.quizId && uuid.test(params.quizId)){
      const started=await kidsApi!.startSingle(token,params.quizId);
      ref={kind:"single",sessionId:started.sessionId,sessionToken:started.sessionToken,options:started.options};
      // Save alongside initial question lookup below.
    }else if(params.mode==="RANDOM_FIVE"){
      const started=await kidsApi!.startRun(token,params.mode);
      ref={kind:"run",runId:started.runId,runToken:started.runToken,mode:params.mode};
      // Save alongside initial question lookup below.
    }else ref=await read();
    if(!active)return;
    if(!ref){setError(t("native.play.noActive"));return;}
    setReference(ref);
    await Promise.all([params.packId||params.quizId||params.mode==="RANDOM_FIVE"?save(ref):Promise.resolve(),retrieve(ref,token)]);
   }catch(e){
    if(!active)return;
    if(e instanceof ApiError && [401,403,404,409,410].includes(e.status??0))await save(null);
    setError(e instanceof ApiError && e.code==="not_enough_questions"
      ?t("native.play.notEnough"):t("native.play.error"));
   }finally{
     if(__DEV__ && Date.now()-beganAt>300)console.info("[Kids perf] load game",Date.now()-beganAt,"ms");
     if(active)setLoading(false);
   }
  })();
  return ()=>{active=false;};
 },[token,params.quizId,params.packId,params.mode,retrieve,t]);
 const guarded=async(action:"clue"|"guess"|"next",task:()=>Promise<void>)=>{
  if(pendingRef.current)return;
  const beganAt=Date.now();
  pendingRef.current=true;setPending(true);setBusyAction(action);setError("");
  try{await task();}
  catch(e){
    const withdrawn=e instanceof ApiError &&
      ["kid_content_withdrawn","kid_media_withdrawn","question_suspended","pack_unavailable","kid_pack_changed","kid_pack_locale"].includes(e.code);
    if(withdrawn){await save(null);setQuestion(null);setSummary(null);setReference(null);}
    if(e instanceof ApiError && [401,403].includes(e.status??0))void kid.reload();
    setError(withdrawn?t("native.play.withdrawn"):t("native.play.error"));
  }
  finally{
    if(__DEV__ && Date.now()-beganAt>300)console.info("[Kids perf]",action,Date.now()-beganAt,"ms");
    pendingRef.current=false;setPending(false);setBusyAction(null);setSelectedAnswer(null);
  }
 };
 const clue=()=>void guarded("clue",async()=>{
   if(!token||!question||!kidsApi)return;
   if(!reference||!localContent.current)return;
   const q=localContent.current.questions.find(v=>v.quizId===question.quizId);
   if(!q)return;
   const next=revealLocalClue(q,localProgress.current[q.position]??initialLocalProgress());
   localProgress.current[q.position]=next;
   focusClue.current=next.clueIndex;
   playCue(clueCue);
   setQuestion(prev=>prev&&prev.sessionId===question.sessionId?{
      ...prev,clues:q.clues.slice(0,next.clueIndex) as unknown as KidClue[],
      clueIndex:next.clueIndex,clueCount:q.clues.length,canGuess:true
   }:prev);
   syncLocal(reference,token);
   setResult(null);
 });
 const submit=(answer:string)=>void guarded("guess",async()=>{
   setSelectedAnswer(answer);
   if(!token||!question||!kidsApi||!question.canGuess)return;
   if(!reference||!localContent.current)return;
   const q=localContent.current.questions.find(v=>v.quizId===question.quizId);
   if(!q)return;
   const attempt=guessLocalAnswer(q,localProgress.current[q.position]??initialLocalProgress(),answer);
   if(!attempt)return;
   localProgress.current[q.position]=attempt.progress;
   const v:KidGuessResult=attempt.result;
   setResult(v);setGuess("");
   playCue(v.correct?successCue:retryCue);
   setQuestion(prev=>prev?{...prev,sessionStatus:v.status,canGuess:false}:prev);
   syncLocal(reference,token);
 });
 const sendReport=(reason:"UNSAFE"|"INCORRECT"|"BROKEN_MEDIA")=>{
   if(!token||!question||!kidsApi)return;
   const id=question.quizId;
   setReportOpen(false);
   void kidsApi.report(token,id,reason).then(()=>setReportNotice(t("native.report.thanks")))
     .catch(()=>setReportNotice(t("native.report.failed")));
 };
 const next=()=>void guarded("next",async()=>{
   if(!token||!reference)return;
   if(reference.kind==="single"){
     router.replace("/explore");
     return;
   }
   await retrieve(reference,token);
   setResult(null);setGuess("");
   scrollRef.current?.scrollTo({y:0,animated:false});
 });
 // Leaving a game is a child-safe in-app action, not an exit from Kids mode.
 // The signed game reference is already stored in SecureStore for Challenge > Resume.
 const confirmLeave=useCallback(()=>{
   Alert.alert(t("native.play.leaveTitle"),
     t(reference?"native.play.leaveMessage":"native.play.leaveLoadingMessage"),[
       {text:t("kids.guardian.cancel"),style:"cancel"},
       {text:t("native.play.leave"),onPress:()=>router.replace("/")}
     ],{cancelable:true});
 },[reference,router,t]);
 useEffect(()=>{
   if(kid.status!=="active" || time.status!=="allowed" || summary)return;
   const subscription=BackHandler.addEventListener("hardwareBackPress",()=>{
     confirmLeave();
     return true;
   });
   return ()=>subscription.remove();
 },[kid.status,time.status,summary,confirmLeave]);
 const leaveButton=<KidsTap accessibilityRole="button"
    accessibilityLabel={t("native.play.leave")} onPress={confirmLeave}
    style={({pressed})=>[styles.exitButton,{opacity:pressed?0.75:1}]}>
    <KidsEmojiIcon emoji="🏠" size={19} color={theme.colors.accent}/>
    <Text style={styles.exitText}>{t("native.play.leave")}</Text>
 </KidsTap>;
 if(kid.status!=="active"){
   if(kid.status==="checking")return <Screen title="QuizDip Kids"><ActivityIndicator/></Screen>;
   return <Redirect href="/setup"/>;
 }
 if(time.status==="blocked")return <Redirect href="/time-up" />;
 if(time.status==="checking")return <Screen title={t("native.session.checking")}><ActivityIndicator/></Screen>;
 if(loading)return <Screen title={t("native.play.loading")} headerAction={leaveButton}>
   <View style={styles.waiting}><ActivityIndicator size="large" color={theme.colors.accent}/>
     <Text style={styles.waitingText}>{t("native.play.loading")}</Text></View>
 </Screen>;
 if(error&&!question&&!summary)return <Screen title={t("native.play.error")}>
   <Text style={styles.note}>{error}</Text>
   <KidsTap accessibilityRole="button" style={styles.button} onPress={()=>router.replace("/explore")}>
     <Text style={styles.buttonText}>{t("native.play.back")}</Text>
   </KidsTap>
 </Screen>;
 if(summary)return <Screen title={t("native.play.complete")}>
   <PopIn celebrate>
   <View style={styles.results}>
     <KidsEmojiIcon emoji="🏆" size={65} color={theme.colors.accent}/>
     <Text style={styles.heading}>{t("native.play.wellDone")}</Text>
     <Text style={styles.score}>{summary.score} {t("native.play.points")}</Text>
     <Text style={styles.note}>{summary.solved} / {summary.completed} {t("native.play.correct")}</Text>
   </View>
   </PopIn>
   <KidsTap accessibilityRole="button" onPress={()=>router.replace("/treasures")} style={styles.button}>
     <View style={styles.inline}><KidsEmojiIcon emoji="⭐" size={20} color="#FFFFFF"/><Text style={styles.buttonText}>{t("kids.nav.treasures")}</Text></View>
   </KidsTap>
   <KidsTap accessibilityRole="button" onPress={()=>router.replace(reference?.kind==="run"&&reference.mode==="PACK"?"/packs":"/challenge")} style={styles.secondary}>
     <Text style={styles.secondaryText}>{t("native.play.back")}</Text>
   </KidsTap>
 </Screen>;
 if(!question)return <Screen title={t("native.play.noActive")}>
   <KidsTap accessibilityRole="button" onPress={()=>router.replace(reference?.kind==="run"&&reference.mode==="PACK"?"/packs":"/challenge")} style={styles.button}>
     <Text style={styles.buttonText}>{t("native.play.back")}</Text>
   </KidsTap>
 </Screen>;
 const ended=result?.status==="SOLVED"||result?.status==="FAILED"||
   question.sessionStatus==="SOLVED"||question.sessionStatus==="FAILED";
 const age=kid.session.profile.ageBand;
 const reminderEvery=time.time?.limits.breakEveryMinutes??0;
 const reminderNumber=reminderEvery>0?Math.floor((time.time?.sessionMinutesUsed??0)/reminderEvery):0;
 return <Screen title={question.title} subtitle={question.prompt} headerAction={leaveButton} scrollRef={scrollRef}>
   {reminderNumber>0 && reminderNumber!==dismissedBreak?<KidsTap accessibilityRole="button"
     style={styles.restNotice} onPress={()=>setDismissedBreak(reminderNumber)}>
     <View style={styles.inline}><KidsEmojiIcon emoji="🍎" size={22}/><Text style={styles.restText}>{t("native.time.reminder")}</Text></View>
     <Text style={styles.note}>{t("native.time.dismiss")}</Text>
   </KidsTap>:null}
   <View style={styles.progress}>
     <Text style={styles.progressText}>{question.round?
       t("native.play.question")+" "+question.round+" / "+(question.total??5):t("native.play.single")}</Text>
     <Text style={styles.progressText}>{t("native.play.hint")} {question.clueIndex} / {question.clueCount}</Text>
   </View>
   <View accessibilityLabel={t("native.play.hint")+" "+question.clueIndex+" / "+question.clueCount}
     style={styles.clueTrack}>
     <View style={[styles.clueFill,{width:`${Math.round(100*question.clueIndex/Math.max(1,question.clueCount))}%` as const}]}/>
   </View>
   {(Array.isArray(question.promptMediaIds)?question.promptMediaIds:[]).map(id=>
      <SafeKidMedia key={"prompt:"+id} token={token!} mediaId={id}
        sessionId={question.sessionId} sessionToken={question.sessionToken}/>)}
   {(question.clues??[]).map((clue,i)=>{
     const stage=activeImageStage(question.clues,i);
     if(!stage&&!clue.text&&!clue.map)return null;
     return <View key={clue.id??String(i)} onLayout={e=>{
      if(focusClue.current===i+1){focusClue.current=0;
       scrollRef.current?.scrollTo({y:Math.max(0,e.nativeEvent.layout.y+95),animated:true});
      }
    }}><PopIn>
     <View style={styles.inline}><KidsEmojiIcon emoji="✨" size={18} color={theme.colors.accent}/><Text style={styles.hintLabel}>{t("native.play.hint")} {i+1}</Text></View>
     <KidClueView clue={clue} mediaStage={stage} token={token!} sessionId={question.sessionId}
       sessionToken={question.sessionToken}/>
   </PopIn></View>})}
   {result?<PopIn celebrate={result.correct}><View accessibilityLiveRegion="polite" style={[styles.feedback,result.correct?styles.success:styles.tryAgain]}>
     <View style={styles.inline}><KidsEmojiIcon emoji={result.correct?"🎉":"💡"} size={32}/><Text style={styles.feedbackTitle}>{result.correct?"★ ★ ★":"✦ ✦ ✦"}</Text></View>
     <Text style={styles.feedbackText}>{result.correct?t("native.play.correctMessage"):
       ended?t("native.play.tryNextTime"):t("native.play.nextHint")}</Text>
     {result.answer?<Text style={styles.note}>{t("native.play.answer")} {result.answer}</Text>:null}
     {ended?<Text style={styles.note}>+{result.score} {t("native.play.points")}</Text>:null}
   </View></PopIn>:null}
   {error?<Text accessibilityRole="alert" style={styles.warning}>{error}</Text>:null}
   {!ended?<>
     {question.canGuess?<>
       {(question.responseMode==="multiple-choice" || age!=="OLDER") && (question.options?.length??0)>=2?
         <View style={styles.options}>
           {(question.options??[]).map(option=>
             <KidsTap key={option} disabled={pending} accessibilityRole="button"
               accessibilityState={{busy:pending&&selectedAnswer===option,selected:selectedAnswer===option}}
                style={[styles.option,selectedAnswer===option&&styles.optionSelected]} onPress={()=>submit(option)}>
               <View style={styles.optionRow}><Text style={styles.optionText}>{option}</Text>
                 {selectedAnswer===option&&pending?<ActivityIndicator color={theme.colors.accent}/>:null}</View>
             </KidsTap>)}
         </View>:
         <View style={styles.answer}>
           <TextInput value={guess} onChangeText={setGuess} maxLength={200}
             autoCorrect={false} returnKeyType="done"
              onSubmitEditing={()=>{if(!pending&&guess.trim())submit(guess.trim());}}
              placeholder={t("native.play.placeholder")}
             accessibilityLabel={t("native.play.placeholder")} style={styles.field}/>
           <KidsTap accessibilityRole="button" disabled={pending||!guess.trim()} style={styles.button}
             onPress={()=>submit(guess.trim())}><View style={styles.inline}>
               {busyAction==="guess"?<ActivityIndicator color="#FFFFFF"/>:null}
               <Text style={styles.buttonText}>{t("native.play.guess")}</Text></View></KidsTap>
         </View>}
     </>:null}
     {question.clueIndex<question.clueCount?
       <KidsTap accessibilityRole="button" disabled={pending} style={styles.secondary} onPress={clue}>
         <View style={styles.inline}>{busyAction==="clue"?<ActivityIndicator color={theme.colors.accent}/>:<KidsEmojiIcon emoji="✨" size={19}/>}
           <Text style={styles.secondaryText}>{t("native.play.reveal")}</Text></View>
       </KidsTap>:null}
   </>:null}
   {reportNotice?<Text accessibilityRole="alert" style={styles.note}>{reportNotice}</Text>:null}
   <KidsTap accessibilityRole="button" onPress={()=>setReportOpen(v=>!v)} style={styles.reportButton}>
     <View style={styles.inline}><KidsEmojiIcon emoji="🛡️" size={18} color={theme.colors.muted}/><Text style={styles.reportText}>{t("native.report.title")}</Text></View>
   </KidsTap>
   {reportOpen?<View style={styles.reportChoices}>
     <Text style={styles.note}>{t("native.report.help")}</Text>
     {([["UNSAFE","native.report.unsafe"],["INCORRECT","native.report.incorrect"],
       ["BROKEN_MEDIA","native.report.broken"]] as const).map(([reason,label])=>
       <KidsTap key={reason} accessibilityRole="button" style={styles.secondary}
         onPress={()=>sendReport(reason)}>
         <Text style={styles.secondaryText}>{t(label)}</Text>
       </KidsTap>)}
     <KidsTap accessibilityRole="button" onPress={()=>setReportOpen(false)}>
       <Text style={styles.note}>{t("kids.guardian.cancel")}</Text>
     </KidsTap>
   </View>:null}
   {ended?<KidsTap accessibilityRole="button" disabled={pending} style={styles.button} onPress={next}>
     <View style={styles.inline}>{busyAction==="next"?<ActivityIndicator color="#FFFFFF"/>:null}
      <Text style={styles.buttonText}>{reference?.kind==="single"?t("native.play.back"):t("native.play.continue")}</Text></View>
   </KidsTap>:null}
 </Screen>;
}
const styles=StyleSheet.create({
 exitButton:{minHeight:44,flexDirection:"row",alignItems:"center",justifyContent:"center",
   gap:5,backgroundColor:theme.colors.lilac,borderRadius:18,paddingHorizontal:13,paddingVertical:9},
 exitText:{fontSize:15,fontWeight:"800",color:theme.colors.accent},
 inline:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8},
 reportButton:{alignItems:"center",padding:14,borderRadius:14,backgroundColor:theme.colors.card},
 reportChoices:{backgroundColor:theme.colors.card,padding:16,borderRadius:18,gap:12},
 reportText:{fontSize:14,fontWeight:"700",color:theme.colors.muted},
 restNotice:{backgroundColor:theme.colors.peach,borderRadius:17,padding:17,gap:6},
 restText:{color:theme.colors.ink,fontSize:17,fontWeight:"800"},
 clueTrack:{height:9,borderRadius:9,overflow:"hidden",backgroundColor:theme.colors.outline},
 clueFill:{height:"100%",backgroundColor:theme.colors.accent,borderRadius:9},
 progress:{flexDirection:"row",justifyContent:"space-between",backgroundColor:theme.colors.lilac,padding:16,borderRadius:16,gap:10},
 progressText:{fontSize:15,fontWeight:"800",color:theme.colors.ink},
 hintLabel:{color:theme.colors.accent,fontWeight:"800",fontSize:15,paddingStart:5},
 note:{color:theme.colors.muted,fontSize:16,lineHeight:23},
 results:{backgroundColor:theme.colors.lilac,padding:30,borderRadius:24,alignItems:"center",gap:14},
 heading:{fontSize:26,fontWeight:"900",color:theme.colors.ink},
 score:{fontSize:34,color:theme.colors.accent,fontWeight:"900"},
 button:{padding:17,borderRadius:18,backgroundColor:theme.colors.accent,alignItems:"center"},
 buttonText:{fontSize:18,fontWeight:"900",color:"#FFFFFF"},
 secondary:{padding:17,borderRadius:18,backgroundColor:theme.colors.mint,alignItems:"center"},
 secondaryText:{fontSize:17,fontWeight:"800",color:theme.colors.ink},
 options:{gap:12},optionSelected:{borderColor:theme.colors.accent,borderWidth:3,backgroundColor:theme.colors.lilac},
 optionRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:10},
 feedbackTitle:{fontSize:18,fontWeight:"900",color:theme.colors.accent},
 waiting:{padding:48,gap:18,alignItems:"center"},waitingText:{fontSize:18,fontWeight:"800",color:theme.colors.muted},
 option:{backgroundColor:theme.colors.peach,minHeight:60,padding:16,borderRadius:17,justifyContent:"center"},
 optionText:{color:theme.colors.ink,fontSize:19,fontWeight:"800",textAlign:"center"},
 answer:{gap:12},field:{borderWidth:1,borderColor:theme.colors.outline,borderRadius:14,
   backgroundColor:theme.colors.card,padding:16,fontSize:19,color:theme.colors.ink},
 feedback:{padding:20,borderRadius:18,gap:10},feedbackText:{fontWeight:"900",fontSize:19,color:theme.colors.ink},
 success:{backgroundColor:theme.colors.mint},tryAgain:{backgroundColor:theme.colors.peach},
 warning:{color:theme.colors.error,fontWeight:"700"}
});
