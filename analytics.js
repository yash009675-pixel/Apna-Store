(function(){
 const KEY="apnaAnalyticsSessionId";
 function sessionId(){try{let v=localStorage.getItem(KEY);if(v)return v;v=crypto.randomUUID?crypto.randomUUID():String(Date.now())+"-"+Math.random().toString(16).slice(2);localStorage.setItem(KEY,v);return v}catch{return null}}
 async function insert(row){if(!window.apnaSupabase)return;const sid=sessionId();if(!sid)return;try{await apnaSupabase.from(row.event_name==="search_query"?"search_events":"analytics_events").insert({...row,session_id:sid,path:location.pathname})}catch(e){console.debug("Analytics tracking skipped",e)}}
 window.apnaTrackProductView=productId=>{if(productId)insert({event_name:"product_view",product_id:productId})};
 window.apnaTrackSearch=(term,resultCount,productIds)=>{term=String(term||"").trim().toLowerCase().slice(0,100);if(!term)return;insert({event_name:"search_query",search_term:term,result_count:Math.max(0,Math.min(1000,Number(resultCount)||0)),matched_product_ids:Array.isArray(productIds)?productIds.slice(0,20):[]})};
})();