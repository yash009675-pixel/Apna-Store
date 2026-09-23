(function(){
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>Number(v||0).toLocaleString("en-IN");
const recentKey="apnaRecentlyViewed";
function remember(id){try{const a=JSON.parse(localStorage.getItem(recentKey)||"[]").filter(x=>x!==id);a.unshift(id);localStorage.setItem(recentKey,JSON.stringify(a.slice(0,12)));}catch{}}
function card(p){return '<a class="product-card" href="product.html?id='+encodeURIComponent(p.id)+'"><div class="product-image"><span>'+esc(p.name)+'</span></div><div class="product-info"><h3>'+esc(p.name)+'</h3><p class="price">₹'+money(p.price)+'</p></div></a>'}
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
 const host=document.createElement("div");host.id="recommendationEngine";host.className="recommendation-engine";
 for(const [key,title] of sections){
  const items=Array.isArray(data?.[key])?data[key]:[];
  if(!items.length)continue;
  host.insertAdjacentHTML("beforeend",'<section class="section recommendation-section"><div class="section-head"><div><p class="eyebrow">APNA STORE</p><h2>'+title+'</h2></div></div><div class="products">'+items.map(card).join("")+"</div></section>");
 }
 if(recent.length)host.insertAdjacentHTML("beforeend",'<section class="section recommendation-section"><div class="section-head"><div><p class="eyebrow">YOUR ACTIVITY</p><h2>Recently Viewed</h2></div></div><div class="products">'+recent.map(card).join("")+"</div></section>");
 const old=document.getElementById("recommendationEngine");if(old)old.replaceWith(host);else document.querySelector("main.product-page")?.appendChild(host);
};
})();