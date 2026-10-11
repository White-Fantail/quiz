"use client";
import {useEffect,useState} from "react";
type Summary={id:string;title:string;mode:string;version:number;publication:string;safetyStatus:string;kidsEligible:boolean};
type Clue={type:string;text?:string;mediaId?:string;map?:{latitude:number;longitude:number}};
type Details=Summary&{prompt:string;answer:{canonical:string;aliases:string[]};clues:Clue[];promptMediaIds:string[];authorId:string};
type Media={id:string;kind:string;alt:string;attribution:string;license:string;moderationStatus:string;previewUrl:string};
async function api(path:string,method="GET",payload?:unknown){
  const res=await fetch("/api/v1"+path,{method,credentials:"same-origin",cache:"no-store",
    headers:payload?{"Content-Type":"application/json"}:undefined,
    body:payload?JSON.stringify(payload):undefined});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.message||data.error||"요청을 처리하지 못했어요");
  return data.data;
}
export default function QuizReviewConsole(){
  const [quizzes,setQuizzes]=useState<Summary[]>([]);
  const [selected,setSelected]=useState<Details|null>(null);
  const [media,setMedia]=useState<Record<string,Media>>({});
  const [reason,setReason]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  async function refresh(){
    const data=await api("/quizzes?limit=100");
    setQuizzes(data.items||[]);
  }
  useEffect(()=>{void refresh().catch(e=>setError(e.message));},[]);
  async function open(id:string){
    setBusy(true);setError("");setNotice("");setMedia({});
    try {
      const details:Details=await api("/quizzes/"+id+"/review");
      setSelected(details);
      const ids=[...new Set([...(details.promptMediaIds||[]),...details.clues.map(q=>q.mediaId).filter((x):x is string=>!!x)])];
      const responses=await Promise.allSettled(ids.map((id)=>api("/media/"+id+"/review")));
      const assets:Record<string,Media>={};
      responses.forEach((res,i)=>{if(res.status==="fulfilled")assets[ids[i]]=res.value;});
      setMedia(assets);
    }catch(e){setError(e instanceof Error?e.message:"문제를 열 수 없어요.");}
    finally{setBusy(false);}
  }
  async function review(verdict:"APPROVED"|"RESTRICTED",kidsEligible=false){
    if(!selected||reason.trim().length<5)return;
    if(!window.confirm("실제로 문제와 미디어를 검토했나요? 판정을 확정할까요?"))return;
    setBusy(true);setError("");setNotice("");
    try{
      await api("/quizzes/"+selected.id+"/review","POST",{verdict,kidsEligible,reason,confirm:true});
      setNotice(verdict==="RESTRICTED"?"문제 노출을 제한했어요.":"문제를 승인했어요.");
      setSelected(null);setReason("");await refresh();
    }catch(e){setError(e instanceof Error?e.message:"검토를 저장하지 못했어요.");}
    finally{setBusy(false);}
  }
  async function reviewMedia(id:string,verdict:"APPROVED"|"RESTRICTED"){
    if(!selected||reason.trim().length<5)return;
    if(!window.confirm("파일의 출처, 내용과 권리를 직접 확인했나요?"))return;
    setBusy(true);setError("");setNotice("");
    try{
      await api("/media/"+id+"/review","POST",{verdict,reason,confirm:true});
      const result=await api("/media/"+id+"/review");
      setMedia(old=>({...old,[id]:result}));
      setNotice("미디어 심사를 저장했어요.");
    }catch(e){setError(e instanceof Error?e.message:"미디어 심사 실패");}
    finally{setBusy(false);}
  }
  function mediaView(id:string){
    const item=media[id];
    if(!item)return <p className="muted">미디어를 열지 못했어요. 승인하지 말고 상태를 확인해 주세요.</p>;
    return <div className="review-media">
      <span className="small-tag">{item.kind} · {item.moderationStatus}</span>
      <p>{item.alt||"설명 없음"} · {item.attribution||"출처 없음"} · {item.license||"라이선스 정보 없음"}</p>
      {item.kind==="image"&&<img src={item.previewUrl} alt={item.alt||"검토할 이미지"} className="round-media"/>}
      {item.kind==="audio"&&<audio controls src={item.previewUrl}/>}
      {item.kind==="video"&&<video controls src={item.previewUrl} className="round-media"/>}
      {item.moderationStatus!=="APPROVED"&&<button className="btn btn-outline" type="button" disabled={busy||reason.trim().length<5}
        onClick={()=>void reviewMedia(id,"APPROVED")}>미디어 승인</button>}
      <button className="text-button" type="button" disabled={busy||reason.trim().length<5}
        onClick={()=>void reviewMedia(id,"RESTRICTED")}>미디어 제한</button>
    </div>;
  }
  return <div className="review-console">
    {error&&<p className="feedback" role="alert">{error}</p>}
    {notice&&<p className="feedback success" role="status">{notice}</p>}
    <section className="section">
      <h2>공개 문제 목록</h2>
      <p className="muted">최근 100개 공개 문제를 표시해요. 안전성 검토가 필요한 문제부터 확인할 수 있어요.</p>
      {quizzes.slice().sort((a,b)=>(a.safetyStatus==="PENDING"?0:1)-(b.safetyStatus==="PENDING"?0:1)).map(q=>
        <button type="button" className="review-item" disabled={busy} key={q.id} onClick={()=>void open(q.id)}>
          <span><strong>{q.title}</strong><small>{q.mode} · v{q.version}</small></span>
          <span className="small-tag">{q.safetyStatus}{q.kidsEligible?" · KIDS":""}</span>
        </button>)}
    </section>
    {selected&&<section className="placeholder-panel">
      <h2>심사: {selected.title}</h2>
      <p>{selected.prompt}</p>
      <p><b>정답:</b> {selected.answer.canonical}</p>
      {selected.promptMediaIds?.map(id=><div key={id}>{mediaView(id)}</div>)}
      <ol className="clue-list">
        {selected.clues.map((clue,i)=><li key={i}>
          <strong>{clue.type}</strong>{clue.text&&<p>{clue.text}</p>}
          {clue.mediaId&&mediaView(clue.mediaId)}
          {clue.map&&<p>위도 {clue.map.latitude} · 경도 {clue.map.longitude}</p>}
        </li>)}
      </ol>
      <div className="media-editor">
        <label>심사 근거 (필수)
          <textarea rows={3} value={reason} onChange={e=>setReason(e.target.value)}
            placeholder="안전성·연령 적합성·저작권·정확성 확인 내역" maxLength={1000}/>
        </label>
      </div>
      <div className="actions">
        <button className="btn btn-primary" type="button" disabled={busy||reason.trim().length<5}
          onClick={()=>void review("APPROVED",true)}>어린이용 승인</button>
        <button className="btn btn-outline" type="button" disabled={busy||reason.trim().length<5}
          onClick={()=>void review("APPROVED",false)}>일반용 승인</button>
        <button className="btn btn-outline" type="button" disabled={busy||reason.trim().length<5}
          onClick={()=>void review("RESTRICTED",false)}>문제 제한</button>
      </div>
    </section>}
  </div>;
}
