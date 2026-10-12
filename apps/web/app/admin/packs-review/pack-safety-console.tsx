"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useLocale} from "../../../src/i18n/provider";
import {localizeHref} from "../../../src/i18n/core";
import {listPageIndex,useListUrlState} from "../../../src/lib/list-url-state";

type KidsPack={id:string;title:string;sourceLocale:string;currentVersion:number;
  questionCount:number;safetyStatus:string;kidsReviewStatus:string;
  kidsEligible:boolean;ready:boolean;issue:string};
type FlaggedPack={id:string;title:string;description:string;quizCount:number;
  publication:string;currentVersion:number;safetyStatus:string;openReports:number;
  reasons:string[];reportSamples:{reason:string;detail:string}[]};
async function api(path:string,method="GET",body?:unknown){
  const response=await fetch("/api/v1"+path,{method,cache:"no-store",credentials:"same-origin",
    headers:body?{"Content-Type":"application/json"}:undefined,
    body:body?JSON.stringify(body):undefined});
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(json.message||json.error||"Server error");
  return json.data;
}
export default function PackSafetyConsole(){
  const locale=useLocale(),ko=locale==="ko";
  const [kids,setKids]=useState<KidsPack[]>([]),[flagged,setFlagged]=useState<FlaggedPack[]>([]);
  const [listing,updateListing,ready]=useListUrlState({kidsPage:"1",reportsPage:"1"});
  const kidsPage=listPageIndex(listing.kidsPage),reportsPage=listPageIndex(listing.reportsPage);
  const setKidsPage=(page:number)=>updateListing({kidsPage:String(page+1)});
  const setReportsPage=(page:number)=>updateListing({reportsPage:String(page+1)});
  const [kidsTotal,setKidsTotal]=useState(0),[reportsTotal,setReportsTotal]=useState(0);
  const [reasons,setReasons]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const loadKids=async()=>{
    const result=await api("/admin/packs/safety?limit=20&offset="+kidsPage*20);
    setKids(result.items??[]);setKidsTotal(result.total??0);
  };
  const loadReports=async()=>{
    const result=await api("/admin/packs/reports?limit=20&offset="+reportsPage*20);
    setFlagged(result.items??[]);setReportsTotal(result.total??0);
  };
  useEffect(()=>{if(!ready)return;let alive=true;
    void api("/admin/packs/safety?limit=20&offset="+kidsPage*20).then(data=>{
      if(alive){setKids(data.items??[]);setKidsTotal(data.total??0);}
    }).catch(e=>{if(alive)setError(String(e))});
    return ()=>{alive=false};
  },[ready,kidsPage]);
  useEffect(()=>{if(!ready)return;let alive=true;
    void api("/admin/packs/reports?limit=20&offset="+reportsPage*20).then(data=>{
      if(alive){setFlagged(data.items??[]);setReportsTotal(data.total??0);}
    }).catch(e=>{if(alive)setError(String(e))});
    return ()=>{alive=false};
  },[ready,reportsPage]);
  async function review(id:string,version:number,verdict:"APPROVED"|"REJECTED"|"RESTRICTED"|"RESTORED"){
    const reason=(reasons[id]??"").trim();
    if(["RESTRICTED","REJECTED"].includes(verdict)&&reason.length<8){
      setError(ko?"제한 또는 어린이용 신청 거절 사유를 8자 이상 작성하세요.":"A restriction or Kids rejection requires at least 8 characters.");
      return;
    }
    if(!window.confirm(ko?"이 심사 결정을 적용할까요?":"Apply this moderation decision?"))return;
    setBusy(true);setError("");setNotice("");
    try{
      await api("/admin/packs/"+id+"/safety-review","POST",
        {verdict,expectedVersion:version,reason,confirm:true});
      setNotice(ko?"결정을 기록했어요.":"Moderation decision recorded.");
      await Promise.all([loadKids(),loadReports()]);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  const comment=(id:string,label:string)=><label>{label}
    <textarea value={reasons[id]??""} maxLength={1000} rows={2}
      onChange={event=>setReasons(old=>({...old,[id]:event.target.value}))}/>
  </label>;
  return <div className="studio-workspace">
    <section className="feature-card">
      <h2>{ko?"어린이용 팩 승인 신청":"Kids pack applications"} ({kidsTotal})</h2>
      <p className="muted">{ko?"제작자가 직접 신청한 공개 팩만 표시합니다. 모든 구성 문제와 미디어를 검사한 후 승인할 수 있어요.":"Only creator-requested published packs appear here. Every original-language question and media asset must pass its own Kids review."}</p>
      {!kids.length&&<p className="muted">{ko?"현재 심사 대기 중인 신청이 없어요.":"No Kids pack applications are waiting."}</p>}
      <div className="studio-list">{kids.map(pack=><article className="studio-list-row" key={pack.id}>
        <div className="studio-list-main">
          <h3>{pack.title}</h3>
          <p className="muted">{pack.sourceLocale} · {pack.questionCount} {ko?"문제":"questions"} · v{pack.currentVersion}</p>
          <p className="muted">{pack.ready?(ko?"모든 문제의 어린이 적격성 확인":"All members pass Kids eligibility checks"):
            (ko?"승인 불가: ":"Not ready: ")+pack.issue}</p>
          <p><Link href={localizeHref("/admin/quiz-review",locale)}>{ko?"개별 문제 확인":"Review individual quizzes"}</Link></p>
          {comment(pack.id,ko?"승인 시 선택, 거절 시 사유 필수":"Optional on approval; required on rejection")}
          <div className="actions">
            <button type="button" className="btn btn-primary" disabled={busy||!pack.ready}
              onClick={()=>void review(pack.id,pack.currentVersion,"APPROVED")}>{ko?"어린이용 승인":"Approve for Kids"}</button>
            <button type="button" className="btn btn-outline" disabled={busy}
              onClick={()=>void review(pack.id,pack.currentVersion,"REJECTED")}>{ko?"신청 거절":"Reject request"}</button>
          </div>
        </div>
      </article>)}</div>
      <nav className="discover-pagination">
        <button type="button" className="btn btn-outline" disabled={busy||kidsPage===0}
          onClick={()=>setKidsPage(Math.max(0,kidsPage-1))}>{ko?"이전":"Previous"}</button>
        <span>{kidsPage+1} / {Math.max(1,Math.ceil(kidsTotal/20))}</span>
        <button type="button" className="btn btn-outline" disabled={busy||(kidsPage+1)*20>=kidsTotal}
          onClick={()=>setKidsPage(kidsPage+1)}>{ko?"다음":"Next"}</button>
      </nav>
    </section>
    <section className="feature-card">
      <h2>{ko?"신고 및 제한된 팩":"Reported and restricted packs"} ({reportsTotal})</h2>
      <p className="muted">{ko?"신고된 팩이나 관리자가 제한한 팩만 표시됩니다. 팩 전체에 문제가 있을 때에만 제한하세요.":"Only flagged or restricted packs appear here. Restrict a whole pack only when the pack itself violates policy."}</p>
      {!flagged.length&&<p className="muted">{ko?"검토할 팩이 없어요.":"No packs need general moderation."}</p>}
      <div className="studio-list">{flagged.map(pack=><article className="studio-list-row" key={pack.id}>
        <div className="studio-list-main">
          <h3>{pack.title}</h3>
          {pack.description&&<p>{pack.description}</p>}
          <p className="muted">{pack.publication} · {pack.quizCount} {ko?"문제":"questions"} · {ko?"미처리 신고":"Open reports"}: {pack.openReports} · {pack.safetyStatus}</p>
          {pack.reportSamples.map((r,i)=><p key={i} className="muted">{r.reason}: {r.detail}</p>)}
          {comment(pack.id,ko?"제한 사유 (8자 이상)":"Restriction reason (at least 8 characters)")}
          <div className="actions">
            {pack.safetyStatus!=="RESTRICTED"?
              <button type="button" className="btn btn-outline" disabled={busy}
                onClick={()=>void review(pack.id,pack.currentVersion,"RESTRICTED")}>{ko?"팩 전체 제한":"Restrict whole pack"}</button>:
              <button type="button" className="btn btn-outline" disabled={busy}
                onClick={()=>void review(pack.id,pack.currentVersion,"RESTORED")}>{ko?"일반 공개 제한 해제":"Restore general access"}</button>}
          </div>
        </div>
      </article>)}</div>
      <nav className="discover-pagination">
        <button type="button" className="btn btn-outline" disabled={busy||reportsPage===0}
          onClick={()=>setReportsPage(Math.max(0,reportsPage-1))}>{ko?"이전":"Previous"}</button>
        <span>{reportsPage+1} / {Math.max(1,Math.ceil(reportsTotal/20))}</span>
        <button type="button" className="btn btn-outline" disabled={busy||(reportsPage+1)*20>=reportsTotal}
          onClick={()=>setReportsPage(reportsPage+1)}>{ko?"다음":"Next"}</button>
      </nav>
    </section>
    {notice&&<p role="status">{notice}</p>}
    {error&&<p role="alert" className="feedback">{error}</p>}
  </div>;
}
