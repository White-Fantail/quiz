import { resultOgImage } from "../../../../../src/modules/platform/result-og-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request:Request,{params}:{params:Promise<{shareId:string}>}) {
  return resultOgImage((await params).shareId);
}
