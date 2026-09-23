const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const time=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?"":d.toLocaleString("en-IN",{day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"})};
const safeLink=value=>{if(!value)return "";try{const u=new URL(value,location.href);if(u.origin!==location.origin||(u.protocol!=="https:"&&u.protocol!=="http:"))return "";return u.href}catch{return ""}};
const roleCategories={
 customer:[["order","Orders"],["payment","Payments"],["shipment","Shipments"],["delivery","Delivery"],["return","Returns"],["refund","Refunds"],["offers","Offers"],["system","System"]],
 seller:[["new_order","New Orders"],["low_stock","Low Stock"],["pickup","Pickup"],["payment","Payments"],["return","Returns"],["listing","Listing Approval"],["campaign","Campaigns"],["growth","Growth Alerts"],["system","System"]],
 admin:[["critical","Critical Issues"],["payment","Payment Issues"],["courier","Courier Issues"],["seller","Seller Issues"],["support","Support Escalation"],["fraud_risk","Fraud / Risk Alerts"],["system","System"]]
};
let rows=[],role="customer",preferences=[];
function notificationLink(n){const href=safeLink(n.link);return href?'<a href="'+esc(href)+'" data-open="'+esc(n.id)+'">View →</a>':""}
function categoryLabel(v){const found=(roleCategories[role]||[]).find(x=>x[0]===v);return found?found[1]:v}
function renderList(){
 const category=$("categoryFilter").value,read=$("readFilter").value;
 const filtered=rows.filter(n=>(category==="all"||n.category===category)&&(read==="all"||(read==="unread"&&!n.is_read)||(read==="read"&&n.is_read)));
 const unread=rows.filter(x=>!x.is_read).length;
 $("notificationStatus").textContent=rows.length?unread+" unread · "+rows.length+" total":"You're all caught up.";
 $("notificationList").innerHTML=filtered.length?filtered.map(n=>'<article class="notification-card '+(n.is_read?"":"unread")+'"><div><strong>'+esc(n.title)+'</strong><p>'+esc(n.body||"")+'</p><small>'+esc(categoryLabel(n.category))+" · "+esc(time(n.created_at))+'</small></div><div class="notification-actions">'+notificationLink(n)+(n.is_read?"":'<button type="button" data-read="'+esc(n.id)+'">Mark read</button>')+'</div></article>').join(""):'<div class="empty-cart"><h2>No matching notifications.</h2><p>New updates will appear here when real events create notifications.</p></div>';
 $("notificationList").querySelectorAll("[data-read]").forEach(b=>b.onclick=async()=>{b.disabled=true;const r=await apnaSupabase.rpc("mark_notification_read",{p_notification_id:b.dataset.read});if(r.error){b.disabled=false;alert("Could not mark notification as read.");return}await load()});
 $("notificationList").querySelectorAll("[data-open]").forEach(a=>a.onclick=async()=>{const row=rows.find(n=>n.id===a.dataset.open);if(row&&!row.is_read)await apnaSupabase.rpc("mark_notification_read",{p_notification_id:row.id})});
}
async function loadPreferences(){
 const {data:userResult}=await apnaSupabase.auth.getUser();const uid=userResult?.user?.id;
 if(!uid)return;
 const {data,error}=await apnaSupabase.from("notification_preferences").select("channel,category,enabled").eq("user_id",uid).eq("channel","in_app");
 if(error){$("preferenceGrid").textContent="Preferences could not be loaded.";return}
 preferences=data||[];
 const cats=roleCategories[role]||roleCategories.customer;
 $("preferenceGrid").innerHTML=cats.map(([value,label])=>{const found=preferences.find(x=>x.category===value);const enabled=found?found.enabled:true;return '<label class="preference-row"><span>'+esc(label)+'</span><input type="checkbox" data-pref="'+esc(value)+'" '+(enabled?"checked":"")+'></label>'}).join("");
 $("preferenceGrid").querySelectorAll("[data-pref]").forEach(input=>input.onchange=async()=>{input.disabled=true;$("preferenceMessage").textContent="";const r=await apnaSupabase.rpc("set_notification_preference",{p_channel:"in_app",p_category:input.dataset.pref,p_enabled:input.checked});if(r.error){input.checked=!input.checked;$("preferenceMessage").textContent="Could not save this preference.";console.error(r.error)}input.disabled=false});
}
async function load(){
 const {data:s,error:sessionError}=await apnaSupabase.auth.getSession();
 if(sessionError||!s.session){$("notificationStatus").textContent="Sign in to view your notifications.";$("markAll").hidden=true;$("notificationList").innerHTML='<div class="empty-cart"><a class="primary-btn" href="auth.html">Sign in / Create account →</a></div>';return}
 const uid=s.session.user.id;
 const {data:p}=await apnaSupabase.from("profiles").select("role").eq("id",uid).maybeSingle();
 role=p?.role||"customer";$("roleBadge").textContent=role;
 const categories=roleCategories[role]||roleCategories.customer;
 $("categoryFilter").innerHTML='<option value="all">All categories</option>'+categories.map(x=>'<option value="'+esc(x[0])+'">'+esc(x[1])+"</option>").join("");
 const {data,error}=await apnaSupabase.from("notifications").select("id,type,title,body,link,category,audience_role,is_read,created_at").eq("user_id",uid).order("created_at",{ascending:false}).limit(100);
 if(error){$("notificationStatus").textContent="Could not load notifications.";$("notificationList").innerHTML='<div class="empty-cart"><p>Please refresh and try again.</p></div>';return}
 rows=data||[];renderList();await loadPreferences();$("markAll").hidden=false;
}
$("categoryFilter").onchange=renderList;$("readFilter").onchange=renderList;
$("markAll").onclick=async()=>{$("markAll").disabled=true;const r=await apnaSupabase.rpc("mark_all_notifications_read");$("markAll").disabled=false;if(r.error){alert("Could not mark notifications as read.");return}await load()};
load();