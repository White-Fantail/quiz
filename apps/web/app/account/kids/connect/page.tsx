import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "../../../../src/lib/auth";
import { resolveLocale,localizeHref } from "../../../../src/i18n/core";
import PairApproval from "../pair-approval";

export const dynamic="force-dynamic";
export const metadata={title:"Connect QuizDip Kids",referrer:"no-referrer" as const};

export default async function ConnectPage({searchParams}:{
 searchParams:Promise<{token?:string}>
}){
 const locale=resolveLocale((await headers()).get("x-quizdip-locale"));
 const params=await searchParams;
 const token=typeof params.token==="string"&&/^[A-Za-z0-9_-]{24}$/.test(params.token)?params.token:"";
 let signedIn=false,unavailable=false;
 try{signedIn=!!(await auth.api.getSession({headers:await headers()}))?.user?.id;}
 catch{unavailable=true;}
 const here=localizeHref("/account/kids/connect?token="+encodeURIComponent(token),locale);
 return <main className="container inner-page">
   <span className="small-tag">QuizDip Kids</span>
   {!token?<section className="placeholder-panel">
     <h1>{locale==="ko"?"QR 코드가 올바르지 않아요":"Invalid QR code"}</h1>
     <Link href={localizeHref("/account/kids",locale)}>{locale==="ko"?"키즈 설정":"Kids settings"}</Link>
   </section>:unavailable?<p role="alert">Account sign-in is temporarily unavailable.</p>:
   !signedIn?<section className="placeholder-panel">
     <h1>{locale==="ko"?"부모님 로그인":"Parent sign-in"}</h1>
     <p>{locale==="ko"?"아이패드를 연결하려면 먼저 부모님 계정으로 로그인해 주세요.":"Sign in to your parent account to approve this iPad."}</p>
     <Link className="btn btn-primary"
       href={localizeHref("/sign-in?callbackURL="+encodeURIComponent(here),locale)}>
       {locale==="ko"?"로그인":"Sign in"}</Link>
   </section>:<PairApproval qrToken={token}/>}
 </main>;
}
