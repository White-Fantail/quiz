import { randomInt } from "node:crypto";

export type PackOrderMode="CREATOR"|"RANDOM";
/** Returns a new order without mutating the creator's saved membership.
 * Called only while a new pack run is allocated. Stored PlayRunQuestion
 * positions remain immutable for every subsequent round and resume.
 */
export function orderPackQuestions<T>(questions:readonly T[],mode:PackOrderMode,
  pick:(maxExclusive:number)=>number=randomInt):T[]{
  const result=[...questions];
  if(mode==="CREATOR")return result;
  if(mode!=="RANDOM")throw new Error("Unknown quiz pack order mode");
  for(let i=result.length-1;i>0;i--){
    const j=pick(i+1);
    if(!Number.isInteger(j)||j<0||j>i)throw new Error("Invalid random index");
    [result[i],result[j]]=[result[j],result[i]];
  }
  return result;
}
