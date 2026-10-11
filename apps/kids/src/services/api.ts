import { QuizDipPublicApi, QuizDipKidsDeviceApi, ApiError } from "@quizdip/api-client";

/** Only a public backend origin is bundled. Child credentials live in SecureStore. */
const raw=process.env.EXPO_PUBLIC_QUIZDIP_API_URL?.trim();
export let apiConfigurationError:string|null=null;
export let publicApi:QuizDipPublicApi|null=null;
export let kidsApi:QuizDipKidsDeviceApi|null=null;
if(!raw)apiConfigurationError="missing_origin";
else try {
 publicApi=new QuizDipPublicApi(raw,fetch,__DEV__);
 kidsApi=new QuizDipKidsDeviceApi(raw,fetch,__DEV__);
}catch(e){apiConfigurationError=e instanceof ApiError?e.code:"invalid_origin";}
