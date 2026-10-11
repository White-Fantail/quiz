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

/** Native child capability is deliberately separate from adult Browser/Auth/MCP clients. */
export type NativeKidProfile = {nickname:string;ageBand:"EARLY"|"MIDDLE"|"OLDER";locale:Locale};
export type NativeKidSession = {active:true;profile:NativeKidProfile;expiresAt:string};
export type NativePairResult = NativeKidSession & {token:string};
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
  async unlock(token:string,pin:string):Promise<void> {
    const result=await this.request("POST","",token,{action:"unlock",pin});
    if(result?.unlocked!==true)throw new ApiError("invalid_unlock_response");
  }
}
