/** Child usage dates are always derived from a trusted server instant and a guardian-selected IANA zone.
 * Never accept timestamps/durations from a native app. Handles daylight-saving boundaries. */
export function localChildDay(now:Date,timeZone:string):string {
 const parts=new Intl.DateTimeFormat("en-US",{
   timeZone,year:"numeric",month:"2-digit",day:"2-digit"
 }).formatToParts(now);
 const value=(key:string)=>parts.find(p=>p.type===key)?.value??"";
 return [value("year"),value("month"),value("day")].join("-");
}
export function utcMinuteSlot(now:Date):number {
 return Math.floor(now.getTime()/60000);
}
