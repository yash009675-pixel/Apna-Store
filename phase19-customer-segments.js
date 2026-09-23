(function(){
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function addPanel(){
    const anchor=$("phase18Panel"); if(!anchor||$("phase19Panel"))return;
    const panel=document.createElement("section"); panel.className="admin-panel";panel.id="phase19Panel";
    panel.innerHTML='<div class="admin-panel-head"><h2>Customer Segments</h2></div><div class="section-note">Real customer segments from order history and wishlist activity. Definitions are shown below; no customer identities are exposed here.</div><div id="phase19Message" class="admin-message">Loading…</div><div id="phase19Content" hidden></div>';
    anchor.after(panel);
  }
  function render(d){
    const s=d.segments||{},defs=d.definitions||{},c=$("phase19Content");
    const cards=[
      ["New Customers",s.new_customers],
      ["Repeat Customers",s.repeat_customers],
      ["High Value Customers",s.high_value_customers],
      ["Inactive Customers",s.inactive_customers],
      ["Wishlist Users",s.wishlist_users],
      ["Frequent Buyers",s.frequent_buyers]
    ];
    c.innerHTML='<div class="analytics-grid">'+cards.map(x=>'<div class="admin-card"><span>'+x[0]+'</span><strong>'+Number(x[1]||0)+'</strong></div>').join("")+'</div>'+
      '<div class="section-note"><strong>Cart abandoners:</strong> '+esc(defs.cart_abandoners||"Not available")+'<br><br><strong>Segment definitions:</strong><br>• '+esc(defs.new_customers||"—")+'<br>• '+esc(defs.repeat_customers||"—")+'<br>• '+esc(defs.high_value_customers||"—")+'<br>• '+esc(defs.inactive_customers||"—")+'<br>• '+esc(defs.wishlist_users||"—")+'<br>• '+esc(defs.frequent_buyers||"—")+'</div>';
    c.hidden=false;
  }
  async function load(){
    const start=$("analyticsStart")?.value,end=$("analyticsEnd")?.value;if(!start||!end)return;
    const {data,error}=await apnaSupabase.rpc("admin_get_customer_segments",{p_start_at:new Date(start+"T00:00:00.000Z").toISOString(),p_end_at:new Date(end+"T23:59:59.999Z").toISOString()});
    const m=$("phase19Message");if(error){m.textContent=error.message;m.className="admin-message admin-error";return}
    m.textContent="Customer segments updated.";render(data||{});
  }
  function init(){addPanel();$("analyticsForm")?.addEventListener("submit",()=>setTimeout(load,50));load()}
  if(window.apnaSupabase)init();else window.addEventListener("load",init,{once:true});
})();