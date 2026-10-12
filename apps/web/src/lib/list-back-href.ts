/**
 * Rebuild a trusted list URL from allowlisted query parameters supplied to a
 * detail route. No redirect target or arbitrary URL is accepted from the client.
 */
export function listBackHref(base:string,params:Record<string,string|string[]|undefined>,keys:readonly string[]){
  const query=new URLSearchParams();
  for(const key of keys){
    const value=params[key];
    if(typeof value==="string"&&value.length<=200)query.set(key,value);
  }
  return base+(query.size?"?"+query.toString():"");
}
