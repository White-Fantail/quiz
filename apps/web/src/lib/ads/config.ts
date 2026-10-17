/** Centralised, server-read web ad settings. Missing or invalid configuration fails closed. */
export const AD_PLACEMENTS=["HOME_BOTTOM","DISCOVER_FEED","PACK_LIST","PACK_DETAIL","PLAY_RESULT","SHARED_RESULT"] as const;
export type AdPlacement=(typeof AD_PLACEMENTS)[number];
export type AdsConfig={enabled:boolean;publisherId:string;slots:Record<AdPlacement,string>};
const slotKeys:Record<AdPlacement,string>={
  HOME_BOTTOM:"ADSENSE_SLOT_HOME_BOTTOM",
  DISCOVER_FEED:"ADSENSE_SLOT_DISCOVER_FEED",
  PACK_LIST:"ADSENSE_SLOT_PACK_LIST",
  PACK_DETAIL:"ADSENSE_SLOT_PACK_DETAIL",
  PLAY_RESULT:"ADSENSE_SLOT_PLAY_RESULT",
  SHARED_RESULT:"ADSENSE_SLOT_SHARED_RESULT"
};
export function publisherId(value:string|undefined):string{
  const id=value?.trim()??"";
  return /^ca-pub-\d{16}$/.test(id)?id:"";
}
export function getAdsConfig(env:Record<string,string|undefined>=process.env):AdsConfig{
  const id=publisherId(env.ADSENSE_CLIENT_ID);
  const enabled=env.ADSENSE_STATUS==="live"&&env.VERCEL_ENV==="production"&&
    env.ADSENSE_PRIVACY_READY==="true"&&Boolean(id);
  const slots=Object.fromEntries(AD_PLACEMENTS.map(placement=>{
    const raw=env[slotKeys[placement]]?.trim()??"";
    return [placement,/^\d{6,20}$/.test(raw)?raw:""];
  })) as Record<AdPlacement,string>;
  return {enabled,publisherId:id,slots};
}
export function canShowAd(config:AdsConfig,placement:AdPlacement,kids=false):boolean{
  return config.enabled&&!kids&&Boolean(config.publisherId&&config.slots[placement]);
}
