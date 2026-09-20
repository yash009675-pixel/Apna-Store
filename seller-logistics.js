const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const label=v=>String(v||"—").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
(async()=>{
 const {data:{session}}=await apnaSupabase.auth.getSession();
 if(!session){location.href="auth.html";return}
 const {data:p}=await apnaSupabase.from("profiles").select("role").eq("id",session.user.id).maybeSingle();
 if(!p||!["seller","admin"].includes(p.role)){location.href="account.html";return}
 const {data,error}=await apnaSupabase.from("shipments").select("id,order_id,direction,provider,awb_number,pickup_id,status,tracking_url,ndr_status,ndr_reason,updated_at,orders(order_number)").order("updated_at",{ascending:false}).limit(500);
 if(error){$("msg").textContent="Could not load logistics: "+error.message;return}
 const rows=data||[];
 $("total").textContent=rows.length;
 $("transit").textContent=rows.filter(s=>["picked_up","in_transit","out_for_delivery"].includes(s.status)).length;
 $("delivered").textContent=rows.filter(s=>s.status==="delivered").length;
 $("attention").textContent=rows.filter(s=>s.ndr_status||["rto_initiated","rto_delivered"].includes(s.status)).length;
 if(!rows.length){$("msg").textContent="No courier shipments yet. Create a real shipment from Seller Orders.";return}
 $("msg").hidden=true;$("tbl").hidden=false;
 $("rows").innerHTML=rows.map(s=>'<tr><td><strong>'+esc(s.orders?.order_number||"—")+'</strong></td><td>'+esc(label(s.direction))+'</td><td>'+esc(s.provider||"—")+'</td><td>'+esc(s.awb_number||"AWB pending")+'</td><td><span class="pill">'+esc(label(s.status))+'</span></td><td>'+esc(s.pickup_id||"—")+'</td><td>'+(s.ndr_status?'<span class="pill warn">NDR: '+esc(label(s.ndr_status))+'</span>':["rto_initiated","rto_delivered"].includes(s.status)?'<span class="pill warn">RTO</span>':"—")+'</td></tr>').join("");
})();