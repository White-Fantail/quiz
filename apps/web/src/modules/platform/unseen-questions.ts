/** Shared free-play selection rule: never recycle already encountered quiz IDs. */
export function selectUnseen<T extends {id:string}>(pool:readonly T[],excluded:Iterable<string>):T[] {
  const seen=new Set(excluded);
  return pool.filter(item=>!seen.has(item.id));
}
