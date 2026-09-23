(function(){
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money=v=>"₹"+Number(v||0).toLocaleString("en-IN",{maximumFractionDigits:2});
  function pct(v){return Number(v||0).toLocaleString("en-IN",{maximumFractionDigits:2})+"%"}
  function addPanel(){
    const analytics=$("analyticsContent")?.parentElement;
    if(!analytics||$("phase18Panel"))return;
    const panel=document.createElement("section");
    panel.className="admin-panel";panel.id="phase18Panel";
    panel.innerHTML='<div class="admin-panel-head"><h2>Category / Market Insights</h2></div>'+
      '<div class="section-note">Real category metrics from orders, product views, active catalog and inventory. No synthetic data.</div>'+
      '<div id="phase18Message" class="admin-message">Loading…</div><div id="phase18Content" hidden></div>';
    analytics.after(panel);
  }
  function render(data){
    const rows=data.categories||[], defs=data.definitions||{};
    const content=$("phase18Content");
    if(!rows.length){content.innerHTML='<div class="section-note">No active categories found.</div>';content.hidden=false;return}
    content.innerHTML='<div class="analytics-columns"><div><h3>Category performance</h3><div class="seller-table-wrap"><table class="analytics-table"><thead><tr><th>Category</th><th>Sales</th><th>ASP</th><th>Demand</th><th>Views</th><th>Conversion</th></tr></thead><tbody>'+
      rows.map(r=>'<tr><td><strong>'+esc(r.category_name)+'</strong></td><td>'+money(r.sales)+'</td><td>'+money(r.average_selling_price)+'</td><td>'+Number(r.demand||0)+'</td><td>'+Number(r.product_views||0)+'</td><td>'+pct(r.conversion_rate)+'</td></tr>').join("")+
      '</tbody></table></div></div><div><h3>Market / inventory</h3><div class="seller-table-wrap"><table class="analytics-table"><thead><tr><th>Category</th><th>Competition</th><th>Inventory</th><th>Sell-through</th><th>Growth</th><th>Seller participation</th></tr></thead><tbody>'+
      rows.map(r=>'<tr><td><strong>'+esc(r.category_name)+'</strong></td><td>'+Number(r.active_products||0)+' products · '+Number(r.active_sellers||0)+' sellers</td><td>'+Number(r.inventory_units||0)+'</td><td>'+pct(r.sell_through_rate)+'</td><td>'+((r.growth_rate===null||r.growth_rate===undefined)?"—":pct(r.growth_rate))+'</td><td>'+Number(r.active_sellers||0)+'</td></tr>').join("")+
      '</tbody></table></div></div></div><div class="section-note">Definitions: '+esc(defs.demand||"—")+' · '+esc(defs.conversion||"—")+' · '+esc(defs.category_growth||"—")+'.</div>';
    content.hidden=false;
  }
  async function load(){
    const start=$("analyticsStart")?.value,end=$("analyticsEnd")?.value;
    if(!start||!end)return;
    const {data,error}=await apnaSupabase.rpc("admin_get_category_market_insights",{
      p_start_at:new Date(start+"T00:00:00.000Z").toISOString(),
      p_end_at:new Date(end+"T23:59:59.999Z").toISOString()
    });
    const msg=$("phase18Message");
    if(error){msg.textContent=error.message;msg.className="admin-message admin-error";$("phase18Content").hidden=true;return}
    msg.textContent="Category insights updated.";
    msg.className="admin-message";
    render(data||{});
  }
  function init(){
    addPanel();
    $("analyticsForm")?.addEventListener("submit",()=>setTimeout(load,50));
    load();
  }
  if(window.apnaSupabase)init();else window.addEventListener("load",init,{once:true});
})();