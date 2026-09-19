import { normalizeLocation, SRI_LANKA_REGION } from "./locationPicker";

export function buildProviderRouteMapHtml(providerLocation, driverLocation) {
  const provider = normalizeLocation(providerLocation);
  const driver = normalizeLocation(driverLocation);
  const center = provider || driver || SRI_LANKA_REGION;
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
 integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<style>html,body,#map{height:100%;width:100%;margin:0}body{background:#eef2f6}
.tracking-pin{border:3px solid white;border-radius:50%;box-shadow:0 1px 5px #555}
.provider-pin{background:#0f766e}.driver-pin{background:#2563eb}
.leaflet-control-attribution{font-size:10px}</style></head>
<body><div id="map" aria-label="Provider route to your breakdown location"></div>
<script>
function send(type){window.ReactNativeWebView.postMessage(JSON.stringify({type:type}));}
window.addEventListener('error',function(){send('error');});
</script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
 integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="" onerror="send('error')"></script>
<script>
if(typeof L==='undefined'){send('error');}else{
 var map=L.map('map',{attributionControl:false}).setView([${center.latitude},${center.longitude}],13);
 L.control.attribution({position:'bottomleft',prefix:false}).addTo(map);
 var tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
  maxZoom:19,attribution:'&copy; <a target="_blank" rel="noopener noreferrer" href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
 });
 tiles.on('tileload',function(){send('ready');});
 tiles.on('tileerror',function(){send('error');});
 tiles.addTo(map);
 var endpoints=[];
 function addPin(location,kind,label){
  if(!location)return;
  var point=[location.latitude,location.longitude];endpoints.push(point);
  L.marker(point,{title:label,icon:L.divIcon({className:'tracking-pin '+kind,iconSize:[22,22],iconAnchor:[11,11]})})
   .addTo(map).bindTooltip(label);
 }
 addPin(${JSON.stringify(provider)},'provider-pin','Provider service location');
 addPin(${JSON.stringify(driver)},'driver-pin','Your breakdown location');
 var routeLine=null;
 window.setRoadRoute=function(coordinates){
  if(routeLine){map.removeLayer(routeLine);routeLine=null;}
  var points=(coordinates||[]).map(function(point){return [point.latitude,point.longitude];});
  if(points.length>1)routeLine=L.polyline(points,{color:'#2563eb',weight:5,opacity:0.85}).addTo(map);
  var bounds=points.concat(endpoints);
  if(bounds.length)map.fitBounds(bounds,{padding:[35,35],maxZoom:16});
 };
 window.setRoadRoute([]);
 window.addEventListener('resize',function(){map.invalidateSize();});
 send('initialized');
}
</script></body></html>`;
}
