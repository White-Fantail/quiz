/** Allow only same-site media library returns; drop unrelated URL parameters. */
export function mediaLibraryReturnHref(candidate:string|undefined,fallback:string):string {
  if(!candidate||candidate.length>1500)return fallback;
  try {
    const url=new URL(candidate,"https://quizdip.local");
    if(url.origin!=="https://quizdip.local"||!/^\/(?:(?:en|ko)\/)?studio\/media\/?$/.test(url.pathname))return fallback;
    const params=new URLSearchParams();
    for(const key of ["q","kind","moderation","status","usage","sort","page"]){
      const value=url.searchParams.get(key);
      if(value&&value.length<=200)params.set(key,value);
    }
    return url.pathname+(params.size?"?"+params.toString():"");
  }catch{return fallback;}
}
