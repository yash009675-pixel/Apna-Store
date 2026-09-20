const q=new URLSearchParams(location.search),orderId=q.get("order");
const info=document.getElementById("orderInfo"),form=document.getElementById("requestForm"),msg=document.getElementById("message");
function esc(v){return String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function fail(t){info.textContent=t;form.style.display="none"}
(async()=>{
 const {data:{session}}=await apnaSupabase.auth.getSession();
 if(!session){fail("Please sign in to request a return, exchange, or refund.");return}
 if(!orderId||!/^[0-9a-f-]{36}$/i.test(orderId)){fail("Invalid order.");return}
 const {data:o,error}=await apnaSupabase.from("orders").select("id,order_number,delivery_status,status").eq("id",orderId).eq("user_id",session.user.id).maybeSingle();
 if(error||!o){fail("Order not found.");return}
 if(o.delivery_status!=="delivered"||o.status==="cancelled"){fail("This order is not eligible for an after-sales request yet.");return}
 const {data:existing}=await apnaSupabase.from("return_requests").select("id,request_type,reason,status,requested_at,resolution_notes,return_shipment_id,reverse_pickup_id").eq("order_id",o.id).eq("user_id",session.user.id).order("requested_at",{ascending:false}).limit(10);
 if(existing?.length){
   const requests=existing.map(r=>`<div class="summary-line"><span>${esc(r.request_type)} · ${esc(r.status)}${r.return_shipment_id?" · Reverse shipment created":""}</span><small>${esc(new Date(r.requested_at).toLocaleDateString("en-IN"))}</small></div>`).join("");
   info.innerHTML=`Order <b>${esc(o.order_number)}</b> has been delivered.<div style="margin-top:12px"><b>After-sales requests</b>${requests}</div>`;
   if(existing.some(r=>["requested","approved","pickup_scheduled","picked_up","in_transit"].includes(r.status))){form.style.display="none";msg.textContent="An active after-sales request already exists for this order.";return}
 }else info.innerHTML=`Order <b>${esc(o.order_number)}</b> has been delivered.`;
 form.addEventListener("submit",async e=>{
   e.preventDefault();msg.textContent="Submitting request…";
   const {error}=await apnaSupabase.from("return_requests").insert({order_id:o.id,user_id:session.user.id,request_type:document.getElementById("type").value,reason:document.getElementById("reason").value,details:document.getElementById("details").value.trim()||null});
   if(error){console.error(error);msg.textContent=error.message||"Could not submit request.";return}
   msg.textContent="Request submitted successfully. You can track its status from your order details.";form.reset()
 })
})();