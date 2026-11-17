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
  // Optional read-only contract from the source-owned Manistee field map.
  // Never copy route data, infer mileage, or silently promote this to a trip planner.
  const MANISTEE_API="https://chrisizworski.com/api/manistee-float-v1";
  let catalogPromise=null;
  function validCatalog(result){
    if(result?.contract!=="manistee-float/v1" || result.kind!=="access-catalog" ||
      result.owner!==SPECIALISTS.manistee.url || !Array.isArray(result.access) ||
      result.access.length<1 || result.access.length>150 ||
      !result.access.every(p=>typeof p.id==="string"&&/^[a-z0-9-]{1,60}$/.test(p.id) &&
        typeof p.provenance?.url==="string"&&/^https:\/\//.test(p.provenance.url) &&
        p.currentAccessVerified===false))throw Error("Unsupported Manistee catalog contract");
    return {
      accessCount:result.access.length,
      registryVersion:result.registryVersion||null,
      registryAuditDate:result.registryAuditDate||null,
      waterways:Array.isArray(result.supportedRoutingWaterways)?result.supportedRoutingWaterways:[],
      canonical:result.owner,
    };
  }
  async function readManisteeCatalog(fetcher){
    const run=fetcher || (typeof fetch==="function"?fetch:null);
    if(!run)throw Error("Fetch unavailable");
    const response=await run(MANISTEE_API+"?mode=access",{headers:{Accept:"application/json"}});
    if(!response.ok)throw Error("Manistee catalog unavailable");
    return validCatalog(await response.json());
  }
  function validRoute(result){
    if(result?.contract!=="manistee-float/v1" || result.kind!=="river-network-route" ||
      result.owner!==SPECIALISTS.manistee.url || result.status!=="mapped-route-estimate" ||
      result.currentAccessVerified!==false || result.navigabilityVerified!==false ||
      result.directionVerified!==false || result.route?.estimateOnly!==true ||
      !Number.isFinite(result.route.miles)||result.route.miles<=0 ||
      !result.from?.id || !result.to?.id)throw Error("Unsupported Manistee route contract");
    return result;
  }
  async function readManisteeRoute(from,to,fetcher){
    if(!/^[a-z0-9-]{1,60}$/.test(from||"")|| !/^[a-z0-9-]{1,60}$/.test(to||""))
      throw Error("Invalid access ID");
    const run=fetcher || (typeof fetch==="function"?fetch:null);
    if(!run)throw Error("Fetch unavailable");
    const url=MANISTEE_API+"?mode=route&from="+encodeURIComponent(from)+"&to="+encodeURIComponent(to);
    const response=await run(url,{headers:{Accept:"application/json"}});
    if(!response.ok)throw Error("Source-backed Manistee route unavailable");
    return validRoute(await response.json());
  }
  function enrichManistee(element,note){
    if(!catalogPromise)catalogPromise=readManisteeCatalog();
    catalogPromise.then(function(summary){
      if(element.dataset.specialist!=="manistee"||!element.isConnected)return;
      const stamp=summary.registryAuditDate?(" Catalog review: "+summary.registryAuditDate+"."):"";
      note.textContent=summary.accessCount+" source-documented access locations from the Manistee field map."+stamp+
        " Current arrival status is not verified here. Choose put-in and takeout in the dedicated planner.";
    }).catch(function(){
      if(element.dataset.specialist!=="manistee"||!element.isConnected)return;
      note.textContent="The Manistee data interface is not available yet. Open the full field map to plan your float.";
    });
  }
  function render(gauge,element){
    if(!element)return null;
    const expert=match(gauge);
    element.hidden=!expert;
    element.dataset.specialist=expert?.id||"";
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
    if(expert.id==="manistee"){
      const note=document.createElement("p");
      note.className="small";
      note.textContent="Checking the Manistee source-owned access inventory...";
      element.insertBefore(note,link);
      enrichManistee(element,note);
    }
    return expert.id;
  }
  return {SPECIALISTS,match,render,MANISTEE_API,validCatalog,readManisteeCatalog,validRoute,readManisteeRoute};
});
