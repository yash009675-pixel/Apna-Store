const $=id=>document.getElementById(id);
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function bootSeller(){
 const {data,error}=await apnaSupabase.auth.getSession();
 if(error||!data.session){location.href="auth.html";return;}
 const user=data.session.user;
 const {data:profile,error:profileError}=await apnaSupabase.from("profiles").select("id,full_name,role").eq("id",user.id).single();
 if(profileError||!profile||!["seller","admin"].includes(profile.role)){location.href="account.html";return;}
 $("sellerTitle").textContent=(profile.full_name||user.email||"Seller")+" — Dashboard";
 $("sellerSubtitle").textContent=profile.role==="admin"?"Admin catalog overview":"Manage your Apna Store catalog and inventory.";if(profile.role==="admin")$("adminLink").hidden=false;
 const m=await apnaSupabase.rpc("get_seller_dashboard_metrics");
 if(m.error){$("recentProducts").innerHTML='<div class="seller-message seller-error">Could not load dashboard metrics.</div>';return;}
 const metrics=m.data||{};
 $("productCount").textContent=metrics.product_count??0;$("activeCount").textContent=metrics.active_count??0;$("variantCount").textContent=metrics.variant_count??0;$("lowStockCount").textContent=metrics.low_stock_count??0;
 $("orderCount").textContent=metrics.order_count??0;$("grossSales").textContent="₹"+Number(metrics.gross_sales||0).toLocaleString("en-IN",{maximumFractionDigits:2});
 const query=profile.role==="admin"?apnaSupabase.from("products").select("id,name,status,created_at").order("created_at",{ascending:false}):apnaSupabase.from("products").select("id,name,status,created_at").eq("seller_id",user.id).order("created_at",{ascending:false});
 const {data:products,error:productsError}=await query;
 if(productsError){$("recentProducts").innerHTML='<div class="seller-message seller-error">Could not load products.</div>';return;}
 const list=products||[];const ids=list.map(p=>p.id);let variants=[];
 if(ids.length){const {data:v}=await apnaSupabase.from("product_variants").select("id,product_id,stock").in("product_id",ids);variants=v||[];}
 if(!list.length){$("recentProducts").innerHTML='<div class="seller-message">No products yet. Start by adding your first product.</div>';return;}
 const lowStock=variants.filter(v=>Number(v.stock||0)<=5).length;
 const inactive=list.filter(p=>String(p.status||"").toLowerCase()!=="active").length;
 const attention=$("sellerAttention");if(attention&&(lowStock||inactive)){attention.hidden=false;$("attentionStock").textContent=lowStock+" low-stock variant"+(lowStock===1?"":"s")+" need attention";$("attentionProducts").textContent=inactive+" product"+(inactive===1?"":"s")+" need status review";}
 const render=()=>{const q=String($("sellerProductSearch")?.value||"").trim().toLowerCase(),f=String($("sellerStatusFilter")?.value||"").toLowerCase();const filtered=list.filter(p=>(!q||String(p.name||"").toLowerCase().includes(q))&&(!f||String(p.status||"").toLowerCase()===f));$("recentProducts").innerHTML=filtered.length?'<table class="seller-table"><thead><tr><th>Product</th><th>Status</th><th>Variants</th><th>Created</th></tr></thead><tbody>'+filtered.slice(0,12).map(p=>'<tr><td><strong>'+esc(p.name)+'</strong></td><td><span class="seller-status">'+esc(p.status)+'</span></td><td>'+variants.filter(v=>v.product_id===p.id).length+'</td><td>'+new Date(p.created_at).toLocaleDateString("en-IN")+'</td></tr>').join("")+'</tbody></table>':'<div class="seller-message">No products match this filter.</div>';};
 $("sellerProductSearch")?.addEventListener("input",render);$("sellerStatusFilter")?.addEventListener("change",render);render();
}
$("signOut").onclick=async()=>{await apnaSupabase.auth.signOut();location.href="index.html";};
bootSeller();