// The iframe has an opaque origin. Restrict messages to its parent/window and
// expose only the two map updates, without evaluating code from messages.
export function buildWebMapDocument(html) {
  return html.replace("<head>", `<head><script>
window.ReactNativeWebView={postMessage:function(data){
  window.parent.postMessage({channel:'roadcare-map',data:data},'*');
}};
window.addEventListener('message',function(event){
  if(event.source!==window.parent || event.data?.channel!=='roadcare-map-command')return;
  var command=event.data;
  if(command.method==='setSelectedLocation' && window.setSelectedLocation){
    window.setSelectedLocation(command.value,true);
  }else if(command.method==='setRoadRoute' && window.setRoadRoute){
    window.setRoadRoute(command.value);
  }
});
</script>`);
}
