const corsHeaders={ "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS", "Content-Type":"application/json" };
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:corsHeaders});
const clean=(v,max=1200)=>String(v??"").trim().slice(0,max);
const rate=new Map<string,{count:number,start:number}>();
function allowed(req:Request){const ip=req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown",now=Date.now(),hit=rate.get(ip);if(!hit||now-hit.start>60000){rate.set(ip,{count:1,start:now});return true}if(hit.count>=20)return false;hit.count++;return true}
async function get(path,key,token=""){const res=await fetch(`${Deno.env.get("SUPABASE_URL")}${path}`,{headers:{apikey:key,Authorization:token?`Bearer ${token}`:`Bearer ${key}`}});if(!res.ok)throw new Error(`Supabase request failed: ${res.status}`);return res.json()}
async function rpc(path,key,token,body){const res=await fetch(`${Deno.env.get("SUPABASE_URL")}${path}`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(body)});if(!res.ok)throw new Error(`Supabase RPC failed: ${res.status}`);return res.json()}
function outputText(d){if(typeof d?.output_text==="string")return d.output_text.trim();return (d?.output??[]).flatMap((x:any)=>x?.content??[]).filter((x:any)=>x?.type==="output_text").map((x:any)=>x.text).join("\n").trim()}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return json({error:"POST required."},405);
 if(!allowed(req))return json({error:"Too many AI requests. Please try again in a minute."},429);
 const openai=Deno.env.get("OPENAI_API_KEY")||Deno.env.get("openai_api_key"), url=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||Deno.env.get("SUPABASE_ANON_KEY");
 if(!openai||!url||!key)return json({error:"AI service is not configured."},503);
 try{
  const b=await req.json(), message=clean(b?.message), page=clean(b?.page,80), mode=clean(b?.mode,60); if(!message)return json({error:"Message is required."},400);
  const h=req.headers.get("Authorization")||"", token=h.startsWith("Bearer ")?h.slice(7):"";

  let products:any[]=[]; let categories:any[]=[]; let brands:any[]=[]; let variants:any[]=[];
  try{products=await get("/rest/v1/products?select=id,name,slug,description,price,status,category_id,brand_id&status=eq.active&order=name&limit=60",key)}catch(e){console.error("AI products load failed",e)}
  try{categories=await get("/rest/v1/categories?select=id,name,is_active&is_active=eq.true&order=sort_order,name&limit=50",key)}catch(e){console.error("AI categories load failed",e)}
  try{brands=await get("/rest/v1/brands?select=id,name,is_active&is_active=eq.true&order=name&limit=50",key)}catch(e){console.error("AI brands load failed",e)}
  try{variants=await get("/rest/v1/product_variants?select=product_id,size,color,stock&order=product_id&limit=300",key)}catch(e){console.error("AI variants load failed",e)}

  const cm=new Map(categories.map((x:any)=>[x.id,x.name])), bm=new Map(brands.map((x:any)=>[x.id,x.name])), vm=new Map<string,any[]>();
  for(const v of variants){const a=vm.get(v.product_id)||[];a.push({size:v.size||"",color:v.color||"",stock:Number(v.stock||0)});vm.set(v.product_id,a)}
  const catalog=products.map((p:any)=>{const pv=vm.get(p.id)||[],available=pv.filter(v=>v.stock>0);return {id:p.id,name:p.name,description:clean(p.description,220),price:p.price,category:cm.get(p.category_id)||"Uncategorized",brand:bm.get(p.brand_id)||"",product_url:`product.html?id=${encodeURIComponent(p.id)}`,stock_total:pv.reduce((n,v)=>n+v.stock,0),available_options:available.slice(0,30)}});

  let user:any={signed_in:false};
  if(token)try{
   const ar=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${token}`}});
   if(ar.ok){const u=await ar.json(), ps=await get(`/rest/v1/profiles?select=id,full_name,role&id=eq.${encodeURIComponent(u.id)}&limit=1`,key,token), p=ps[0]||{};
    user={signed_in:true,user_id:u.id,name:p.full_name||u.user_metadata?.full_name||"",role:p.role||"customer"};
    if(user.role==="customer"&&/order|delivery|return|refund|cancel|payment|courier|track|eta|eligible/i.test(message)){
      try{
       const os=await get(`/rest/v1/orders?select=id,order_number,created_at,status,delivery_status,total,payment_status,payment_method,payment_provider,tracking_provider,tracking_number,shipped_at,out_for_delivery_at,delivered_at,estimated_delivery_date,updated_at&user_id=eq.${encodeURIComponent(u.id)}&order=created_at.desc&limit=8`,key,token);
       const orderIds=os.map((o:any)=>o.id); user.recent_orders=os;
       if(orderIds.length){const ids=orderIds.map((x:any)=>encodeURIComponent(x)).join(",");
        try{user.shipments=await get(`/rest/v1/shipments?select=id,order_id,direction,provider,awb_number,status,tracking_url,estimated_delivery_date,updated_at&order_id=in.(${ids})&order=created_at.desc&limit=20`,key,token)}catch(e){console.error("AI shipments load failed",e)}
        try{user.returns=await get(`/rest/v1/return_requests?select=id,order_id,request_type,reason,status,requested_at,resolved_at,approved_at,rejected_at,return_shipment_id,reverse_pickup_id,refund_status,refund_amount,refund_reference,refund_processed_at&order_id=in.(${ids})&order=requested_at.desc&limit=20`,key,token)}catch(e){console.error("AI returns load failed",e)}
        try{user.payments=await get(`/rest/v1/payment_transactions?select=id,order_id,provider,provider_payment_id,provider_order_id,amount,currency,status,created_at,updated_at&order_id=in.(${ids})&order=created_at.desc&limit=20`,key,token)}catch(e){console.error("AI payments load failed",e)}
       }
      }catch(e){console.error("AI customer support context load failed",e)}
    }
    if(user.role==="seller")try{user.seller_products=await get(`/rest/v1/products?select=id,name,description,price,compare_at_price,status,category_id,brand_id,slug,rejection_reason,approval_submitted_at&seller_id=eq.${encodeURIComponent(u.id)}&order=name&limit=50`,key,token);const productIds=(user.seller_products||[]).map((p:any)=>p.id);if(productIds.length){const ids=productIds.map((x:any)=>encodeURIComponent(x)).join(",");try{const items=await get(`/rest/v1/order_items?select=id,order_id,product_id,variant_id,product_name,unit_price,quantity,created_at&product_id=in.(${ids})&order=created_at.desc&limit=100`,key,token);user.seller_order_items=items;const orderIds=[...new Set(items.map((x:any)=>x.order_id))];if(orderIds.length){const oids=orderIds.map((x:any)=>encodeURIComponent(x)).join(",");try{user.seller_orders=await get(`/rest/v1/orders?select=id,order_number,status,payment_status,total,delivery_status,tracking_provider,tracking_number,shipped_at,out_for_delivery_at,delivered_at,estimated_delivery_date,created_at,updated_at&id=in.(${oids})&order=created_at.desc&limit=100`,key,token)}catch(e){console.error("AI seller orders load failed",e)}try{user.seller_returns=await get(`/rest/v1/return_requests?select=id,order_id,order_item_id,request_type,reason,status,requested_at,resolved_at,approved_at,rejected_at,return_shipment_id,reverse_pickup_id,refund_status,refund_amount,refund_reference,refund_processed_at&order_item_id=in.(${items.map((x:any)=>encodeURIComponent(x.id)).join(",")})&order=requested_at.desc&limit=100`,key,token)}catch(e){console.error("AI seller returns load failed",e)}}}catch(e){console.error("AI seller order context load failed",e)}}if(/settlement|payout|payment|earning|balance/i.test(message))try{user.seller_payouts=await get(`/rest/v1/seller_payouts?select=id,settlement_id,amount,status,provider,provider_reference,failure_reason,requested_at,approved_at,paid_at,created_at&seller_id=eq.${encodeURIComponent(u.id)}&order=created_at.desc&limit=50`,key,token)}catch(e){console.error("AI seller payout context load failed",e)} }catch(e){console.error("AI seller support context load failed",e)}
    
    if(user.role==="seller"){
      try{
        const sellerProducts=user.seller_products||await get(`/rest/v1/products?select=id,name,description,price,compare_at_price,status,category_id,brand_id,slug,rejection_reason,approval_submitted_at&seller_id=eq.${encodeURIComponent(u.id)}&order=name&limit=100`,key,token);
        user.seller_products=sellerProducts;
        const productIds=sellerProducts.map((p:any)=>p.id).filter(Boolean);
        const now=new Date(), start30=new Date(now.getTime()-30*86400000), iso30=encodeURIComponent(start30.toISOString());
        if(productIds.length){
          const ids=productIds.map((x:any)=>encodeURIComponent(x)).join(",");
          try{user.seller_variants=await get(`/rest/v1/product_variants?select=product_id,size,color,stock&product_id=in.(${ids})&limit=500`,key,token)}catch(e){console.error("AI seller variants load failed",e)}
          try{user.seller_order_items=await get(`/rest/v1/order_items?select=id,order_id,product_id,product_name,unit_price,quantity,created_at&product_id=in.(${ids})&created_at=gte.${iso30}&order=created_at.desc&limit=500`,key,token)}catch(e){console.error("AI seller order items load failed",e)}
          const orderIds=[...new Set((user.seller_order_items||[]).map((x:any)=>x.order_id).filter(Boolean))];
          if(orderIds.length){
            const oids=orderIds.map((x:any)=>encodeURIComponent(x)).join(",");
            try{user.seller_orders=await get(`/rest/v1/orders?select=id,order_number,status,total,created_at,delivery_status&id=in.(${oids})&order=created_at.desc&limit=500`,key,token)}catch(e){console.error("AI seller analytics orders load failed",e)}
          }
          try{user.seller_product_views_30d=await get(`/rest/v1/analytics_events?select=product_id,event_name,occurred_at&product_id=in.(${ids})&event_name=eq.product_view&occurred_at=gte.${iso30}&limit=1000`,key,token)}catch(e){console.error("AI seller product views load failed",e)}
        }
        const orders=user.seller_orders||[], items=user.seller_order_items||[], validOrderIds=new Set(orders.filter((o:any)=>!["cancelled","returned"].includes(String(o.status||"").toLowerCase())).map((o:any)=>o.id));
        const validItems=items.filter((i:any)=>validOrderIds.has(i.order_id));
        const day=(d:Date)=>d.toISOString().slice(0,10), today=day(now), yesterday=day(new Date(now.getTime()-86400000));
        const sumFor=(date:string)=>validItems.filter((i:any)=>String(i.created_at||"").slice(0,10)===date).reduce((n:number,i:any)=>n+Number(i.unit_price||0)*Number(i.quantity||0),0);
        user.seller_sales_30d={today_sales:sumFor(today),yesterday_sales:sumFor(yesterday),today_units:validItems.filter((i:any)=>String(i.created_at||"").slice(0,10)===today).reduce((n:number,i:any)=>n+Number(i.quantity||0),0),yesterday_units:validItems.filter((i:any)=>String(i.created_at||"").slice(0,10)===yesterday).reduce((n:number,i:any)=>n+Number(i.quantity||0),0),total_sales_30d:validItems.reduce((n:number,i:any)=>n+Number(i.unit_price||0)*Number(i.quantity||0),0),total_units_30d:validItems.reduce((n:number,i:any)=>n+Number(i.quantity||0),0)};
        const perf=new Map<string,any>(); for(const p of sellerProducts)perf.set(p.id,{product_id:p.id,name:p.name,units_sold:0,sales:0,views:0});
        for(const i of validItems){const x=perf.get(i.product_id);if(x){x.units_sold+=Number(i.quantity||0);x.sales+=Number(i.unit_price||0)*Number(i.quantity||0)}} for(const v of user.seller_product_views_30d||[]){const x=perf.get(v.product_id);if(x)x.views+=1}
        user.seller_product_performance_30d=[...perf.values()].sort((a,b)=>b.units_sold-a.units_sold||b.views-a.views).slice(0,100);
        user.seller_low_stock=(user.seller_variants||[]).filter((v:any)=>Number(v.stock||0)<=5).map((v:any)=>({product_id:v.product_id,size:v.size||"",color:v.color||"",stock:Number(v.stock||0)})).slice(0,100);
        user.seller_conversion={available:false,reason:"Only product_view events are currently recorded for these products; a complete conversion funnel event set is not available."};
      }catch(e){console.error("AI seller business analytics context failed",e)}
    }
    if(user.role==="admin"&&/analytics|sales|orders|seller|customer|product|insight|performance/i.test(message)){try{const e=new Date(),s=new Date(e.getTime()-30*86400000);user.analytics_30d=await rpc("/rest/v1/rpc/admin_get_analytics",key,token,{p_start_at:s.toISOString(),p_end_at:e.toISOString()})}catch{user.analytics_30d={unavailable:true}}}
   }
  }catch(e){console.error("AI auth context load failed",e)}

  const instructions=`You are Apna Store AI, a helpful shopping and support co-pilot for Apna Store. Reply in the user language when practical (English, Hindi, Hinglish). Use ONLY supplied live catalog/account/order/shipment/return/payment/payout context for store-specific facts. Never invent products, prices, stock, listing rejection reasons, settlement status, payout status, order status, courier, AWB, tracking, ETA, refund status, roles, permissions, or completed actions. For sellers, answer only from records belonging to the authenticated seller. Listing rejection/correction guidance must use supplied rejection_reason and actual listing fields; never invent a rejection reason. Settlement/payout answers must use supplied seller_payouts data; if no record exists, say status is unavailable. Seller order/return answers must use seller-owned product/order-item context only. Seller business questions about today's sales, yesterday comparison, slow-selling products, low stock, best sellers, promotion ideas, and conversion must use only the supplied seller analytics context. If conversion data is unavailable or the funnel is incomplete, say that clearly rather than estimating it. AI is advisory only: NEVER authorize or execute payments, change price, change stock, change roles/permissions, approve/reject returns, issue refunds, create shipments, assign AWB, schedule pickup, or claim an action was completed. If a real site action is needed, explain where to do it. Keep answers concise (normally 2-6 short sentences or bullets). ${mode==="listing_assistant"?"For listing_assistant mode, follow the user request exactly and return ONLY valid JSON with the requested keys; do not wrap it in Markdown fences.":""}`;
  const ai=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${openai}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5.6-luna",instructions,input:`LIVE APNA STORE CONTEXT:\n${JSON.stringify({current_page:page,catalog,user})}\n\nCUSTOMER MESSAGE:\n${message}`})});
  if(!ai.ok){const detail=(await ai.text()).slice(0,300);console.error("OpenAI error",ai.status,detail);return json({error:"AI service is temporarily unavailable."},502)}
  const answer=outputText(await ai.json()); if(!answer)return json({error:"AI returned an empty response."},502);
  return json({answer,role:user.role||"customer"});
 }catch(e){console.error("AI error",e);return json({error:"Something went wrong. Please try again."},500)}
});