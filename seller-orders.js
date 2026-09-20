const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>"₹"+Number(n||0).toLocaleString("en-IN");
const COURIER_API="https://xxedwtmdylfufrfzyrdb.supabase.co/functions/v1/";
async function callCourier(fn,body){
 const {data:{session}}=await apnaSupabase.auth.getSession();
 if(!session) throw new Error("Sign in required.");
 const r=await fetch(COURIER_API+fn,{method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify(body)});
 const d=await r.json().catch(()=>({}));
 if(!r.ok) throw new Error(d.error||"Courier request failed.");
 return d;
}
async function load(){
 const {data:s}=await apnaSupabase.auth.getSession();
 if(!s.session){location.href="auth.html";return;}
 const {data,error}=await apnaSupabase.rpc("get_seller_orders",{p_status:$( "status").value||null,p_delivery_status:$( "delivery").value||null});
 if(error){$( "message").textContent=error.message;return;}
 const rows=data||[];$( "message").textContent=rows.length+" order(s)";
 $( "panel").innerHTML=!rows.length?"<p>No matching orders.</p>":'<div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th>Order</th><th>Items</th><th>Total</th><th>Payment</th><th>Order status</th><th>Delivery</th><th>Action</th></tr></thead><tbody>'+rows.map(o=>'<tr><td><strong>'+esc(o.order_number)+'</strong><br>'+new Date(o.created_at).toLocaleDateString("en-IN")+'</td><td>'+o.items.map(i=>esc(i.product_name)+" × "+Number(i.quantity)).join("<br>")+'</td><td>'+money(o.seller_total)+'</td><td>'+esc(o.payment_method==="cod"?"COD":o.payment_status||"Online")+'</td><td>'+esc(o.status)+'</td><td>'+esc(o.delivery_status)+'</td><td><button data-id="'+o.id+'" class="manage">Manage</button> <button data-id="'+o.id+'" class="courier">Courier</button></td></tr>').join("")+"</tbody></table></div>";
 $( "panel").querySelectorAll(".manage").forEach(b=>b.onclick=()=>manage(b.dataset.id,rows));
 $( "panel").querySelectorAll(".courier").forEach(b=>b.onclick=()=>courierAction(b.dataset.id,rows));
}
async function manage(id,rows){
 const o=rows.find(x=>x.id===id);
 const status=prompt("Order status (pending/confirmed/processing/shipped/delivered/cancelled)",o.status);if(status===null)return;
 const delivery=prompt("Delivery status (pending/processing/shipped/out_for_delivery/delivered/cancelled/returned)",o.delivery_status);if(delivery===null)return;
 const provider=prompt("Tracking provider (optional)",o.tracking_provider||"");const number=prompt("Tracking number (optional)",o.tracking_number||"");
 const {error}=await apnaSupabase.rpc("update_seller_order_status",{p_order_id:id,p_status:status,p_delivery_status:delivery,p_tracking_provider:provider,p_tracking_number:number});
 if(error)alert(error.message);else load();
}
async function courierAction(orderId,rows){
 const o=rows.find(x=>x.id===orderId); if(!o)return;
 try{
  const pickupName=prompt("Shiprocket pickup location name (must already exist in your Shiprocket account):","");
  if(pickupName===null)return;
  const pickupAddress=prompt("Seller pickup full address:","");if(pickupAddress===null)return;
  const pickupCity=prompt("Pickup city:","");if(pickupCity===null)return;
  const pickupState=prompt("Pickup state:","");if(pickupState===null)return;
  const pickupPincode=prompt("Pickup pincode:","");if(pickupPincode===null)return;
  const pickupPhone=prompt("Pickup phone:","");if(pickupPhone===null)return;
  const weight=Number(prompt("Package weight in kg (minimum 0.50):","0.50"));if(!(weight>=0.5))throw new Error("Minimum package weight is 0.50 kg.");
  const length=Number(prompt("Package length in cm:","20"));const width=Number(prompt("Package width in cm:","15"));const height=Number(prompt("Package height in cm:","10"));
  if(!(length>0&&width>0&&height>0))throw new Error("Valid package dimensions are required.");
  const shipAddress=o.shipping_address||{};
  const service=await callCourier("apna-courier-v3",{action:"serviceability",pickup_postcode:pickupPincode,delivery_postcode:shipAddress.pincode,weight_kg:weight,cod:o.payment_method==="cod"||o.payment_status==="cod"});
  const cs=service.couriers||[];if(!cs.length)throw new Error("No courier partner is currently serviceable for this route.");
  const list=cs.map((c,i)=>(i+1)+". "+(c.name||"Courier")+" | ₹"+Number(c.freight_charge||c.rate||0).toLocaleString("en-IN")+" | ETA "+(c.etd||c.etd_hours||"N/A")).join("\n");
  const pick=prompt("Available courier partners:\n\n"+list+"\n\nEnter the courier number to use:", "1");
  const idx=Number(pick)-1;if(!Number.isInteger(idx)||!cs[idx])return;
  const chosen=cs[idx];
  if(!confirm("Create the real Shiprocket shipment with "+(chosen.name||"selected courier")+"?\n\nThis will create a provider order/shipment."))return;
  const created=await callCourier("apna-courier-create",{order_id:orderId,weight_kg:weight,length_cm:length,width_cm:width,height_cm:height,pickup:{name:pickupName,address:pickupAddress,city:pickupCity,state:pickupState,pincode:pickupPincode,phone:pickupPhone}});
  const shipment=created.shipment;if(!shipment?.id)throw new Error("Shipment was not saved locally.");
  const awb=await callCourier("apna-courier-v3",{action:"assign_awb",shipment_id:shipment.id,courier_id:Number(chosen.id)});
  let msg="Shipment created successfully.\n\nCourier: "+(awb.courier_name||chosen.name||"Selected courier")+"\nAWB: "+(awb.shipment?.awb_number||"Assigned");
  try{const lab=await callCourier("apna-courier-v3",{action:"label",shipment_id:shipment.id});if(lab.shipment?.label_url)msg+="\n\nLabel: "+lab.shipment.label_url;}catch(e){msg+="\n\nLabel generation: "+e.message;}
  try{const pu=await callCourier("apna-courier-v3",{action:"pickup",shipment_id:shipment.id});if(pu.shipment?.pickup_id)msg+="\nPickup ID: "+pu.shipment.pickup_id;}catch(e){msg+="\nPickup request: "+e.message;}
  alert(msg);load();
 }catch(e){alert(e.message||"Courier operation failed.");}
}
$( "reload").onclick=load;$( "status").onchange=load;$( "delivery").onchange=load;load();