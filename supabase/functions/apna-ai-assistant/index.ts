const corsHeaders={ "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS", "Content-Type":"application/json" };
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:corsHeaders});
const clean=(v,max=1200)=>String(v??"").trim().slice(0,max);
async function get(path,key,token=""){const res=await fetch(`${Deno.env.get("SUPABASE_URL")}${path}`,{headers:{apikey:key,Authorization:token?`Bearer ${token}`:`Bearer ${key}`}});if(!res.ok)throw new Error("Supabase request failed");return res.json()}
async function rpc(path,key,token,body){const res=await fetch(`${Deno.env.get("SUPABASE_URL")}${path`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(body)});if(!res.ok)throw new Error("Supabase RPC failed");return res.json()}
function outputText(d){if(typeof d?.output_text==="string")return d.output_text.trim();return (d?.output??[]).flatMap((x:any)=>x?.content??[]).filter((x:any)=>x?.type==="output_text").map((x:any)=>x.text).join("\n").trim()}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return json({error:"POST required."},405);
 const openai=Deno.env.get("OPENAI_API_KEY"), url=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||Deno.env.get("SUPABASE_ANON_KEY");
 if(!openai||!url||!key)return json({error:"AI service is not configured."},503);
 try{
  const b=await req.json(), message=clean(b?.message), page=clean(b?.page,80); if(!message)return json({error:"Message is required."},400);
  const h=req.headers.get("Authorization")||"", token=h.startsWith("Bearer ")?h.slice(7):"";
  const [products,categories,brands]=await Promise.all([
   get("/rest/v1/products?select=id,name,description,price,status,category_id,brand_id&status=eq.active&order=name&limit=60",key),
   get("/rest/v1/categories?select=id,name,is_active&is_active=eq.true&order=sort_order,name&limit=50",key),
   get("/rest/v1/brands?select=id,name,is_active&is_active=eq.true&order=name&limit=50",key)
  ]);
  const cm=new Map(categories.map((x:any)=>[x.id,x.name])), bm=new Map(brands.map((x:any)=>[x.id,x.name]));
  const catalog=products.map((p:any)=>({id:p.id,name:p.name,description:clean(p.description,220),price:p.price,category:cm.get(p.category_id)||"Uncategorized",brand:bm.get(p.brand_id)||""}));
  let user:any={signed_in:false};
  if(token)try{
   const ar=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${token}`}}); 
   if(ar.ok){const u=await ar.json(), ps=await get(`/rest/v1/profiles?select=id,full_name,role&id=eq.${encodeURIComponent(u.id)}&limit=1`,key,token), p=ps[0]||{};
    user={signed_in:true,user_id:u.id,name:p.full_name||u.user_metadata?.full_name||"",role:p.role||"customer"};
    if(user.role==="customer"&&/order|delivery|return|refund|cancel|payment/i.test(message)){
      const os=await get(`/rest/v1/orders?select=id,created_at,status,delivery_status,total,payment_status&user_id=eq.${encodeURIComponent(u.id)}&order=created_at.desc&limit=5`,key,token);
      user.recent_orders=os.map((o:any)=>({id:o.id,created_at:o.created_at,status:o.status,delivery_status:o.delivery_status,total:o.total,payment_status:o.payment_status}));
    }
    if(user.role==="seller")user.seller_products=await get(`/rest/v1/products?select=id,name,price,status&seller_id=eq.${encodeURIComponent(u.id)}&order=name&limit=30`,key,token);
    if(user.role==="admin"&&/analytics|sales|orders|seller|customer|product|insight|performance/i.test(message)){try{const e=new Date(),s=new Date(e.getTime()-30*86400000);user.analytics_30d=await rpc("/rest/v1/rpc/admin_get_analytics",key,token,{p_start_at:s.toISOString(),p_end_at:e.toISOString()})}catch{user.analytics_30d={unavailable:true}}}
   }
  }catch{}
  const instructions=`You are Apna Store AI, a helpful shopping co-pilot for an Indian fashion e-commerce site. Reply in the user's language when practical (English, Hindi, or Hinglish). Use only the supplied live catalog/account context for store-specific facts. Never invent products, prices, stock, order status, refunds, delivery dates, roles, permissions, or payment results. You may find products, suggest alternatives from the catalog, explain shopping/account flows, help sellers with catalog tasks, and summarize supplied admin analytics. AI is advisory only: NEVER authorize or execute payment, change price, change stock, change roles/permissions, approve refunds, or claim an order/payment/refund action was completed. If a real site action is needed, explain where to do it instead. Keep answers concise (normally 2-6 short sentences or bullets).`;
  const ai=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${openai}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5.6-luna",instructions,input:`LIVE APNA STORE CONTEXT:\n${JSON.stringify({current_page:page,catalog,user})}\n\nCUSTOMER MESSAGE:\n${message}`})});
  if(!ai.ok){console.error("OpenAI error",ai.status,(await ai.text()).slice(0,400));return json({error:"AI service is temporarily unavailable."},502)}
  const answer=outputText(await ai.json()); if(!answer)return json({error:"AI returned an empty response."},502);
  return json({answer,role:user.role||"customer"});
 }catch(e){console.error("AI error",e);return json({error:"Something went wrong. Please try again."},500)}
});