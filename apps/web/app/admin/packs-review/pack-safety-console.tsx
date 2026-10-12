"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useLocale} from "../../../src/i18n/provider";
import {localizeHref} from "../../../src/i18n/core";
type Pack={id:string;title:string;sourceLocale:string;currentVersion:number;questionCount:number;
 safetyStatus:string;kidsEligible:boolean;ready:boolean;issue:string};
async function api(path:string,method="GET",body?:unknown){
 const r=await fetch("/api/v1"+path,{method,cache:"no-store",credentials:"same-origin",
  headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined});
 const result=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(result.message||result.error||"Server error");
 return result.data;
}
export default function PackSafetyConsole(){
 const locale=useLocale(),ko=locale==="ko";
 const [rows,setRows]=useState<Pack[]>([]),[page,setPage]=useState(0);
 const [reasons,setReasons]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const load=async()=>{
   const data=await api("/admin/packs/safety?limit=20&offset="+page*20);
   setRows(data.items??[]);
 };
 useEffect(()=>{let alive=true;
   void api("/admin/packs/safety?limit=20&offset="+page*20).then(v=>{if(alive)setRows(v.items??[]);})
    .catch(e=>{if(alive)setError(String(e))});
   return ()=>{alive=false}
 },[page]);
 async function review(pack:Pack,verdict:"APPROVED"|"PENDING"|"RESTRICTED"){
   const reason=(reasons[pack.id]||"").trim();
   if(reason.length<8){setError(ko?"검토 사유를 8자 이상 입력하세요.":"Please explain the decision in at least eight characters.");return;}
   if(!window.confirm(ko?"이 퀴즈팩의 어린이 안전성 상태를 변경할까요?":"Apply this independent Kids safety decision?"))return;
   setBusy(true);setError("");setNotice("");
   try{
    await api("/admin/packs/"+pack.id+"/safety-review","POST",
      {verdict,expectedVersion:pack.currentVersion,reason,confirm:true});
    setNotice(ko?"심사 결과를 기록했어요.":"Review recorded.");
    await load();
   }catch(e){setError(e instanceof Error?e.message:String(e))}
   finally{setBusy(false)}
 }
 return <section className="studio-workspace">
   <p className="muted">{ko?"Kids에서는 원본 언어로 공개되고 모든 문제 및 미디어가 안전 승인된 팩만 노출돼요.":"Kids only displays original-language packs whose individual questions and media are independently approved."}</p>
   <div className="studio-list">{rows.map(pack=><article className="feature-card" key={pack.id}>
      <h3>{pack.title}</h3>
      <p>{pack.sourceLocale} · {pack.questionCount} {ko?"문제":"questions"} · v{pack.currentVersion}</p>
      <p>{ko?"팩 상태":"Pack status"}: {pack.safetyStatus} · {pack.kidsEligible?(ko?"어린이용 승인":"Kids eligible"):(ko?"승인되지 않음":"Not Kids approved")}</p>
      <p className="muted">{pack.ready?(ko?"구성 문제의 서버 안전 기준 통과":"Members meet server safety criteria"):
        (ko?"재검토 필요: ":"Needs review: ")+pack.issue}</p>
      <p><Link href={localizeHref("/packs/"+pack.id,locale)} target="_blank">
        {ko?"공개 팩 상세 보기 ↗":"Inspect public pack ↗"}</Link>
        {" · "}<Link href={localizeHref("/admin/quiz-review",locale)}>
          {ko?"개별 문제·미디어 심사":"Question and media review"}</Link></p>
      <label>{ko?"심사 사유":"Review reason"}
        <textarea value={reasons[pack.id]??""} maxLength={1000} rows={2}
          onChange={e=>setReasons(old=>({...old,[pack.id]:e.target.value}))}/></label>
      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={busy||!pack.ready}
          onClick={()=>void review(pack,"APPROVED")}>{ko?"어린이용 승인":"Approve for Kids"}</button>
        <button type="button" className="btn btn-outline" disabled={busy}
          onClick={()=>void review(pack,"PENDING")}>{ko?"보류":"Return to pending"}</button>
        <button type="button" className="btn btn-outline" disabled={busy}
          onClick={()=>void review(pack,"RESTRICTED")}>{ko?"제한":"Restrict pack"}</button>
      </div>
    </article>)}</div>
   {!rows.length&&<p className="muted">{ko?"심사할 팩이 없어요.":"No published packs to review."}</p>}
   <nav className="discover-pagination">
    <button type="button" className="btn btn-outline" disabled={page===0||busy} onClick={()=>setPage(p=>p-1)}>
      {ko?"이전":"Previous"}</button>
    <span>{page+1}</span>
    <button type="button" className="btn btn-outline" disabled={rows.length<20||busy} onClick={()=>setPage(p=>p+1)}>
      {ko?"다음":"Next"}</button>
   </nav>
   {notice&&<p role="status">{notice}</p>}
   {error&&<p role="alert" className="feedback">{error}</p>}
 </section>;
}
