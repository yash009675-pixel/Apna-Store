const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const label=v=>String(v||"").replaceAll("_"," ");
const time=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?"":d.toLocaleString("en-IN",{day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"})};
let flags=[];
async function load(){
 const {data:s}=await apnaSupabase.auth.getSession();
 if(!s.session){$("message").textContent="Sign in required.";return}
 const {data:p}=await apnaSupabase.from("profiles").select("role").eq("id",s.session.user.id).maybeSingle();
 if(p?.role!=="admin"){$("message").textContent="Admin access required.";return}
 const {data,error}=await apnaSupabase.rpc("admin_list_risk_flags",{p_status:$("status").value||null});
 if(error){$("message").textContent="Could not load risk flags.";console.error(error);return}
 flags=data||[];$("message").textContent=flags.length+" flag"+(flags.length===1?"":"s")+" shown.";
 $("list").innerHTML=flags.length?flags.map(f=>'<article class="risk-card"><div class="risk-card-top"><div><h2>'+esc(label(f.risk_type))+'</h2><span class="risk-badge">'+esc(f.severity)+" · "+esc(f.status)+'</span></div><small>'+esc(time(f.last_seen_at))+'</small></div><p class="risk-reason">'+esc(f.reason)+'</p><div class="risk-meta">'+(f.user_id?"Customer: "+esc(f.user_id):"")+(f.seller_id?" · Seller: "+esc(f.seller_id):"")+(f.order_id?" · Order: "+esc(f.order_id):"")+'</div><details class="risk-evidence"><summary>Evidence</summary>'+esc(JSON.stringify(f.evidence,null,2))+'</details><div class="risk-actions">'+(f.status==="open"?'<button class="risk-action" data-status="reviewed" data-id="'+esc(f.id)+'">Mark reviewed</button><button class="risk-action" data-status="dismissed" data-id="'+esc(f.id)+'">Dismiss</button><button class="risk-action" data-status="confirmed" data-id="'+esc(f.id)+'">Confirm</button>':"")+'</div></article>').join(""):'<div class="risk-empty">No risk flags match this status. The system does not create placeholder or fake flags.</div>';
 $("list").querySelectorAll("[data-status]").forEach(b=>b.onclick=async()=>{b.disabled=true;const note=b.dataset.status==="confirmed"?"Confirmed after admin review.":b.dataset.status==="dismissed"?"Dismissed after admin review.":"Reviewed by admin.";const r=await apnaSupabase.rpc("admin_update_risk_flag",{p_id:b.dataset.id,p_status:b.dataset.status,p_resolution_note:note});if(r.error){b.disabled=false;alert("Could not update risk flag.");return}await load()});
}
$("status").onchange=load;
$("scan").onclick=async()=>{$("scan").disabled=true;$("message").textContent="Running scan…";const r=await apnaSupabase.rpc("admin_refresh_risk_flags");$("scan").disabled=false;if(r.error){$("message").textContent="Risk scan failed.";console.error(r.error);return}await load()};
load();