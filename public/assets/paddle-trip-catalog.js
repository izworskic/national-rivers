(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.PaddleTripCatalog = api;
})(typeof window === "undefined" ? null : window, function () {
  "use strict";
  const CATALOG_URL = "/data/paddle-route-pilot.json";
  function validUrl(url) {
    try {return new URL(url).protocol === "https:";} catch {return false;}
  }
  function verify(catalog) {
    if (!catalog || !Array.isArray(catalog.access) || !Array.isArray(catalog.segments) || !catalog.sources) throw Error("Invalid route catalog");
    const access = new Map();
    for (const point of catalog.access) {
      if (!point?.id || access.has(point.id) || !point.name || !catalog.sources[point.source]) throw Error("Unverified access record");
      if (point.status !== "current-access-not-verified") throw Error("Access approval is not established");
      if ((point.lat === null) !== (point.lon === null)) throw Error("Coordinate pair incomplete");
      if (point.lat != null && (!Number.isFinite(point.lat) || !Number.isFinite(point.lon) || Math.abs(point.lat)>90 || Math.abs(point.lon)>180)) throw Error("Invalid access coordinate");
      if (point.lat === null && !point.googleQuery) throw Error("Unmapped access needs a named search");
      access.set(point.id,point);
    }
    const ids = new Set();
    for (const segment of catalog.segments) {
      if (!segment?.id || ids.has(segment.id)) throw Error("Duplicate or missing segment ID");
      ids.add(segment.id);
      const start = access.get(segment.from), end = access.get(segment.to);
      if (!start || !end || start.river !== segment.river || end.river !== segment.river || start.id === end.id) throw Error("Invalid river segment connection");
      if (!catalog.sources[segment.routeSource] || !validUrl(catalog.sources[segment.routeSource].url)) throw Error("Route source missing");
      if (segment.verifiedNavigation !== false) throw Error("Cannot approve navigation from this catalog");
      const d=segment.distanceMiles;
      if (d !== null && (!Number.isFinite(d) || d <= 0 || d > 200)) throw Error("Invalid published river distance");
      if (!Number.isFinite(segment.timeHoursMin) || !Number.isFinite(segment.timeHoursMax) || segment.timeHoursMin <= 0 || segment.timeHoursMax < segment.timeHoursMin) throw Error("Invalid published duration");
    }
    for(const source of Object.values(catalog.sources))if(!validUrl(source.url))throw Error("Invalid source URL");
    return true;
  }
  function mapsLink(access) {
    const query = access.lat == null ? access.googleQuery : access.lat + "," + access.lon;
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);
  }
  function details(catalog, id) {
    verify(catalog);
    const segment = catalog.segments.find(x=>x.id===id);
    if (!segment) return null;
    const start = catalog.access.find(x=>x.id===segment.from);
    const end = catalog.access.find(x=>x.id===segment.to);
    const source = catalog.sources[segment.routeSource];
    const duration = segment.timeHoursMin === segment.timeHoursMax ?
      segment.timeHoursMin + (segment.timeHoursMin === 1 ? " hour" : " hours") :
      segment.timeHoursMin + " to " + segment.timeHoursMax + " hours";
    return {
      ...segment, start, end, source, duration,
      distance:segment.distanceMiles==null ? "Published route mileage not established" : segment.distanceMiles + " river miles on the published map",
      startMap:mapsLink(start),endMap:mapsLink(end),
      checkedOpen:false, routeReady:false,
    };
  }
  function el(tag,text,cls) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className=cls;
    return node;
  }
  function external(label,url) {
    const a=el("a",label);
    a.href=url;a.target="_blank";a.rel="noopener noreferrer";
    return a;
  }
  function display(model) {
    const output=document.getElementById("paddle-route-detail");
    if (!output || !model) return;
    output.replaceChildren();
    output.append(el("h3",model.name));
    const facts=el("div",undefined,"paddle-published-facts");
    facts.append(el("p",model.distance),el("p","Published historical float-time estimate: "+model.duration));
    output.append(facts);
    const endpoints=el("div",undefined,"paddle-endpoints");
    for(const [label,point,map] of [["PUT IN",model.start,model.startMap],["TAKE OUT",model.end,model.endMap]]){
      const card=el("section",undefined,"paddle-endpoint");
      card.append(el("span",label,"paddle-endpoint-kicker"),el("h4",point.name),
        el("p",point.region+" | "+point.type),
        el("p",point.lat===null?"Exact arrival pin not independently verified; Maps opens a named search.":"Coordinates published by the Manistee County access map."),
        external(point.lat===null?"Search location in Google Maps":"View access in Google Maps",map));
      endpoints.append(card);
    }
    output.append(endpoints);
    const warning=el("p","Current access and route conditions have not been verified. Published times are not arrival predictions. Check dam flows, local warnings and seasonal access before choosing this trip.","paddle-route-warning");
    output.append(warning);
    const caution=el("ul");
    for(const note of model.considerations){caution.append(el("li",note));}
    output.append(caution);
    const sources=el("p");
    sources.append(external("Read the published route source",model.source.url));
    output.append(sources);
    const advice=el("p","Do not draw a paddle route as a straight line between access coordinates. Verify put-in, takeout, shuttle, flow and hazards for the whole reach.","small");
    output.append(advice);
  }
  async function init() {
    const selector=document.getElementById("paddle-route-select");
    const status=document.getElementById("paddle-route-status");
    if(!selector||!status)return;
    try{
      const r=await fetch(CATALOG_URL,{headers:{Accept:"application/json"}});
      if(!r.ok)throw Error("Source inventory unavailable");
      const catalog=await r.json();
      verify(catalog);
      selector.replaceChildren();
      for(const seg of catalog.segments){const option=el("option",seg.name);option.value=seg.id;selector.append(option);}
      const selected=new URLSearchParams(window.location.search).get("paddleRoute");
      if(selected && catalog.segments.some(x=>x.id===selected))selector.value=selected;
      const draw=()=>{display(details(catalog,selector.value));status.textContent="Five published source-backed segments. No current launch approvals or on-water safety ratings.";};
      selector.addEventListener("change",draw);
      draw();
    }catch{
      status.textContent="Route inventory could not load. Use the source links below instead of assuming a float route is open.";
    }
  }
  if(typeof document !== "undefined")document.addEventListener("DOMContentLoaded",init);
  return {verify,details,mapsLink};
});
