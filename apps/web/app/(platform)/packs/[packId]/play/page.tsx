import PlayPage from "../../../play/page";
export default async function PackPlayRoute({params}:{params:Promise<{packId:string}>}){
 const {packId}=await params;
 return <PlayPage packId={packId}/>;
}
