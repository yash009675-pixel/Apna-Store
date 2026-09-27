(function(){
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>Number(v||0).toLocaleString("en-IN");
const recentKey="apnaRecentlyViewed";
function remember(id){try{const a=JSON.parse(localStorage.getItem(recentKey)||"[]").filter(x=>x!==id);a.unshift(id);localStorage.setItem(recentKey,JSON.stringify(a.slice(0,12)));}catch{}}
function card(p,img){return '<a class="product-card" href="product.html?id='+encodeURIComponent(p.id)+'"><div class="product-image">'+(img?'<img src="'+esc(img)+'" alt="'+esc(p.name)+'" loading="lazy">':'<span>'+esc(p.name)+'</span>')+'</div><div class="product-info"><h3>'+esc(p.name)+'</h3><p class="price">₹'+money(p.price)+'</p>'+(Number(p.compare_at_price)>Number(p.price)?'<p class="recommendation-save">₹'+money(p.compare_at_price)+' MRP</p>':'')+'</div></a>'}
async function recentCards(current){
 let ids=[];try{ids=JSON.parse(localStorage.getItem(recentKey)||"[]").filter(x=>x!==current).slice(0,8)}catch{}
 if(!ids.length)return [];
 const {data}=await apnaSupabase.from("products").select("id,name,slug,price,compare_at_price").eq("status","active").in("id",ids);
 const map=new Map((data||[]).map(p=>[p.id,p]));return ids.map(id=>map.get(id)).filter(Boolean);
}
window.apnaRecommendationFeed=async function(productId){
 remember(productId);
 const {data,error}=await apnaSupabase.rpc("get_recommendation_feed",{p_product_id:productId});
 if(error){console.error("Recommendation feed failed",error);return}
 const sections=[
  ["similar_products","Similar Products"],
  ["recommended_for_you","Recommended For You"],
  ["frequently_bought_together","Frequently Bought Together"],
  ["trending","Trending"],
  ["same_seller","Products From Same Seller"]
 ];
 const recent=await recentCards(productId);
 const allItems=[...sections.flatMap(([k])=>Array.isArray(data?.[k])?data[k]:[]),...recent];const unique=[...new Map(allItems.map(p=>[String(p.id),p])).values()];let imageMap=new Map();if(unique.length){const {data:imgs}=await apnaSupabase.from("product_images").select("product_id,storage_path,is_primary,sort_order").in("product_id",unique.map(p=>p.id)).order("is_primary",{ascending:false}).order("sort_order");(imgs||[]).forEach(x=>{if(!imageMap.has(x.product_id))imageMap.set(x.product_id,apnaSupabase.storage.from("product-images").getPublicUrl(x.storage_path).data.publicUrl)});}
 const host=document.createElement("div");host.id="recommendationEngine";host.className="recommendation-engine";
 for(const [key,title] of sections){
  const items=Array.isArray(data?.[key])?data[key]:[];
  if(!items.length)continue;
  host.insertAdjacentHTML("beforeend",'<section class="section recommendation-section"><div class="section-head"><div><p class="eyebrow">APNA STORE</p><h2>'+title+'</h2></div></div><div class="products">'+items.map(p=>card(p,imageMap.get(p.id))).join("")+"</div></section>");
 }
 if(recent.length)host.insertAdjacentHTML("beforeend",'<section class="section recommendation-section"><div class="section-head"><div><p class="eyebrow">YOUR ACTIVITY</p><h2>Recently Viewed</h2></div></div><div class="products">'+recent.map(p=>card(p,imageMap.get(p.id))).join("")+"</div></section>");
 const old=document.getElementById("recommendationEngine");if(old)old.replaceWith(host);else document.querySelector("main.product-page")?.appendChild(host);
};
})();