import type { AnswerType } from "@quizdip/domain";
import type { Locale } from "@quizdip/i18n";

/** Public, read-only Kids preview contracts. Child device auth arrives in Phase 2. */
export type KidsCatalogItem = {
  id: string; title: string; prompt: string; answerType: AnswerType;
  clueCount: number; kidsEligible: true;
};
export type KidsCatalogPage = { items: KidsCatalogItem[]; hasMore: boolean };
export type KidsCatalogFilters = { answerType?: AnswerType; topic?: string; offset?: number; limit?: number };
export type HealthStatus = { status: "ok"; service: string };

export class ApiError extends Error {
  readonly code: string;
  readonly status?: number;
  constructor(code: string, status?: number) {
    super(code); this.name="ApiError"; this.code=code; this.status=status;
  }
}
export function normalizeApiOrigin(raw: string, allowHttpLoopback=false): string {
  let url: URL;
  try { url=new URL(raw); } catch { throw new ApiError("invalid_api_origin"); }
  const loopback=["localhost","127.0.0.1","10.0.2.2"].includes(url.hostname);
  if(url.protocol!=="https:" && !(allowHttpLoopback && url.protocol==="http:" && loopback))
    throw new ApiError("insecure_api_origin");
  if(url.username || url.password || url.search || url.hash || (url.pathname!=="/" && url.pathname!==""))
    throw new ApiError("invalid_api_origin");
  return url.origin;
}
export class QuizDipPublicApi {
  readonly origin: string;
  private readonly transport: typeof fetch;
  constructor(origin: string, transport: typeof fetch=fetch, allowHttpLoopback=false) {
    this.origin=normalizeApiOrigin(origin,allowHttpLoopback);
    this.transport=transport;
  }
  private async get(path: string, signal?: AbortSignal): Promise<unknown> {
    let response: Response;
    try { response=await this.transport(this.origin+path,{method:"GET",credentials:"omit",cache:"no-store",signal}); }
    catch { throw new ApiError("network_unavailable"); }
    if(!response.ok) throw new ApiError("http_error",response.status);
    try { return await response.json(); } catch { throw new ApiError("invalid_response"); }
  }
  async health(signal?: AbortSignal): Promise<HealthStatus> {
    const body=await this.get("/api/health",signal);
    if(!body || typeof body!=="object" || (body as any).status!=="ok") throw new ApiError("invalid_response");
    return { status:"ok",service:String((body as any).service??"quizdip") };
  }
  async kidsCatalog(locale: Locale, filters: KidsCatalogFilters={}, signal?: AbortSignal): Promise<KidsCatalogPage> {
    if(locale!=="en" && locale!=="ko") throw new ApiError("invalid_locale");
    const offset=filters.offset??0, limit=filters.limit??8;
    if(!Number.isInteger(offset)||offset<0||offset>100000 || !Number.isInteger(limit)||limit<1||limit>50)
      throw new ApiError("invalid_pagination");
    const params=new URLSearchParams({kids:"true",locale,offset:String(offset),limit:String(limit+1)});
    if(filters.answerType) params.set("answerType",filters.answerType);
    if(filters.topic) params.set("topic",filters.topic);
    const result=await this.get("/api/v1/quizzes?"+params.toString(),signal);
    const raw=(result as any)?.data?.items;
    if(!Array.isArray(raw)) throw new ApiError("invalid_response");
    // The server is the authority; refuse to display inconsistent or missing approval metadata.
    const safe=raw.filter((x: unknown): x is KidsCatalogItem =>
      !!x && typeof x==="object" && (x as any).kidsEligible===true &&
      typeof (x as any).id==="string" && typeof (x as any).title==="string" &&
      typeof (x as any).prompt==="string" && typeof (x as any).answerType==="string"
    );
    return { items:safe.slice(0,limit),hasMore:raw.length>limit };
  }
}


export type ImageRevealSettings = {effect:"blur"|"zoom"|"spotlight";strength:number;focusX?:number;focusY?:number};
export type KidClue = {id:string;order:number;type:"text"|"image"|"image-reveal"|"audio"|"video"|"map";
  text?:string;mediaId?:string;reveal?:ImageRevealSettings;map?:{latitude:number;longitude:number;zoom?:number}};
export type KidQuestion = {sessionId:string;sessionToken:string;quizId:string;
  title:string;prompt:string;promptMediaIds:string[];
  clues:KidClue[];clueIndex:number;clueCount:number;sessionStatus:"ACTIVE"|"SOLVED"|"FAILED";
  canGuess:boolean;options?:string[];round?:number;total?:number;score?:number;runId?:string;runToken?:string};
export type KidRunStart = {runId:string;runToken:string;mode:"RANDOM_FIVE"|"WEEKLY";
  lane:"KIDS";locale:Locale;status:string;total:number;completed:number;score:number};
export type KidRunResult = {runId:string;status:"FINISHED";completed:number;total:number;
  score:number;solved:number;failed:number;official:false};
export type KidGuessResult = {status:"ACTIVE"|"SOLVED"|"FAILED";correct:boolean;
  score:number;cluesUsed:number;answer?:string;next?:string};
export type KidPlayMedia = {mediaId:string;url:string;expiresInSeconds:number;kind:"image"|"audio"|"video";mimeType:string};
export type KidTreasures = {solved:number;completed:number;
  discoveries:{quizId:string;title:string;score:number;at:string}[];
  badges:{id:string;required:number;label:string;emoji:string}[]};


export type KidTimeState = {
 localDay:string;usedMinutes:number;remainingMinutes:number|null;
 sessionMinutesUsed:number;blockedUntil:string|null;limitReached:boolean;
 serverNow:string;limits:{dailyMinutes:number;playSessionMinutes:number;breakEveryMinutes:number;timeZone:string};
};
export type GuardianChildProfile = {
 id:string;nickname:string;ageBand:"EARLY"|"MIDDLE"|"OLDER";locale:Locale;sessionMinutes:number;
 dailyMinutes:number;playSessionMinutes:number;breakEveryMinutes:number;timeZone:string;
};
export type GuardianDevice = {id:string;profileId:string;deviceName:string;createdAt:string;expiresAt:string};
export type GuardianInsights = {profileId:string;solvedLast7Days:number;playedLast7Days:number;
 successRate:number;minutesLast7Days:number;usageByDay:{day:string;minutes:number}[];
 topTopics:{topic:string;count:number}[]};
export type GuardianDashboard = {pinConfigured:boolean;profiles:GuardianChildProfile[];
 devices:GuardianDevice[];insights:GuardianInsights[];serverNow:string;availableTimeZones:string[]};
export type ParentElevation = {parentToken:string;expiresAt:string};

/** Native child capability is deliberately separate from adult Browser/Auth/MCP clients. */
export type NativeKidProfile = {nickname:string;ageBand:"EARLY"|"MIDDLE"|"OLDER";locale:Locale};
export type NativeKidSession = {active:true;profile:NativeKidProfile;expiresAt:string};
export type NativePairResult = NativeKidSession & {token:string};
export type NativePairStart={deviceSecret:string;qrToken:string;shortCode:string;expiresAt:string};

export class QuizDipKidsDeviceApi {
  readonly origin:string;
  private readonly transport:typeof fetch;
  constructor(origin:string,transport:typeof fetch=fetch,allowHttpLoopback=false) {
    this.origin=normalizeApiOrigin(origin,allowHttpLoopback);
    this.transport=transport;
  }
  private async request(method:"GET"|"POST",url:string, token?:string, body?:unknown):Promise<any> {
    let response:Response;
    try {
      response=await this.transport(this.origin+"/api/kids/native"+url,{
        method,credentials:"omit",cache:"no-store",redirect:"error",
        headers:{"Accept":"application/json",...(body?{"Content-Type":"application/json"}:{}),
          ...(token?{Authorization:"Bearer "+token}:{})},
        ...(body?{body:JSON.stringify(body)}:{})
      });
    }catch { throw new ApiError("network_unavailable"); }
    let result:any;
    try { result=await response.json(); }
    catch { throw new ApiError("invalid_response",response.status); }
    if(!response.ok) throw new ApiError(typeof result?.error==="string"?result.error:"http_error",response.status);
    if(!result || typeof result!=="object" || !("data" in result)) throw new ApiError("invalid_response");
    return result.data;
  }
  private sessionData(data:any):NativeKidSession {
    const p=data?.profile;
    if(data?.active!==true || !p || typeof p.nickname!=="string" ||
      !["EARLY","MIDDLE","OLDER"].includes(p.ageBand) || !["en","ko"].includes(p.locale) ||
      typeof data.expiresAt!=="string" || !Number.isFinite(Date.parse(data.expiresAt)))
      throw new ApiError("invalid_session_response");
    return {active:true,profile:{nickname:p.nickname,ageBand:p.ageBand,locale:p.locale},expiresAt:data.expiresAt};
  }
  private async pairRequest(body:object):Promise<any> {
    let response:Response;
    try {
      response=await this.transport(this.origin+"/api/kids/native/pair",{
        method:"POST",credentials:"omit",cache:"no-store",redirect:"error",
        headers:{"Accept":"application/json","Content-Type":"application/json"},
        body:JSON.stringify(body)
      });
    }catch{throw new ApiError("network_unavailable");}
    let result:any;
    try{result=await response.json();}catch{throw new ApiError("invalid_response",response.status);}
    if(!response.ok)throw new ApiError(typeof result?.error==="string"?result.error:"http_error",response.status);
    if(!result?.data || typeof result.data!=="object")throw new ApiError("invalid_response");
    return result.data;
  }
  async beginPair(deviceName:string):Promise<NativePairStart> {
    const data=await this.pairRequest({action:"start",deviceName});
    if(typeof data.deviceSecret!=="string" || !/^[A-Za-z0-9_-]{40,90}$/.test(data.deviceSecret) ||
      typeof data.qrToken!=="string" || !/^[A-Za-z0-9_-]{24}$/.test(data.qrToken) ||
      typeof data.shortCode!=="string" || !/^[0-9]{6}$/.test(data.shortCode) ||
      typeof data.expiresAt!=="string" || !Number.isFinite(Date.parse(data.expiresAt)))
      throw new ApiError("invalid_pair_response");
    return data as NativePairStart;
  }
  async claimPair(deviceSecret:string):Promise<NativePairResult|null> {
    const data=await this.pairRequest({action:"claim",deviceSecret});
    if(data.status==="pending")return null;
    if(data.status!=="paired" || typeof data.token!=="string" ||
      !/^[A-Za-z0-9_-]{40,90}$/.test(data.token))throw new ApiError("invalid_pair_response");
    return {...this.sessionData({...data,active:true}),token:data.token};
  }
  async pair(code:string,deviceName:string):Promise<NativePairResult> {
    const data=await this.request("POST","",undefined,{action:"pair",code,deviceName});
    if(typeof data?.token!=="string" || !/^[A-Za-z0-9_-]{40,90}$/.test(data.token))
      throw new ApiError("invalid_pair_response");
    return {...this.sessionData({...data,active:true}),token:data.token};
  }
  async session(token:string):Promise<NativeKidSession> {
    return this.sessionData(await this.request("GET","?view=session",token));
  }
  async catalog(token:string, filters:KidsCatalogFilters={}, locale?:Locale):Promise<KidsCatalogPage> {
    const offset=filters.offset??0,limit=filters.limit??8;
    if(!Number.isInteger(offset) || offset<0 || offset>100000 || !Number.isInteger(limit) ||
      limit<1 || limit>29) throw new ApiError("invalid_pagination");
    const params=new URLSearchParams({view:"catalog",offset:String(offset),limit:String(limit+1)});
    if(filters.answerType)params.set("answerType",filters.answerType);
    if(filters.topic)params.set("topic",filters.topic);
    if(locale)params.set("locale",locale); // Server verifies this against the guardian-pinned profile.
    const data=await this.request("GET","?"+params,token);
    const raw=data?.items;
    if(!Array.isArray(raw)) throw new ApiError("invalid_response");
    const safe=raw.filter((x:any)=>x && typeof x.id==="string" &&
      typeof x.title==="string" && typeof x.prompt==="string" && x.kidsEligible===true);
    return {items:safe.slice(0,limit),hasMore:raw.length>limit};
  }

  private async playRequest<T>(token:string,action:Record<string,unknown>):Promise<T> {
    let response:Response;
    try {response=await this.transport(this.origin+"/api/kids/native/play",{
      method:"POST",credentials:"omit",cache:"no-store",redirect:"error",
      headers:{"Accept":"application/json","Content-Type":"application/json",Authorization:"Bearer "+token},
      body:JSON.stringify(action)
    });}catch{throw new ApiError("network_unavailable");}
    let body:any;
    try{body=await response.json();}catch{throw new ApiError("invalid_response",response.status);}
    if(!response.ok)throw new ApiError(typeof body?.error==="string"?body.error:"http_error",response.status);
    if(!body||typeof body!=="object"||!("data" in body))throw new ApiError("invalid_response");
    return body.data as T;
  }
  async startRun(token:string,mode:"RANDOM_FIVE"|"WEEKLY",avoidQuizIds:string[]=[]):Promise<KidRunStart> {
    return this.playRequest(token,{action:"run_start",mode,avoidQuizIds});
  }
  async currentRun(token:string,runId:string,runToken:string):Promise<KidQuestion|KidRunResult> {
    return this.playRequest(token,{action:"run_current",runId,runToken});
  }
  async startSingle(token:string,quizId:string):Promise<{sessionId:string;sessionToken:string}> {
    return this.playRequest(token,{action:"single_start",quizId});
  }
  async currentSingle(token:string,sessionId:string,sessionToken:string):Promise<KidQuestion> {
    return this.playRequest(token,{action:"single_current",sessionId,sessionToken});
  }
  async nextClue(token:string,sessionId:string,sessionToken:string):Promise<{clue:KidClue;clueIndex:number;clueCount:number}>{
    return this.playRequest(token,{action:"clue",sessionId,sessionToken});
  }
  async guess(token:string,sessionId:string,sessionToken:string,guess:string):Promise<KidGuessResult> {
    return this.playRequest(token,{action:"guess",sessionId,sessionToken,guess});
  }
  async playMedia(token:string,sessionId:string,sessionToken:string,mediaId:string):Promise<KidPlayMedia> {
    const media=await this.playRequest<KidPlayMedia>(token,{action:"media",sessionId,sessionToken,mediaId});
    if(!media||!["image","audio","video"].includes(media.kind)||
      typeof media.url!=="string"||!media.url.startsWith("https://"))
      throw new ApiError("invalid_media_response");
    return media;
  }
  async treasures(token:string):Promise<KidTreasures> {
    let response:Response;
    try{response=await this.transport(this.origin+"/api/kids/native/play?view=treasures",{
      method:"GET",credentials:"omit",cache:"no-store",redirect:"error",
      headers:{"Accept":"application/json",Authorization:"Bearer "+token}
    });}catch{throw new ApiError("network_unavailable");}
    const result=await response.json().catch(()=>null);
    if(!response.ok)throw new ApiError(typeof result?.error==="string"?result.error:"http_error",response.status);
    if(!result?.data||!Array.isArray(result.data.badges)||!Array.isArray(result.data.discoveries))
      throw new ApiError("invalid_response");
    return result.data as KidTreasures;
  }

  async report(token:string,quizId:string,reason:"UNSAFE"|"INCORRECT"|"BROKEN_MEDIA"):Promise<{reported:true}> {
    return this.playRequest(token,{action:"report",quizId,reason});
  }
  async time(token:string,heartbeat=false):Promise<KidTimeState> {
    let response:Response;
    try{response=await this.transport(this.origin+"/api/kids/native/time",{
      method:heartbeat?"POST":"GET",credentials:"omit",cache:"no-store",redirect:"error",
      headers:{"Accept":"application/json",Authorization:"Bearer "+token,
        ...(heartbeat?{"Content-Type":"application/json"}:{})},
      ...(heartbeat?{body:JSON.stringify({action:"heartbeat"})}:{})
    });}catch{throw new ApiError("network_unavailable");}
    const body=await response.json().catch(()=>null);
    if(!response.ok)throw new ApiError(typeof body?.error==="string"?body.error:"http_error",response.status);
    if(typeof body?.data?.usedMinutes!=="number" || !body.data.limits)
      throw new ApiError("invalid_time_response");
    return body.data as KidTimeState;
  }
  async unlock(token:string,pin:string):Promise<void> {
    const result=await this.request("POST","",token,{action:"unlock",pin});
    if(result?.unlocked!==true)throw new ApiError("invalid_unlock_response");
  }
}

/** Parent privilege is short-lived and memory-only. No Better Auth cookie is sent to the app. */
export class QuizDipKidsParentApi {
  readonly origin:string;
  private readonly transport:typeof fetch;
  constructor(origin:string,transport:typeof fetch=fetch,allowHttpLoopback=false){
    this.origin=normalizeApiOrigin(origin,allowHttpLoopback);
    this.transport=transport;
  }
  private async request<T>(token:string,parentToken:string|null,action?:Record<string,unknown>):Promise<T>{
    let response:Response;
    try{response=await this.transport(this.origin+"/api/kids/native/parent",{
      method:action?"POST":"GET",credentials:"omit",cache:"no-store",redirect:"error",
      headers:{"Accept":"application/json",Authorization:"Bearer "+token,
        ...(parentToken?{"X-Kids-Parent":"Bearer "+parentToken}:{}),
        ...(action?{"Content-Type":"application/json"}:{})},
      ...(action?{body:JSON.stringify(action)}:{})
    });}catch{throw new ApiError("network_unavailable");}
    const body=await response.json().catch(()=>null);
    if(!response.ok)throw new ApiError(typeof body?.error==="string"?body.error:"http_error",response.status);
    if(body?.data===undefined)throw new ApiError("invalid_response");
    return body.data as T;
  }
  async authorize(deviceToken:string,pin:string):Promise<ParentElevation>{
    const value=await this.request<ParentElevation>(deviceToken,null,{action:"authorize",pin});
    if(!/^[A-Za-z0-9_-]{40,90}$/.test(value?.parentToken??"")||
       !Number.isFinite(Date.parse(value.expiresAt)))throw new ApiError("invalid_parent_response");
    return value;
  }
  async dashboard(deviceToken:string,parentToken:string):Promise<GuardianDashboard>{
    return this.request(deviceToken,parentToken);
  }
  async action<T=unknown>(deviceToken:string,parentToken:string,action:Record<string,unknown>):Promise<T>{
    if(action.action==="authorize")throw new ApiError("invalid_parent_action");
    return this.request<T>(deviceToken,parentToken,action);
  }
}
