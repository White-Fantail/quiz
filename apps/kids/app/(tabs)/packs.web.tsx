import Preview from "../../src/web/Preview";
// Sample-only browser preview: never authenticates a Kids device or fetches live private packs.
export default function WebPage(){return <Preview initialTab="packs"/>;}
