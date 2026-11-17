(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.RiverSpecialistHandoff=api;
})(typeof window==="undefined"?null:window,function(){
  "use strict";

  // Registry of existing independent expert planners. Do not mirror their
  // access records, route graphs, field conditions, mileage or route logic.
  const SPECIALISTS=Object.freeze({
    ausable:Object.freeze({
      id:"ausable",name:"Au Sable River Field Map",
      url:"https://ausable.chrisizworski.com/",
      description:"Choose actual put-ins and takeouts, explore the full access inventory, see live river conditions and share a selected float.",
      capability:"Dedicated Au Sable trip planner"
    }),
    manistee:Object.freeze({
      id:"manistee",name:"Manistee River Field Map",
      url:"https://chrisizworski.com/manistee-river-map/",
      description:"Build a float with documented access points and USGS river-network distance wherever the connected hydrography supports it.",
      capability:"Dedicated Manistee route and access map"
    })
  });
  function match(gauge){
    const name=String(gauge?.name||"").toLowerCase().replace(/\s+/g," ");
    const lat=Number(gauge?.latitude),lon=Number(gauge?.longitude);
    // River names recur across states, so handoffs require a Michigan location.
    if(!name||gauge?.latitude==null||gauge?.longitude==null||
      !Number.isFinite(lat)||!Number.isFinite(lon)||
      lat<43.3||lat>46||lon< -88.5||lon> -82.5)return null;
    if(/\b(?:au\s*sable|ausable)\s+(?:river|r)\b/.test(name))return SPECIALISTS.ausable;
    if(/\bmanistee\s+(?:river|r)\b/.test(name))return SPECIALISTS.manistee;
    return null;
  }
  function render(gauge,element){
    if(!element)return null;
    const expert=match(gauge);
    element.hidden=!expert;
    if(!expert){element.replaceChildren();return null;}
    const heading=document.createElement("h3");
    heading.textContent="Continue in the "+expert.name;
    const paragraph=document.createElement("p");
    paragraph.textContent=expert.description+" This page only supplies conditions at the selected monitoring station.";
    const link=document.createElement("a");
    link.href=expert.url;
    link.target="_blank";
    link.rel="noopener noreferrer";
    link.textContent="Open the river's full float planner";
    element.replaceChildren(heading,paragraph,link);
    return expert.id;
  }
  return {SPECIALISTS,match,render};
});
