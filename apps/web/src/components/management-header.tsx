import type {ReactNode} from "react";
/** Shared accessible heading for adult settings, creator tools and backoffice. */
export default function ManagementHeader({eyebrow,title,description,actions}:{
 eyebrow:string;title:ReactNode;description?:ReactNode;actions?:ReactNode;
}){
 return <header className="management-heading">
   <span className="small-tag">{eyebrow}</span>
   <h1>{title}</h1>
   {description&&<p className="muted">{description}</p>}
   {actions&&<div className="management-heading-actions">{actions}</div>}
 </header>;
}
