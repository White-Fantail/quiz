/** Pack composition is immutable for readers; playability is a live projection.
 * Adult packs omit withdrawn members, but Kids packs fail closed as a unit.
 */
export function selectPlayablePackItems<T extends {quizId:string}>(
  original:readonly T[],approved:ReadonlySet<string>,lane:"GENERAL"|"KIDS"
):T[]{
  const selected=original.filter(item=>approved.has(item.quizId));
  return lane==="KIDS"&&selected.length!==original.length?[]:selected;
}
