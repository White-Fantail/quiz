import PlayPage from "../../../play/page";
export default async function PackPlayRoute({
 params,searchParams
}:{params:Promise<{packId:string}>;searchParams:Promise<{resumeRunId?:string}>}){
 const {packId}=await params;
 const {resumeRunId}=await searchParams;
 return <PlayPage packId={packId} resumeRunId={resumeRunId}/>;
}
