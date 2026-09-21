function safeCampaignUrl(url){const v=String(url||"").trim();if(/^https:\/\//i.test(v)||/^[a-zA-Z0-9_./?&=#%-]+$/.test(v))return v;return "shop.html"}
async function loadMarketing(){const {data,error}=await apnaSupabase.from("marketing_campaigns").select("name,badge,headline,description,cta_label,cta_url,placement,sort_order").eq("is_active",true).order("sort_order").order("created_at",{ascending:false});if(error){console.warn("Marketing campaign query failed:",error);return}const rows=data||[];const hero=rows.find(x=>x.placement==="homepage_hero");const deal=rows.find(x=>x.placement==="homepage_deal");const dealEl=document.querySelector(".deal");if(dealEl&&!deal){dealEl.hidden=true}if(hero){const el=document.querySelector(".hero-copy");if(el)el.innerHTML='<p class="eyebrow">'+escapeHtml(hero.badge||"APNA EDIT")+'</p><h1>'+escapeHtml(hero.headline).replace(/\\n/g,"<br>")+'</h1><p class="hero-text">'+escapeHtml(hero.description||"")+'</p><a class="primary-btn" href="'+escapeHtml(safeCampaignUrl(hero.cta_url))+'">'+escapeHtml(hero.cta_label||"Shop now")+' <span>→</span></a>'}if(deal){const el=document.querySelector(".deal");if(el)el.hidden=false;if(el)el.querySelector("div").innerHTML='<p class="eyebrow">'+escapeHtml(deal.badge||"APNA DEALS")+'</p><h2>'+escapeHtml(deal.headline).replace(/\\n/g,"<br>")+'</h2><p>'+escapeHtml(deal.description||"")+'</p><a class="light-btn" href="'+escapeHtml(safeCampaignUrl(deal.cta_url))+'">'+escapeHtml(deal.cta_label||"Shop now")+' →</a>'}}
let products=[];const root=document.getElementById("products");const newArrivalsRoot=document.getElementById("newArrivals");const categoriesRoot=document.getElementById("homepageCategories");const navCategoriesRoot=document.getElementById("homepageNavCategories");
function getCart(){try{const c=JSON.parse(localStorage.getItem("apnaCart")||"[]");return Array.isArray(c)?c:[]}catch{return[]}}
function updateHeader(){const c=getCart();const n=c.reduce((s,x)=>s+(Number(x.qty)||0),0);const el=document.getElementById("cartCount");if(el)el.textContent=n}
function getWishlist(){try{const w=JSON.parse(localStorage.getItem("apnaWishlist")||"[]");return Array.isArray(w)?w:[]}catch{return[]}}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function loadCategories(){
 const {data,error}=await apnaSupabase.from("categories").select("id,name,slug").eq("is_active",true).order("sort_order",{ascending:true}).order("name",{ascending:true});
 if(error){console.error("Homepage category query failed:",error);if(categoriesRoot)categoriesRoot.innerHTML='<p class="checkout-note">Categories could not be loaded right now. Please refresh and try again.</p>';return}
 const rows=data||[];
 const toneClasses=["cat-women","cat-men","cat-kids","cat-foot"];
 const subtitles=["New looks →","Daily essentials →","Little styles →","Step out →"];
 if(categoriesRoot)categoriesRoot.innerHTML=rows.map((c,i)=>'<a href="shop.html?category='+encodeURIComponent(c.name)+'" class="category '+toneClasses[i%toneClasses.length]+'"><span>'+String(i+1).padStart(2,"0")+'</span><h3>'+escapeHtml(c.name)+'</h3><p>'+subtitles[i%subtitles.length]+'</p></a>').join("")||'<p>No categories available yet.</p>';
 if(navCategoriesRoot){navCategoriesRoot.innerHTML='<a href="#shop">Shop</a>'+rows.map(c=>'<a href="shop.html?category='+encodeURIComponent(c.name)+'">'+escapeHtml(c.name)+'</a>').join("")+'<a href="#deals">Deals</a>';}
}
async function loadProducts(){
 if(root)root.innerHTML='<p class="checkout-note">Loading products…</p>';
 if(newArrivalsRoot)newArrivalsRoot.innerHTML='<p class="checkout-note">Loading products…</p>';
 const [featuredResult,newResult,categoryResult]=await Promise.all([
  apnaSupabase.from("products").select("id,name,price,category_id,created_at").eq("status","active").order("updated_at",{ascending:false}).limit(4),
  apnaSupabase.from("products").select("id,name,price,category_id,created_at").eq("status","active").order("created_at",{ascending:false}).limit(4),
  apnaSupabase.from("categories").select("id,name")
 ]);
 if(featuredResult.error||newResult.error){console.error("Homepage product query failed:",featuredResult.error||newResult.error);if(root)root.innerHTML='<p class="checkout-note">Products could not be loaded right now. Please refresh and try again.</p>';if(newArrivalsRoot)newArrivalsRoot.innerHTML='<p class="checkout-note">Products could not be loaded right now. Please refresh and try again.</p>';return}
 if(categoryResult.error)console.warn("Homepage category query failed:",categoryResult.error);
 const categories=new Map((categoryResult.data||[]).map(c=>[c.id,c.name]));
 products=(featuredResult.data||[]).map(p=>({...p,type:categories.get(p.category_id)||"Apna Store"}));
 const arrivals=(newResult.data||[]).map(p=>({...p,type:categories.get(p.category_id)||"Apna Store"}));
 render();
 if(newArrivalsRoot)renderProductList(newArrivalsRoot,arrivals);
}function productCardMarkup(p,i,listName){
 const w=getWishlist();const saved=w.some(x=>x.productId===p.id||x.name===p.name);
 return '<article class="product-card"><a href="product.html?id='+encodeURIComponent(p.id)+'" style="text-decoration:none;color:inherit"><div class="product-image"><button aria-label="'+(saved?"Remove from wishlist":"Add to wishlist")+'" onclick="event.preventDefault();event.stopPropagation();toggleWish(products['+i+'])">'+(saved?"♥":"♡")+'</button></div><div class="product-info"><h3>'+escapeHtml(p.name)+'</h3><p>'+escapeHtml(p.type)+'</p><p class="price">₹'+Number(p.price).toLocaleString("en-IN")+'</p></div></a><button class="primary-btn add" data-i="'+i+'" data-list="'+listName+'" style="margin-top:12px;padding:10px 13px;font-size:11px;gap:15px">View options →</button></article>';
}
function renderProductList(target,list){
 target.innerHTML=list.length?list.map((p,i)=>productCardMarkup(p,i,"new")).join(""):'<p>No products available yet.</p>';
 target.querySelectorAll(".add").forEach(b=>b.onclick=()=>{const idx=Number(b.dataset.i);const p=list[idx];location.href="product.html?id="+encodeURIComponent(p.id)});
}
function render(){if(!root)return;const w=getWishlist();root.innerHTML=products.length?products.map((p,i)=>productCardMarkup(p,i,"featured")).join(""):'<p>No products available yet.</p>';root.querySelectorAll(".add").forEach(b=>b.onclick=()=>location.href="product.html?id="+encodeURIComponent(products[Number(b.dataset.i)].id))}
function toggleWish(p){let w=getWishlist();const i=w.findIndex(x=>x.productId===p.id||x.name===p.name);if(i>=0)w.splice(i,1);else w.push({productId:p.id,name:p.name,category:p.type,price:Number(p.price)});localStorage.setItem("apnaWishlist",JSON.stringify(w));render()}
loadCategories();loadProducts();loadMarketing();updateHeader();const search=document.getElementById("searchBtn");if(search)search.onclick=()=>location.href="search.html";const cartBtn=document.getElementById("cartBtn");if(cartBtn)cartBtn.onclick=()=>location.href="cart.html";