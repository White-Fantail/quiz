import Preview from "../src/web/Preview";
// Browser routes must never mount native PIN, device token, child media, or API code.
export default function WebPage(){return <Preview initialTab="home"/>;}
