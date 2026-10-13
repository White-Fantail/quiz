/** Recommended ages describe who a quiz fits; they never grant Kids safety approval.
 * Compare the whole profile age band rather than an arbitrary representative age.
 */
export type KidAgeBand = "EARLY"|"MIDDLE"|"OLDER";

const BANDS:Record<KidAgeBand,{minimum:number;maximum:number}>={
  EARLY:{minimum:4,maximum:7},
  MIDDLE:{minimum:8,maximum:10},
  OLDER:{minimum:11,maximum:12}
};

export function ageEligible(value:unknown,band?:KidAgeBand):boolean {
  if(!band||!value||typeof value!=="object")return true;
  const range=(value as {ageRange?:{minimum?:number;maximum?:number}}).ageRange;
  if(!range)return true;
  const group=BANDS[band];
  return !(typeof range.minimum==="number"&&range.minimum>group.maximum ||
    typeof range.maximum==="number"&&range.maximum<group.minimum);
}
