import { normalizeLocation, SRI_LANKA_REGION } from "./locationPicker";

export function parseMapMessage(data) {
  try {
    const message = JSON.parse(data);
    if (message?.type === "ready" || message?.type === "error") return { type: message.type };
    if (message?.type === "select") {
      const location = normalizeLocation(message.location);
      if (location) return { type: "select", location };
    }
  } catch (_error) {
    // Ignore malformed messages from the embedded map.
  }
  return null;
}

export function buildMapHtml(initialLocation, { readOnly = false } = {}) {
  const selected = normalizeLocation(initialLocation);
  const center = selected || SRI_LANKA_REGION;
  return `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<style>html,body,#map{height:100%;width:100%;margin:0}body{background:#eef2f6}
.service-pin{background:#0f766e;border:3px solid white;border-radius:50%;box-shadow:0 1px 5px #555}
.leaflet-control-attribution{font-size:10px}</style>
</head><body><div id="map" aria-label="Service location map"></div>
<script>
function send(message){window.ReactNativeWebView.postMessage(JSON.stringify(message));}
window.addEventListener('error',function(){send({type:'error'});});
</script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""
  onerror="send({type:'error'})"></script>
<script>
if(typeof L==='undefined'){send({type:'error'});}else{
  var map=L.map('map',{attributionControl:false}).setView([${center.latitude},${center.longitude}],${selected ? 15 : 7});
  L.control.attribution({position:'bottomleft',prefix:false}).addTo(map);
  var tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,
    attribution:'&copy; <a target="_blank" rel="noopener noreferrer" href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  tiles.on('tileload',function(){send({type:'ready'});});
  tiles.on('tileerror',function(){send({type:'error'});});
  tiles.addTo(map);
  var marker=null;
  var pin=L.divIcon({className:'service-pin',iconSize:[22,22],iconAnchor:[11,11]});
  function selectPoint(point){
    point=point.wrap();
    window.setSelectedLocation({latitude:point.lat,longitude:point.lng},false);
    send({type:'select',location:{latitude:point.lat,longitude:point.lng}});
  }
  window.setSelectedLocation=function(location,centerMap){
    if(!location){if(marker){map.removeLayer(marker);marker=null;}return;}
    var point=[location.latitude,location.longitude];
    if(marker){marker.setLatLng(point);}else{
      marker=L.marker(point,{draggable:${!readOnly},icon:pin,title:'Service location'}).addTo(map);
      marker.on('dragend',function(){selectPoint(marker.getLatLng());});
    }
    if(centerMap)map.setView(point,15);
  };
  window.setSelectedLocation(${JSON.stringify(selected)},false);
  ${readOnly ? "" : "map.on('click',function(event){selectPoint(event.latlng);});"}
  window.addEventListener('resize',function(){map.invalidateSize();});
}
</script></body></html>`;
}
