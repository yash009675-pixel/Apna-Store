const ACTION_API="https://xxedwtmdylfufrfzyrdb.supabase.co/functions/v1/apna-return-actions";
const RETURN_API="https://xxedwtmdylfufrfzyrdb.supabase.co/functions/v1/apna-courier-return-create";
const COURIER_API="https://xxedwtmdylfufrfzyrdb.supabase.co/functions/v1/apna-courier-actions";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
async function call(url,body){
 const {data:{session}}=await apnaSupabase.auth.getSession();
 if(!session) throw Error("Sign in required.");
 const r=await fetch(url,{method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify(body)});
 const d=await r.json().catch(()=>({}));
 if(!r.ok) throw Error(d.error||"Request failed.");
 return d;
}
const ask=(label,required=true)=>{const v=window.prompt(label,"");if(v===null||required&&!v.trim())throw Error("Operation cancelled.");return v.trim()};
async function createReverse(id){
 const destination={
  name:ask("Seller/warehouse name:"),
  address:ask("Seller/warehouse address:"),
  city:ask("Seller/warehouse city:"),
  state:ask("Seller/warehouse state:"),
  pincode:ask("Seller/warehouse 6-digit pincode:"),
  phone:ask("Seller/warehouse phone:"),
  email:window.prompt("Seller/warehouse email (optional):","")||""
 };
 const pkg={
  weight_kg:ask("Return package weight in kg (example: 0.5):"),
  length_cm:ask("Package length in cm:"),
  width_cm:ask("Package width in cm:"),
  height_cm:ask("Package height in cm:")
 };
 $("msg").textContent="Checking real Shiprocket return courier serviceability…";
 const svc=await call(RETURN_API,{action:"serviceability",return_request_id:id,destination,package:pkg});
 const couriers=svc.couriers||[];
 if(!couriers.length)throw Error("No Shiprocket return courier is serviceable for this route/package.");
 const options=couriers.slice(0,10).map((c,i)=>(i+1)+". "+(c.name||"Courier")+" | ₹"+(c.freight_charge??"—")+" | ETA "+(c.etd||c.etd_hours||"—")+" | ID "+c.id).join("\n");
 const pick=Number(window.prompt("Choose a real return courier:\n\n"+options,"1"));
 if(!Number.isInteger(pick)||pick<1||pick>couriers.length)throw Error("Invalid courier selection.");
 const courier=couriers[pick-1];
 $("msg").textContent="Creating real Shiprocket reverse shipment…";
 const created=await call(RETURN_API,{action:"create",return_request_id:id,destination,package:pkg});
 const shipment=created.shipment;
 if(!shipment?.id)throw Error("Reverse shipment was not created locally.");
 $("msg").textContent="Assigning real AWB…";
 const awb=await call(COURIER_API,{action:"assign_awb",shipment_id:shipment.id,courier_id:courier.id});
 $("msg").textContent="Generating return label…";
 const label=await call(COURIER_API,{action:"label",shipment_id:shipment.id});
 $("msg").textContent="Requesting reverse pickup…";
 const pickup=await call(COURIER_API,{action:"pickup",shipment_id:shipment.id});
 const awbNo=awb.shipment?.awb_number||"AWB pending";
 const pickupId=pickup.pickup?.provider_pickup_id||pickup.shipment?.pickup_id||"Pickup ID pending";
 const labelUrl=label.shipment?.label_url;
 window.alert("Reverse shipment created successfully.\n\nCourier: "+(awb.courier_name||courier.name||"Shiprocket")+
 "\nAWB: "+awbNo+"\nPickup ID: "+pickupId+(labelUrl?"\nLabel: "+labelUrl:""));
 await load();
}
function renderRows(rows){
 if(!rows.length){$("list").innerHTML='<div class="card muted">No return requests.</div>';return}
 const body=rows.map(item=>{
  const order=item.orders||{};
  const logistics=[item.return_shipment_id?"Reverse shipment linked":"Not created",item.reverse_pickup_id?"Pickup linked":""].filter(Boolean).join("<br>");
  let actions="—";
  if(item.status==="requested")actions='<button type="button" data-action="approve" data-id="'+esc(item.id)+'">Approve</button><button type="button" data-action="reject" data-id="'+esc(item.id)+'">Reject</button>';
  else if(item.status==="approved"&&!item.return_shipment_id)actions='<button type="button" data-reverse="'+esc(item.id)+'">Create Reverse Shipment</button>';
  else if(item.status==="approved"&&item.return_shipment_id&&!item.reverse_pickup_id)actions='<span class="muted">Shipment created — pickup pending</span>';
  return `<tr><td><strong>${esc(order.order_number)}</strong><br>${esc(order.delivery_status)}</td><td>${esc(item.request_type)}</td><td>${esc(item.reason)}<br><span class="muted">${esc(item.details)}</span></td><td><span class="badge">${esc(item.status)}</span><br>${esc(item.resolution_notes)}</td><td>${esc(new Date(item.requested_at).toLocaleString("en-IN"))}</td><td>${logistics}</td><td class="actions">${actions}</td></tr>`;
 }).join("");
 $("list").innerHTML='<div class="card"><table class="table"><thead><tr><th>Order</th><th>Request</th><th>Reason</th><th>Status</th><th>Requested</th><th>Logistics</th><th>Action</th></tr></thead><tbody>'+body+"</tbody></table></div>";
 $("list").querySelectorAll("button[data-action]").forEach(button=>button.addEventListener("click",async()=>{
  const note=window.prompt(button.dataset.action==="approve"?"Approval note (optional):":"Rejection note (optional):","");
  if(note===null)return;
  button.disabled=true;
  try{await call(ACTION_API,{action:button.dataset.action,return_request_id:button.dataset.id,note});await load()}catch(e){window.alert(e.message||"Return action failed.");button.disabled=false}
 }));
 $("list").querySelectorAll("button[data-reverse]").forEach(button=>button.addEventListener("click",async()=>{
  button.disabled=true;
  try{await createReverse(button.dataset.reverse)}catch(e){window.alert(e.message||"Reverse shipment failed.");button.disabled=false;await load()}
 }));
}
async function load(){
 $("msg").textContent="Loading returns…";
 try{const d=await call(ACTION_API,{action:"list"}),rows=d.return_requests||[];$("msg").textContent=rows.length+" return request(s)";renderRows(rows)}
 catch(e){$("msg").textContent=e.message||"Could not load returns.";$("list").innerHTML=""}
}
$("refresh").addEventListener("click",load);load();