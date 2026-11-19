const test = require("node:test");
const assert = require("node:assert/strict");
const bridge = require("../public/assets/river-specialist-handoff.js");

function catalog(overrides={}) {
  return {
    contract:"manistee-float/v1",
    kind:"access-catalog",
    owner:"https://chrisizworski.com/manistee-river-map/",
    registryVersion:"2026-08-20",
    registryAuditDate:"2026-08-20",
    supportedRoutingWaterways:["manistee","pine"],
    access:[{
      id:"pine-elm-flats",
      name:"Elm Flats Canoe Landing",
      provenance:{name:"Forest Service",url:"https://www.fs.usda.gov/"},
      currentAccessVerified:false,
    }],
    ...overrides,
  };
}
function response(data,ok=true){return {ok,json:async()=>data};}
test("reads the Manistee original-ID access contract from its owner",async()=>{
  let called;
  const fetcher=async url=>{called=url;return response(catalog());};
  const summary=await bridge.readManisteeCatalog(fetcher);
  assert.equal(called,"https://chrisizworski.com/api/manistee-float-v1?mode=access");
  assert.equal(summary.accessCount,1);
  assert.equal(summary.registryAuditDate,"2026-08-20");
  assert.deepEqual(summary.waterways,["manistee","pine"]);
  assert.equal(summary.canonical,bridge.SPECIALISTS.manistee.url);
});
test("a different owner or invented open-now evidence cannot be accepted",()=>{
  assert.throws(()=>bridge.validCatalog(catalog({owner:"https://somewhere-else.example/"})));
  const bad=catalog();
  bad.access[0].currentAccessVerified=true;
  assert.throws(()=>bridge.validCatalog(bad));
  assert.throws(()=>bridge.validCatalog(catalog({contract:"manistee-float/v2"})));
  assert.throws(()=>bridge.validCatalog(catalog({access:[]})));
});
test("upstream errors leave the specialist link available without fake data",async()=>{
  await assert.rejects(bridge.readManisteeCatalog(async()=>response({},false)));
  await assert.rejects(bridge.readManisteeCatalog(async()=>response(catalog({access:[]}))));
});
test("route consumption keeps the original IDs and source truth gates",async()=>{
  const result={
    contract:"manistee-float/v1",
    kind:"river-network-route",
    owner:bridge.SPECIALISTS.manistee.url,
    status:"mapped-route-estimate",
    from:{id:"pine-elm-flats"},
    to:{id:"pine-peterson"},
    route:{miles:5.5,estimateOnly:true},
    currentAccessVerified:false,
    navigabilityVerified:false,
    directionVerified:false,
  };
  let called="";
  const fetcher=async url=>{called=url;return response(result);};
  const route=await bridge.readManisteeRoute("pine-elm-flats","pine-peterson",fetcher);
  assert.equal(route.route.miles,5.5);
  assert.match(called,/mode=route&from=pine-elm-flats&to=pine-peterson/);
  assert.throws(()=>bridge.validRoute({...result,directionVerified:true}));
  assert.throws(()=>bridge.validRoute({...result,route:{miles:0,estimateOnly:true}}));
  assert.throws(()=>bridge.validRoute({...result,navigabilityVerified:true}));
});
test("invalid IDs and absent routes never generate distance",async()=>{
  await assert.rejects(bridge.readManisteeRoute("../start","pine-peterson",()=>{throw Error("should not fetch");}));
  await assert.rejects(bridge.readManisteeRoute("pine-elm-flats","pine-peterson",async()=>response({},false)));
});

test("optional source fetch has a bounded browser deadline",async()=>{
  await bridge.readManisteeCatalog(async (url,options)=>{
    assert.match(url,/mode=access/);
    assert.equal(options.signal?.aborted,false);
    return response(catalog());
  });
});
test("failed optional catalog lookup retries on next selection without losing specialist link",async()=>{
  const previousFetch=global.fetch;
  const previousDocument=global.document;
  let calls=0;
  global.fetch=async()=>{calls++;if(calls===1)throw Error("temporary source outage");return response(catalog());};
  global.document={createElement(tag){return {tag,textContent:"",href:"",rel:"",target:"",className:""};}};
  const element={
    dataset:{},hidden:true,isConnected:true,children:[],
    replaceChildren(...nodes){this.children=nodes;},
    insertBefore(node,reference){
      const index=this.children.indexOf(reference);
      this.children.splice(index<0?this.children.length:index,0,node);
    }
  };
  const gauge={name:"MANISTEE RIVER NEAR SHERMAN MI",latitude:44.6,longitude:-85.3};
  try{
    bridge.render(gauge,element);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls,1);
    assert.match(element.children[2].textContent,/For put-ins, takeouts and the river map/);
    assert.equal(element.children[3].href,"https://chrisizworski.com/manistee-river-map/");
    bridge.render(gauge,element);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls,2);
    assert.match(element.children[2].textContent,/mapped access and campground locations/);
    assert.equal(element.hidden,false);
  }finally{
    global.fetch=previousFetch;
    global.document=previousDocument;
  }
});
