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
  constructor(readonly code: string, readonly status?: number) { super(code); this.name="ApiError"; }
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
  constructor(origin: string, private readonly transport: typeof fetch=fetch, allowHttpLoopback=false) {
    this.origin=normalizeApiOrigin(origin,allowHttpLoopback);
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
