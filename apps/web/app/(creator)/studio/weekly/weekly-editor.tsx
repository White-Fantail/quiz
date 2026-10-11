"use client";
import { useEffect,useState } from "react";
type Quiz={id:string;title:string;publication:string;safetyStatus:string;kidsEligible:boolean;version:number};
type Lane="GENERAL"|"KIDS";
function upcomingMonday(){
  const now=new Date(),day=(now.getUTCDay()+6)%7;
  const utc=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
  utc.setUTCDate(utc.getUTCDate()+((7-day)%7||7));
  return utc.toISOString().slice(0,10);
}
export default function WeeklyEditor(){
  const [lane,setLane]=useState<Lane>("GENERAL");
  const [week,setWeek]=useState(upcomingMonday());
  const [title,setTitle]=useState("");
  const [description,setDescription]=useState("");
  const [all,setAll]=useState<Quiz[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  useEffect(()=>{
    void fetch("/api/v1/quizzes?mine=true&limit=100",{credentials:"same-origin",cache:"no-store"})
      .then(r=>r.json().then(x=>({ok:r.ok,x})))
      .then(({ok,x})=>{if(!ok)throw new Error(x.message||x.error||"문제 목록을 가져오지 못했어요");setAll(x.data.items||[]);})
      .catch(e=>setError(e.message));
  },[]);
  useEffect(()=>{setSelected([])},[lane]);
  const eligible=all.filter(q=>q.publication==="PUBLISHED"&&q.safetyStatus!=="RESTRICTED"&&
    (lane==="GENERAL"||(q.safetyStatus==="APPROVED"&&q.kidsEligible)));
  function toggle(id:string){
    setSelected(old=>old.includes(id)?old.filter(x=>x!==id):old.length<5?[...old,id]:old);
  }
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError("");setMessage("");
    try{
      const res=await fetch("/api/v1/weekly/submit",{method:"POST",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({lane,weekStart:week,title,description,quizIds:selected})});
      const body=await res.json();
      if(!res.ok)throw new Error(body.message||body.error||"제안에 실패했어요");
      setMessage("출제자 제안을 접수했어요. 운영자가 확인하고 공식 주간 챌린지를 편성해요.");
      setSelected([]);
    }catch(e){setError(e instanceof Error?e.message:"제출에 실패했어요")}
    finally{setBusy(false)}
  }
  return <form className="placeholder-panel creator-weekly" onSubmit={e=>void submit(e)}>
    <h2>주간 다섯 문제 제출</h2>
    <div className="media-editor">
      <label>대상 모드
        <select value={lane} onChange={e=>setLane(e.target.value as Lane)}>
          <option value="GENERAL">일반 챌린지</option><option value="KIDS">어린이 챌린지 (승인된 문제만)</option>
        </select>
      </label>
      <label>출제할 주의 월요일 (UTC)
        <input type="date" value={week} onChange={e=>setWeek(e.target.value)} required/>
      </label>
      <label>특집 제목
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="예: 도시 속 숨겨진 동물들" maxLength={180} required/>
      </label>
      <label>출제자 한마디
        <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="참가자들에게 한마디!" maxLength={1000} rows={3}/>
      </label>
    </div>
    <h3>문제 고르기 ({selected.length}/5)</h3>
    <p className="muted">순서대로 클릭한 5문제가 모든 참가자에게 똑같은 순서로 나와요. 공개된 직접 제작 문제만 선택할 수 있어요.</p>
    {!eligible.length&&<p>제안 가능한 문제가 아직 없어요. 다섯 문제를 만들고 공개해 주세요.</p>}
    <div className="weekly-quiz-options">
      {eligible.map(q=><label key={q.id} className="weekly-quiz-option">
        <input type="checkbox" checked={selected.includes(q.id)} onChange={()=>toggle(q.id)}/>
        <span><strong>{q.title}</strong><small>v{q.version} · {selected.includes(q.id)?"순서 "+(selected.indexOf(q.id)+1):"선택"}</small></span>
      </label>)}
    </div>
    {error&&<p className="feedback" role="alert">{error}</p>}
    {message&&<p className="feedback success" role="status">{message}</p>}
    <button className="btn btn-primary" type="submit" disabled={busy||selected.length!==5||title.trim().length<3}>
      {busy?"제출하는 중…":"5문제 공식 출제 제안하기"}
    </button>
    <p className="muted">제안만으로 공식 게시되지는 않아요. 운영자가 문제 및 출제자 신원을 확인하고 확정해야 해요.</p>
  </form>;
}
