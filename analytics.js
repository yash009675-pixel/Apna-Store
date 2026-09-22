(function(){
 const KEY="apnaAnalyticsSessionId";
 function sessionId(){
  try{let v=localStorage.getItem(KEY);if(v)return v;v=crypto.randomUUID?crypto.randomUUID():String(Date.now())+"-"+Math.random().toString(16).slice(2);localStorage.setItem(KEY,v);return v}catch{return null}
 }
 window.apnaTrackProductView=async function(productId){
  if(!productId||!window.apnaSupabase)return;
  const sid=sessionId();if(!sid)return;
  try{await apnaSupabase.from("analytics_events").insert({session_id:sid,event_name:"product_view",product_id:productId,path:location.pathname})}catch(e){console.debug("Analytics tracking skipped",e)}
 };
})();