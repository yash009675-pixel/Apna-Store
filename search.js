let products=[];
const q=document.getElementById("q"),r=document.getElementById("results"),summary=document.getElementById("summary");
q.value=new URLSearchParams(location.search).get("q")||"";
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function loadProducts(){
 summary.textContent="Loading products…";
 const [{data,error},{data:categories,error:categoryError}]=await Promise.all([
  apnaSupabase.from("products").select("id,name,slug,description,price,category_id").eq("status","active").order("created_at",{ascending:true}),
  apnaSupabase.from("categories").select("id,name")
 ]);
 if(error||categoryError){
  console.error("Search product query failed:",error||categoryError);
  summary.textContent="Products could not be loaded. Please refresh and try again.";
  r.innerHTML="";
  return;
 }
 const categoryMap=new Map((categories||[]).map(c=>[c.id,c.name]));
 products=(data||[]).map(p=>({...p,category:categoryMap.get(p.category_id)||"Apna Store"}));
 render();
}
function render(){
 const term=q.value.trim().toLowerCase();
 const list=products.filter(p=>!term||[p.name,p.category,p.description,p.slug].filter(Boolean).join(" ").toLowerCase().includes(term));
 summary.textContent=term?list.length+" result(s) for “"+q.value.trim()+"”":"Browse all "+list.length+" products";
 r.innerHTML=list.length?list.map(p=>'<article class="product-card"><a href="product.html?id='+encodeURIComponent(p.id)+'" style="text-decoration:none;color:inherit"><div class="product-image"></div><div class="product-info"><h3>'+escapeHtml(p.name)+'</h3><p>'+escapeHtml(p.category)+'</p><p class="price">₹'+Number(p.price).toLocaleString("en-IN")+'</p><span class="primary-btn" style="display:inline-flex;margin-top:12px;padding:10px 13px;font-size:11px;gap:15px">View product →</span></div></a></article>').join(""):'<p>No products found. Try another search.</p>';
}
document.getElementById("form").onsubmit=e=>{e.preventDefault();history.replaceState({},'', '?q='+encodeURIComponent(q.value.trim()));render()};
loadProducts();