/** Per-run target count; old fixed-length runs predate this explicit column. */
export function runTargetCount(run: {mode:string;targetCount?:number|null}):number|null {
  return run.mode==="INFINITE" ? null : run.targetCount ?? 5;
}
export function completesRun(run: {mode:string;targetCount?:number|null;currentIndex:number}):boolean {
  const total=runTargetCount(run);
  return total!==null && run.currentIndex+1>=total;
}
