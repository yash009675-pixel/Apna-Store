const phase29State={shipments:[],events:[],sellers:[]};
const p29$=id=>document.getElementById(id);
const p29esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const p29label=v=>String(v||"—").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());

function phase29InjectUI(){
  const panel=document.querySelector(".log-panel");
  if(!panel||document.getElementById("phase29Panel"))return;
  const wrap=document.createElement("section");
  wrap.id="phase29Panel";
  wrap.className="log-panel";
  wrap.innerHTML='<div class="log-filters phase29-filters">'+
    '<select id="p29Courier"><option value="">All couriers</option></select>'+
    '<input id="p29City" placeholder="City">'+
    '<input id="p29Pincode" inputmode="numeric" placeholder="Pincode">'+
    '<select id="p29Seller"><option value="">All sellers</option></select>'+
    '<input id="p29Shipment" placeholder="Shipment ID / AWB">'+
    '<input id="p29Date" type="date">'+
    '<button class="log-btn" id="p29Clear">Clear filters</button></div>'+
    '<div class="log-drawer phase29-map"><div><strong>Admin Live Logistics Map</strong><p class="log-muted">Real courier location feed only. No synthetic GPS coordinates are created.</p></div><div id="p29MapGrid" class="phase29-map-grid"></div></div>';
  panel.parentNode.insertBefore(wrap,panel);
  ["p29Courier","p29City","p29Pincode","p29Seller","p29Shipment","p29Date"].forEach(id=>p29$(id).addEventListener(id==="p29Date"||id==="p29Seller"||id==="p29Courier"?"change":"input",phase29Render));
  p29$("p29Clear").onclick=()=>{["p29City","p29Pincode","p29Shipment","p29Date"].forEach(id=>p29$(id).value="");p29$("p29Courier").value="";p29$("p29Seller").value="";phase29Render()};
}

async function phase29Boot(){
  phase29InjectUI();
  const {data:{session}}=await apnaSupabase.auth.getSession();
  if(!session)return;
  const {data:profile}=await apnaSupabase.from("profiles").select("role").eq("id",session.user.id).maybeSingle();
  if(profile?.role!=="admin")return;
  const {data:shipments,error}=await apnaSupabase.from("shipments").select("id,order_id,seller_id,direction,provider,awb_number,status,updated_at,created_at,orders(order_number,shipping_address)").order("updated_at",{ascending:false}).limit(500);
  if(error){p29$("p29MapGrid").innerHTML='<p class="log-muted">Could not load live logistics data: '+p29esc(error.message)+'</p>';return}
  phase29State.shipments=shipments||[];
  const ids=[...new Set(phase29State.shipments.map(x=>x.id))];
  const sellerIds=[...new Set(phase29State.shipments.map(x=>x.seller_id).filter(Boolean))];
  if(sellerIds.length){
    const {data}=await apnaSupabase.from("profiles").select("id,full_name").in("id",sellerIds);
    phase29State.sellers=data||[];
  }
  if(ids.length){
    const {data}=await apnaSupabase.from("shipment_events").select("shipment_id,location,description,event_at").in("shipment_id",ids).order("event_at",{ascending:false}).limit(1000);
    phase29State.events=data||[];
  }
  const couriers=[...new Set(phase29State.shipments.map(x=>x.provider).filter(Boolean))].sort();
  p29$("p29Courier").innerHTML='<option value="">All couriers</option>'+couriers.map(x=>'<option>'+p29esc(x)+'</option>').join("");
  p29$("p29Seller").innerHTML='<option value="">All sellers</option>'+phase29State.sellers.sort((a,b)=>String(a.full_name||"").localeCompare(String(b.full_name||""))).map(x=>'<option value="'+p29esc(x.id)+'">'+p29esc(x.full_name||x.id)+'</option>').join("");
  phase29Render();
}

function phase29Location(s){
  const e=phase29State.events.find(x=>x.shipment_id===s.id&&x.location);
  return e?.location||"Location not supplied by courier";
}
function phase29City(s){
  const a=s.orders?.shipping_address;
  return String(a?.city||a?.town||a?.district||"").trim().toLowerCase();
}
function phase29Pincode(s){
  const a=s.orders?.shipping_address;
  return String(a?.pincode||a?.postal_code||a?.zip||"").trim();
}
function phase29Render(){
  const courier=(p29$("p29Courier")?.value||"").toLowerCase();
  const city=(p29$("p29City")?.value||"").trim().toLowerCase();
  const pin=(p29$("p29Pincode")?.value||"").trim();
  const seller=p29$("p29Seller")?.value||"";
  const shipment=(p29$("p29Shipment")?.value||"").trim().toLowerCase();
  const date=p29$("p29Date")?.value||"";
  const rows=phase29State.shipments.filter(s=>
    (!courier||String(s.provider||"").toLowerCase()===courier)&&
    (!city||phase29City(s).includes(city))&&
    (!pin||phase29Pincode(s).includes(pin))&&
    (!seller||s.seller_id===seller)&&
    (!shipment||String(s.id).toLowerCase().includes(shipment)||String(s.awb_number||"").toLowerCase().includes(shipment)||String(s.orders?.order_number||"").toLowerCase().includes(shipment))&&
    (!date||String(s.updated_at||"").slice(0,10)===date)
  );
  const grid=p29$("p29MapGrid");
  if(!rows.length){grid.innerHTML='<p class="log-muted">No real shipments match these filters.</p>';return}
  const sellerName=id=>phase29State.sellers.find(x=>x.id===id)?.full_name||"Seller";
  grid.innerHTML=rows.map(s=>'<article class="phase29-pin"><div class="phase29-pin-dot"></div><div><strong>'+p29esc(s.orders?.order_number||"Shipment")+'</strong><span>'+p29esc(p29label(s.status))+' · '+p29esc(s.provider||"Courier")+'</span><small>AWB: '+p29esc(s.awb_number||"AWB pending")+'</small><small>Seller: '+p29esc(sellerName(s.seller_id))+'</small><small>Location: '+p29esc(phase29Location(s))+'</small><small>Updated: '+p29esc(new Date(s.updated_at).toLocaleString("en-IN"))+'</small></div></article>').join("");
}
document.addEventListener("DOMContentLoaded",phase29Boot);