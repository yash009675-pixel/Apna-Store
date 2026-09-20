const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function time(v){const d=new Date(v);return Number.isNaN(d.getTime())?"":d.toLocaleString("en-IN",{day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"})}
function safeLink(value){
  if(!value)return "";
  try{
    const u=new URL(value,location.href);
    if(u.origin!==location.origin || u.protocol!=="https:"&&u.protocol!=="http:")return "";
    return u.href;
  }catch{return ""}
}
function notificationLink(n){
  const href=safeLink(n.link);
  return href?'<a href="'+esc(href)+'" data-open="'+esc(n.id)+'">View →</a>':"";
}
async function load(){
  const {data:s,error:sessionError}=await apnaSupabase.auth.getSession();
  if(sessionError){$("notificationStatus").textContent="Could not check your account.";return}
  if(!s.session){
    $("notificationStatus").textContent="Sign in to view your notifications.";
    $("markAll").hidden=true;
    $("notificationList").innerHTML='<div class="empty-cart"><a class="primary-btn" href="auth.html">Sign in / Create account →</a></div>';
    return;
  }
  $("markAll").hidden=false;
  const {data,error}=await apnaSupabase.from("notifications").select("id,type,title,body,link,is_read,created_at").eq("user_id",s.session.user.id).order("created_at",{ascending:false}).limit(100);
  if(error){$("notificationStatus").textContent="Could not load notifications.";$("notificationList").innerHTML='<div class="empty-cart"><p>Please refresh and try again.</p></div>';console.error(error);return}
  const rows=data||[],unread=rows.filter(x=>!x.is_read).length;
  $("notificationStatus").textContent=rows.length?unread+" unread · "+rows.length+" total":"You're all caught up.";
  $("notificationList").innerHTML=rows.length?rows.map(n=>'<article class="notification-card '+(n.is_read?"":"unread")+'"><div><strong>'+esc(n.title)+'</strong><p>'+esc(n.body||"")+'</p><small>'+esc(time(n.created_at))+'</small></div><div class="notification-actions">'+notificationLink(n)+(n.is_read?"":'<button type="button" data-read="'+esc(n.id)+'">Mark read</button>')+'</div></article>').join(""):'<div class="empty-cart"><h2>No notifications yet.</h2><p>Order, delivery and seller updates will appear here.</p></div>';
  $("notificationList").querySelectorAll("[data-read]").forEach(b=>b.onclick=async()=>{
    b.disabled=true;
    const r=await apnaSupabase.rpc("mark_notification_read",{p_notification_id:b.dataset.read});
    if(r.error){b.disabled=false;alert("Could not mark notification as read.");console.error(r.error);return}
    await load();
  });
  $("notificationList").querySelectorAll("[data-open]").forEach(a=>a.onclick=async()=>{
    const row=rows.find(n=>n.id===a.dataset.open);
    if(row&&!row.is_read)await apnaSupabase.rpc("mark_notification_read",{p_notification_id:row.id});
  });
}
$("markAll").onclick=async()=>{
  $("markAll").disabled=true;
  const r=await apnaSupabase.rpc("mark_all_notifications_read");
  $("markAll").disabled=false;
  if(r.error){alert("Could not mark notifications as read.");console.error(r.error);return}
  await load();
};
load();