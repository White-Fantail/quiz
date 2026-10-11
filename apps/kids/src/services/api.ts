import { QuizDipPublicApi, ApiError } from "@quizdip/api-client";

/** EXPO_PUBLIC values are public: only a dev HTTPS origin belongs here. */
const raw=process.env.EXPO_PUBLIC_QUIZDIP_API_URL?.trim();
export let apiConfigurationError: string | null = null;
export let publicApi: QuizDipPublicApi | null = null;
if(!raw) apiConfigurationError="missing_origin";
else {
  try { publicApi = new QuizDipPublicApi(raw,fetch,__DEV__); }
  catch(e) { apiConfigurationError=e instanceof ApiError?e.code:"invalid_origin"; }
}
