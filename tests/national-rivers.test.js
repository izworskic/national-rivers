const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const rivers=require('../api/national-rivers.js')._test;
const context=require('../api/national-river-context.js')._test;
const index=require('../public/data/national-usgs-streamflow-sites.json');

function series({
  id='04157000',
  name='SAGINAW RIVER AT SAGINAW, MI',
  lat=43.43,
  lon=-83.94,
  code='00060',
  unit='ft3/s',
  description='Discharge, cubic feet per second',
  values=[['1000','2026-08-31T12:00:00.000-04:00']]
}={}){
  return {
    sourceInfo:{
      siteName:name,
      siteCode:[{value:id}],
      geoLocation:{geogLocation:{latitude:lat,longitude:lon}}
    },
    variable:{
      variableCode:[{value:code}],
      variableDescription:description,
      unit:{unitCode:unit}
    },
    values:[{value:values.map(([value,dateTime])=>({value,dateTime,qualifiers:['P']}))}]
  };
}

test('local USGS streamflow index is national, source-backed and internally consistent',()=>{
  assert.equal(index.source_name,'USGS Site Service');
  assert.match(index.source_url,/waterservices\.usgs\.gov\/nwis\/site/);
  assert.equal(index.criteria.siteType,'ST');
  assert.equal(index.criteria.siteStatus,'active');
  assert.equal(index.criteria.hasDataTypeCd,'iv');
  assert.equal(index.criteria.parameterCd,'00060');
  assert.ok(Date.parse(index.generated_at));
  assert.ok(index.site_count>=9000,index.site_count);
  assert.equal(index.sites.length,index.site_count);
  assert.equal(new Set(index.sites.map(site=>site.id)).size,index.site_count);
  for(const site of index.sites){
    assert.ok(/^\d{5,15}$/.test(site.id),site.id);
    assert.ok(site.name,site.id);
    assert.ok(Number.isFinite(site.latitude)&&site.latitude>=-90&&site.latitude<=90,site.id);
    assert.ok(Number.isFinite(site.longitude)&&site.longitude>=-180&&site.longitude<=180,site.id);
  }
});

test('West Branch Michigan nearest-gauge lookup remains local and source-backed',()=>{
  const nearby=rivers.nearestSites(44.276408,-84.238613,10);
  assert.equal(nearby.length,10);
  assert.equal(nearby[0].id,'04152049');
  assert.equal(nearby[1].id,'04142000');
  assert.match(nearby[0].name,/TITTABAWASSEE RIVER AT SECORD DAM/i);
  assert.match(nearby[1].name,/RIFLE RIVER NEAR STERLING/i);
  assert.ok(nearby[0].distance_miles<18);
  for(let i=1;i<nearby.length;i++)assert.ok(nearby[i].distance_miles>=nearby[i-1].distance_miles);
});

test('expanded USGS parameter contract includes observations but not inferred activity scores',()=>{
  assert.deepEqual(rivers.PARAMETERS,{
    discharge:'00060',
    gageHeight:'00065',
    waterTemperature:'00010',
    turbidity:'63680',
    dissolvedOxygen:'00300',
    specificConductance:'00095',
    ph:'00400'
  });
});

test('modern USGS continuous GeoJSON normalizes exact-site flow, stage and sensor readings',()=>{
  const sites=[{id:'04157000',name:'SAGINAW RIVER AT SAGINAW, MI',latitude:43.43,longitude:-83.94,distance_miles:2.5}];
  const feature=(parameter_code,value,time,unit_of_measure='ft^3/s',extra={})=>({
    type:'Feature',
    properties:{
      monitoring_location_id:'USGS-04157000',
      time_series_id:'ts-'+parameter_code,
      parameter_code,
      value:String(value),
      time,
      unit_of_measure,
      approval_status:'Provisional',
      qualifier:null,
      ...extra
    }
  });
  const payload={type:'FeatureCollection',features:[
    feature('00060',800,'2026-08-30T16:00:00Z'),
    feature('00060',900,'2026-08-31T10:00:00Z'),
    feature('00060',1000,'2026-08-31T16:00:00Z'),
    feature('00065',14,'2026-08-30T16:00:00Z','ft'),
    feature('00065',14.5,'2026-08-31T16:00:00Z','ft'),
    feature('00010',20,'2026-08-31T16:00:00Z','degC')
  ]};
  const [g]=rivers.normalize(payload,sites);
  assert.equal(g.discharge_cfs,1000);
  assert.equal(g.trend_percent_6h,11);
  assert.equal(g.trend_percent_24h,25);
  assert.equal(g.gage_height_ft,14.5);
  assert.equal(g.gage_height_change_24h_ft,0.5);
  assert.equal(g.water_temp_f,68);
  assert.ok(g.qualifiers.includes('P'));
});

test('modern USGS statistics response maps same-day percentile arrays without inventing missing values',()=>{
  const payload={data:[{
    monitoring_location_id:'USGS-04157000',
    time_of_year:'09-02',
    time_of_year_type:'day_of_year',
    percentiles:['5','10','25','50','75','90','95'],
    values:['700','800','900','1000','1200','1400','1600'],
    sample_count:42
  }]};
  const stats=context.parseStatistics(payload,new Date('2026-09-02T12:00:00Z')).get('04157000');
  assert.deepEqual(
    {p10:stats.p10,p25:stats.p25,p50:stats.p50,p75:stats.p75,p90:stats.p90,count:stats.count},
    {p10:800,p25:900,p50:1000,p75:1200,p90:1400,count:42}
  );
});

test('river runtime and index generator no longer call retiring USGS WaterServices',()=>{
  const runtime=fs.readFileSync(require.resolve('../api/national-rivers.js'),'utf8');
  const enrichment=fs.readFileSync(require.resolve('../api/national-river-context.js'),'utf8');
  const generator=fs.readFileSync(require.resolve('../scripts/generate-national-usgs-streamflow-index.mjs'),'utf8');
  assert.doesNotMatch(runtime,/waterservices\.usgs\.gov/);
  assert.doesNotMatch(enrichment,/waterservices\.usgs\.gov/);
  assert.doesNotMatch(generator,/waterservices\.usgs\.gov/);
  assert.match(runtime,/api\.waterdata\.usgs\.gov\/ogcapi\/v0\/collections\/continuous\/items/);
  assert.match(enrichment,/api\.waterdata\.usgs\.gov\/statistics\/v0\/observationNormals/);
  assert.match(generator,/latest-continuous\/items/);
});

test('normalizer calculates 6h/24h flow movement and preserves exact-site stage',()=>{
  const sites=[{id:'04157000',name:'SAGINAW RIVER AT SAGINAW, MI',latitude:43.43,longitude:-83.94,distance_miles:2.5}];
  const payload={value:{timeSeries:[
    series({values:[
      ['800','2026-08-30T12:00:00.000-04:00'],
      ['900','2026-08-31T06:00:00.000-04:00'],
      ['1000','2026-08-31T12:00:00.000-04:00']
    ]}),
    series({code:'00065',unit:'ft',description:'Gage height',values:[
      ['14.0','2026-08-30T12:00:00.000-04:00'],
      ['14.5','2026-08-31T12:00:00.000-04:00']
    ]})
  ]}};
  const [g]=rivers.normalize(payload,sites);
  assert.equal(g.discharge_cfs,1000);
  assert.equal(g.flow_24h_ago,800);
  assert.equal(g.trend_percent_24h,25);
  assert.equal(g.trend_percent_6h,11);
  assert.equal(g.gage_height_ft,14.5);
  assert.equal(g.gage_height_change_24h_ft,0.5);
});

test('normalizer exposes temperature and water-quality sensors only when USGS returns them',()=>{
  const sites=[{id:'04157000',name:'SAGINAW RIVER',latitude:43.43,longitude:-83.94,distance_miles:2.5}];
  const payload={value:{timeSeries:[
    series({values:[['900','2026-08-30T12:00:00.000-04:00'],['1000','2026-08-31T12:00:00.000-04:00']]}),
    series({code:'00010',unit:'deg C',description:'Temperature, water',values:[
      ['18','2026-08-30T12:00:00.000-04:00'],
      ['20','2026-08-31T12:00:00.000-04:00']
    ]}),
    series({code:'63680',unit:'FNU',description:'Turbidity',values:[
      ['4','2026-08-30T12:00:00.000-04:00'],
      ['6','2026-08-31T12:00:00.000-04:00']
    ]}),
    series({code:'00300',unit:'mg/L',description:'Dissolved oxygen',values:[['8.4','2026-08-31T12:00:00.000-04:00']]}),
    series({code:'00095',unit:'uS/cm',description:'Specific conductance',values:[['412','2026-08-31T12:00:00.000-04:00']]}),
    series({code:'00400',unit:'std',description:'pH',values:[['7.6','2026-08-31T12:00:00.000-04:00']]})
  ]}};
  const [g]=rivers.normalize(payload,sites);
  assert.equal(g.water_temp_f,68);
  assert.equal(g.sensors.water_temperature.min_24h,64.4);
  assert.equal(g.sensors.water_temperature.max_24h,68);
  assert.equal(g.sensors.water_temperature.change_24h,3.6);
  assert.equal(g.sensors.turbidity.value,6);
  assert.equal(g.sensors.turbidity.unit,'FNU');
  assert.equal(g.sensors.turbidity.change_percent_24h,50);
  assert.equal(g.sensors.dissolved_oxygen.value,8.4);
  assert.equal(g.sensors.specific_conductance.value,412);
  assert.equal(g.sensors.ph.value,7.6);
  assert.deepEqual(g.sensor_availability,[
    'water_temperature','turbidity','dissolved_oxygen','specific_conductance','ph'
  ]);
});

test('normalizer never fabricates missing water-quality sensors',()=>{
  const sites=[{id:'04157000',name:'SAGINAW RIVER',latitude:43.43,longitude:-83.94,distance_miles:2.5}];
  const payload={value:{timeSeries:[series({values:[['900','2026-08-30T12:00:00.000-04:00'],['1000','2026-08-31T12:00:00.000-04:00']]})]}};
  const [g]=rivers.normalize(payload,sites);
  assert.equal(g.sensors.water_temperature,null);
  assert.equal(g.sensors.turbidity,null);
  assert.equal(g.sensors.dissolved_oxygen,null);
  assert.equal(g.sensors.specific_conductance,null);
  assert.equal(g.sensors.ph,null);
  assert.deepEqual(g.sensor_availability,[]);
});

test('normalizer excludes indexed sites that do not return a live discharge reading',()=>{
  const sites=[{id:'04157000',name:'SAGINAW RIVER',latitude:43.43,longitude:-83.94,distance_miles:2.5}];
  const payload={value:{timeSeries:[series({code:'00010',unit:'deg C'})]}};
  assert.deepEqual(rivers.normalize(payload,sites),[]);
});

test('NOAA forecast trend remains separate from observed USGS trend',()=>{
  const trend=context.normalizeForecastTrend([
    {validTime:'2026-08-31T12:00:00Z',primary:5.0,secondary:1000},
    {validTime:'2026-09-01T12:00:00Z',primary:5.8,secondary:1400}
  ]);
  assert.equal(trend.direction,'rising');
  assert.equal(trend.stage_change_ft,0.8);
  assert.equal(trend.flow_change,400);
});

test('NWS weather window summarizes precipitation and wind without claiming river response',()=>{
  const now=Date.now();
  const at=(hours)=>new Date(now+hours*3600000).toISOString();
  const result=context.weatherWindow([
    {startTime:at(1),temperature:70,windSpeed:'5 to 10 mph',shortForecast:'Mostly Cloudy',probabilityOfPrecipitation:{value:20}},
    {startTime:at(5),temperature:66,windSpeed:'12 mph',shortForecast:'Rain Showers',probabilityOfPrecipitation:{value:70}},
    {startTime:at(20),temperature:62,windSpeed:'8 mph',shortForecast:'Rain Showers',probabilityOfPrecipitation:{value:55}}
  ],24);
  assert.equal(result.max_precip_probability,70);
  assert.equal(result.max_wind_mph,12);
  assert.equal(result.min_air_temp_f,62);
  assert.ok(Date.parse(result.first_50pct_precip_at));
});

test('river context accepts only bounded numeric USGS site IDs',()=>{
  assert.deepEqual(context.validSiteIds('04135700,04142000,bad,04135700'),['04135700','04142000']);
  assert.equal(context.validSiteIds('1,2,3').length,0);
  assert.equal(context.validSiteIds('04135700,04142000,04152500,04153300,04153500,04154000,04155000').length,6);
});


test('River Intelligence inline client parses as JavaScript',()=>{
  const page=fs.readFileSync(require.resolve('../public/national-tools/rivers/index.html'),'utf8');
  const match=page.match(/<script>\s*(document\.addEventListener[\s\S]*?)<\/script>/);
  assert.ok(match,'river inline client script not found');
  assert.doesNotThrow(()=>new Function(match[1]));
  for(const phrase of ['What changed?','What’s next?','No combined safety score','Paddling context','Fishing context','Swimming context','Ecology context','River trip planning']){
    assert.ok(page.includes(phrase),phrase);
  }
});


test('trend windows anchor to latest observation time rather than server wall clock',()=>{
  const points=[
    {value:800,time:'2026-08-30T12:00:00.000-04:00'},
    {value:900,time:'2026-08-31T06:00:00.000-04:00'},
    {value:1000,time:'2026-08-31T12:00:00.000-04:00'}
  ];
  assert.equal(rivers.atAgo(points,6,'2026-08-31T12:00:00.000-04:00').value,900);
  assert.equal(rivers.atAgo(points,24,'2026-08-31T12:00:00.000-04:00').value,800);
});


test('river core observations can retain flow while optional sensor enrichment is merged separately',()=>{
  const core=[{
    id:'04157000',discharge_cfs:1000,gage_height_ft:14.5,water_temp_f:null,
    sensors:{water_temperature:null,turbidity:null,dissolved_oxygen:null,specific_conductance:null,ph:null},
    sensor_availability:[]
  }];
  const enrichment=[{
    id:'04157000',water_temp_f:68,
    sensors:{water_temperature:{value:68},turbidity:{value:6},dissolved_oxygen:null,specific_conductance:null,ph:null},
    sensor_availability:['water_temperature','turbidity']
  }];
  const [merged]=rivers.mergeEnrichment(core,enrichment);
  assert.equal(merged.discharge_cfs,1000);
  assert.equal(merged.gage_height_ft,14.5);
  assert.equal(merged.water_temp_f,68);
  assert.deepEqual(merged.sensor_availability,['water_temperature','turbidity']);
});


test('river discovery groups nearby USGS monitoring sites by waterway before live detail',()=>{
  assert.equal(rivers.riverName('RIFLE RIVER NEAR STERLING, MI'),'Rifle River');
  assert.equal(rivers.riverName('SOUTH PLATTE RIVER AT DENVER, CO'),'South Platte River');
  const discovery=rivers.discoveryRivers(44.276408,-84.238613,50,200);
  assert.equal(discovery.radius_miles,50);
  assert.ok(discovery.rivers.length>0);
  assert.ok(discovery.total_sites_in_radius>=discovery.returned_sites);
  assert.ok(discovery.rivers.some(r=>/Rifle River/i.test(r.name)));
  for(const river of discovery.rivers){
    assert.ok(river.gauges.length>=1);
    assert.equal(river.gauge_count,river.gauges.length);
    for(const gauge of river.gauges)assert.ok(gauge.distance_miles<=50);
  }
});

test('selected river lookup resolves an exact indexed USGS site instead of guessing another gauge',()=>{
  const selected=rivers.indexedSite('04142000',44.276408,-84.238613);
  assert.equal(selected.id,'04142000');
  assert.match(selected.name,/RIFLE RIVER NEAR STERLING/i);
  assert.ok(Number.isFinite(selected.distance_miles));
  assert.equal(rivers.indexedSite('999999999999999',44.276408,-84.238613),null);
});

test('river page is discovery-first and never auto-opens the first returned gauge',()=>{
  const page=fs.readFileSync(require.resolve('../public/national-tools/rivers/index.html'),'utf8');
  assert.match(page,/Nearby monitored rivers/);
  assert.match(page,/Choose a monitored river near/);
  assert.match(page,/mode=discovery/);
  assert.match(page,/data-site-id/);
  assert.match(page,/openSelectedSite/);
  assert.match(page,/← River list/);
  assert.doesNotMatch(page,/const first=d\.gauges\[0\][\s\S]{0,400}document\.getElementById\("answer"\)/);
  assert.match(page,/Live readings do not load until you make that choice/);
});


test("river detail keeps obvious back-and-forth controls while preserving chooser state",()=>{
  const page=fs.readFileSync(require.resolve("../public/national-tools/rivers/index.html"),"utf8");
  assert.match(page,/id="back-to-rivers"[^>]*>← River list</);
  assert.match(page,/id="choose-another-river"[^>]*>← Choose another river</);
  assert.match(page,/function returnToRiverList\(\)/);
  assert.match(page,/addEventListener\("click",returnToRiverList\)/);
  assert.match(page,/currentRadius/);
  assert.match(page,/currentFilter/);
});
