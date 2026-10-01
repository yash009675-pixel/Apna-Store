function safeCampaignUrl(url){const v=String(url||"").trim();if(/^https:\/\//i.test(v)||/^[a-zA-Z0-9_./?&=#%-]+$/.test(v))return v;return "shop.html"}
async function loadMarketing(){const now=new Date().toISOString();const {data,error}=await apnaSupabase.from("marketing_campaigns").select("name,badge,headline,description,cta_label,cta_url,placement,sort_order,starts_at,ends_at").eq("is_active",true).or("starts_at.is.null,starts_at.lte."+now).or("ends_at.is.null,ends_at.gt."+now).order("sort_order").order("created_at",{ascending:false});if(error){console.warn("Marketing campaign query failed:",error);return}const rows=data||[];const hero=rows.find(x=>x.placement==="homepage_hero");const deal=rows.find(x=>x.placement==="homepage_deal");const dealEl=document.querySelector(".deal");if(dealEl&&!deal){dealEl.hidden=true}if(hero){const el=document.querySelector(".hero-copy");if(el)el.innerHTML='<p class="eyebrow">'+escapeHtml(hero.badge||"APNA EDIT")+'</p><h1>'+escapeHtml(hero.headline).replace(/\\n/g,"<br>")+'</h1><p class="hero-text">'+escapeHtml(hero.description||"")+'</p><a class="primary-btn" href="'+escapeHtml(safeCampaignUrl(hero.cta_url))+'">'+escapeHtml(hero.cta_label||"Shop now")+' <span>→</span></a>'}if(deal){const el=document.querySelector(".deal");if(el)el.hidden=false;if(el)el.querySelector("div").innerHTML='<p class="eyebrow">'+escapeHtml(deal.badge||"APNA DEALS")+'</p><h2>'+escapeHtml(deal.headline).replace(/\\n/g,"<br>")+'</h2><p>'+escapeHtml(deal.description||"")+'</p><a class="light-btn" href="'+escapeHtml(safeCampaignUrl(deal.cta_url))+'">'+escapeHtml(deal.cta_label||"Shop now")+' →</a>'}}
let products=[];const root=document.getElementById("products");const newArrivalsRoot=document.getElementById("newArrivals");const categoriesRoot=document.getElementById("homepageCategories");const navCategoriesRoot=document.getElementById("homepageNavCategories");
function getCart(){try{const c=JSON.parse(localStorage.getItem("apnaCart")||"[]");return Array.isArray(c)?c:[]}catch{return[]}}
function updateHeader(){const c=getCart();const n=c.reduce((s,x)=>s+(Number(x.qty)||0),0);const el=document.getElementById("cartCount");if(el)el.textContent=n}
function getWishlist(){try{const w=JSON.parse(localStorage.getItem("apnaWishlist")||"[]");return Array.isArray(w)?w:[]}catch{return[]}}
function getRecentlyViewed(){try{const v=JSON.parse(localStorage.getItem("apnaRecentlyViewed")||"[]");return Array.isArray(v)?v:[]}catch{return[]}}
async function loadRecentlyViewed(){
 const box=document.getElementById("recentlyViewed"),section=document.getElementById("recently-viewed");if(!box||!section)return;
 const ids=getRecentlyViewed().slice(0,4);if(!ids.length)return;
 const {data,error}=await apnaSupabase.from("products").select("id,name,price,category_id").eq("status","active").in("id",ids);
 if(error||!data?.length)return;
 const byId=new Map(data.map(p=>[p.id,p]));const rows=ids.map(id=>byId.get(id)).filter(Boolean);
 if(!rows.length)return;
 box.innerHTML=rows.map(p=>'<a class="product-card" href="product.html?id='+encodeURIComponent(p.id)+'"><div class="product-image"><span class="product-placeholder">APNA</span></div><div class="product-info"><h3>'+escapeHtml(p.name)+'</h3><p class="price">₹'+Number(p.price).toLocaleString("en-IN")+'</p></div></a>').join("");
 section.hidden=false;
 const clear=document.getElementById("clearRecentlyViewed");if(clear)clear.onclick=()=>{localStorage.removeItem("apnaRecentlyViewed");section.hidden=true;box.innerHTML=""};
}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function loadCategories(){
 const wanted=["Men","Women","Kids","Ladies Saree","Footwear","Accessories","Ethnic Wear","Western Wear"];
 const toneClasses=["cat-men","cat-women","cat-kids","cat-saree","cat-footwear","cat-accessories","cat-ethnic","cat-western"];
 const subtitles=["Shop Now →","Shop Now →","Shop Now →","Shop Now →","Shop Now →","Shop Now →","Shop Now →","Shop Now →"];
 const displayNames={"Ladies Saree":"Saree"};
 const categoryImages={
   "Men":"assets/IMG_2487.jpeg",
   "Women":"assets/IMG_2502.jpeg",
   "Kids":"assets/IMG_2503.jpeg",
   "Ladies Saree":"assets/IMG_2497.jpeg",
   "Footwear":"assets/IMG_2498.jpeg",
   "Accessories":"assets/IMG_2500.jpeg",
   "Ethnic Wear":"assets/IMG_2501.jpeg",
   "Western Wear":"assets/IMG_2499.jpeg",
   "New Arrivals":"assets/IMG_2488.jpeg"
 };
 const renderCategoryCards=rows=>{
   if(!categoriesRoot)return;
   categoriesRoot.innerHTML=rows.map((c,i)=>{
     const url=categoryImages[c.name]||"";
     const media=url?'<span class="category-media"><img src="'+escapeHtml(url)+'" alt="'+escapeHtml(c.name)+' clothing" loading="eager" decoding="async"></span>':"";
     const label=displayNames[c.name]||c.name;
     return '<a href="shop.html?category='+encodeURIComponent(c.name)+'" class="category '+toneClasses[i%toneClasses.length]+'">'+media+'<div class="category-copy"><h3>'+escapeHtml(label)+'</h3><p>'+subtitles[i%subtitles.length]+'</p></div></a>';
   }).join("");
 };
 const fallbackRows=wanted.map(name=>({id:"ref-"+name.toLowerCase().replace(/\s+/g,"-"),name,slug:name.toLowerCase().replace(/\s+/g,"-")}));
 renderCategoryCards(fallbackRows);
 try{
   const {data,error}=await apnaSupabase.from("categories").select("id,name,slug").eq("is_active",true).order("sort_order",{ascending:true}).order("name",{ascending:true});
   if(error){console.warn("Homepage category query failed:",error);return}
   const dbRows=data||[];
   const rows=wanted.map(name=>dbRows.find(c=>c.name.toLowerCase()===name.toLowerCase())||{id:"ref-"+name.toLowerCase().replace(/\s+/g,"-"),name,slug:name.toLowerCase().replace(/\s+/g,"-")});
   renderCategoryCards(rows);
   if(navCategoriesRoot){navCategoriesRoot.innerHTML='<a href="#shop">Shop</a>'+rows.map(c=>'<a href="shop.html?category='+encodeURIComponent(c.name)+'">'+escapeHtml(c.name)+'</a>').join("")+'<a href="#deals">Deals</a>';}
 }catch(err){console.warn("Homepage category load failed:",err)}
}
async function loadProducts(){
  if(root)root.innerHTML='<p class="checkout-note">Loading products…</p>';
  if(newArrivalsRoot)newArrivalsRoot.innerHTML='<p class="checkout-note">Loading products…</p>';

  // Load products first. Image/category lookups must never block the homepage.
  try{
    let featuredResult,newResult;
    [featuredResult,newResult]=await Promise.all([
      apnaSupabase.from("products").select("id,name,slug,description,price,category_id").eq("status","active").order("created_at",{ascending:true}).order("id",{ascending:true}).limit(5),
      apnaSupabase.from("products").select("id,name,slug,description,price,category_id").eq("status","active").order("created_at",{ascending:true}).order("id",{ascending:true}).limit(4)
    ]);

    // Fallback query keeps the homepage usable if a schema/order field is unavailable.
    if(featuredResult.error||newResult.error){
      console.warn("Homepage primary product query failed; retrying simple query:",featuredResult.error||newResult.error);
      [featuredResult,newResult]=await Promise.all([
        apnaSupabase.from("products").select("id,name,price,category_id").eq("status","active").limit(5),
        apnaSupabase.from("products").select("id,name,price,category_id").eq("status","active").limit(4)
      ]);
    }

    if(featuredResult.error||newResult.error){
      console.error("Homepage product query failed after fallback:",featuredResult.error||newResult.error);
      if(root)root.innerHTML='<p class="checkout-note">Products could not be loaded right now. Please refresh and try again.</p>';
      if(newArrivalsRoot)newArrivalsRoot.innerHTML='<p class="checkout-note">Products could not be loaded right now. Please refresh and try again.</p>';
      return;
    }

    const rawFeatured=featuredResult.data||[];
    const rawArrivals=newResult.data||[];

    // Render immediately with safe reference data. Nothing else can block this.
    const refOrder=["Oversized Graphic T-Shirt","Basic Hoodie","Wide Leg Jeans","Polo T-Shirt","Casual Sneakers"];
    const catalog=rawFeatured.map(p=>({...p,type:"Apna Store",image:null}));
    const refMatches=refOrder.map(name=>catalog.find(p=>p.name===name)).filter(Boolean);
    products=refMatches.length===5?refMatches:catalog;

    const arrivals=rawArrivals.map(p=>({...p,type:"Apna Store",image:null}));
    render();
    if(newArrivalsRoot)renderProductList(newArrivalsRoot,arrivals);

    // Enrich cards with real categories/images without blocking the initial render.
    try{
      const [categoryResult,imagesResult]=await Promise.all([
        apnaSupabase.from("categories").select("id,name"),
        apnaSupabase.from("product_images").select("product_id,storage_path,alt_text,is_primary,sort_order").order("is_primary",{ascending:false}).order("sort_order",{ascending:true})
      ]);

      if(categoryResult.error)console.warn("Homepage category query failed:",categoryResult.error);
      if(imagesResult.error)console.warn("Homepage product image query failed:",imagesResult.error);

      const categories=new Map((categoryResult.data||[]).map(c=>[c.id,c.name]));
      const imageMap=new Map();
      (imagesResult.data||[]).forEach(img=>{if(!imageMap.has(img.product_id))imageMap.set(img.product_id,img)});

      const enrich=p=>({...p,type:categories.get(p.category_id)||"Apna Store",image:imageMap.get(p.id)||null});
      products=products.map(enrich);
      render();

      if(newArrivalsRoot)renderProductList(newArrivalsRoot,arrivals.map(enrich));
    }catch(enrichError){
      console.warn("Homepage product enrichment skipped:",enrichError);
    }
  }catch(err){
    console.error("Homepage loadProducts failed:",err);
    if(root)root.innerHTML='<p class="checkout-note">Products could not be loaded right now. Please refresh and try again.</p>';
    if(newArrivalsRoot)newArrivalsRoot.innerHTML='<p class="checkout-note">Products could not be loaded right now. Please refresh and try again.</p>';
  }
}
const REFERENCE_PRODUCT_IMAGES={
 "Oversized Graphic T-Shirt":"https://images.unsplash.com/photo-1636047250452-6772f6144b3d?auto=format&fit=crop&fm=jpg&q=80&w=900",
 "Basic Hoodie":"https://images.unsplash.com/photo-1768696082603-5b7a9f0a10ab?auto=format&fit=crop&fm=jpg&q=80&w=900",
 "Wide Leg Jeans":"https://images.unsplash.com/photo-1778118273275-ac9959d61a7f?auto=format&fit=crop&fm=jpg&q=80&w=900",
 "Polo T-Shirt":"https://images.unsplash.com/photo-1766149756155-4a8122ad0732?auto=format&fit=crop&fm=jpg&q=80&w=900",
 "Casual Sneakers":"https://images.unsplash.com/photo-1753707407133-5af2cc35fd21?auto=format&fit=crop&fm=jpg&q=80&w=900"
};
const REFERENCE_PRODUCT_IMAGE_LIST=Object.values(REFERENCE_PRODUCT_IMAGES);
async function addReferenceProduct(product){
 try{
   const {data:variants,error}=await apnaSupabase.from("product_variants").select("id,size,color,stock").eq("product_id",product.id).gt("stock",0).limit(1);
   if(error||!variants?.length){location.href="product.html?id="+encodeURIComponent(product.id);return}
   const v=variants[0];
   const cart=(()=>{try{const x=JSON.parse(localStorage.getItem("apnaCart")||"[]");return Array.isArray(x)?x:[]}catch{return[]}})();
   const key=[product.id,v.id,v.size||"",v.color||""].join("|");
   const existing=cart.find(x=>(x.key||[x.productId,x.variantId,x.size||"",x.color||""].join("|"))===key);
   if(existing)existing.qty=Number(existing.qty||0)+1;
   else cart.push({key,productId:product.id,variantId:v.id,name:product.name,category:product.type||"Apna Store",price:Number(product.price),size:v.size||"",color:v.color||"",qty:1});
   localStorage.setItem("apnaCart",JSON.stringify(cart));
   updateHeader();
 }catch(err){console.error("Reference add-to-cart failed:",err);location.href="product.html?id="+encodeURIComponent(product.id)}
}
function productCardMarkup(p,i,listName){
 const w=getWishlist();const saved=w.some(x=>x.productId===p.id||x.name===p.name);
 const rawImage=String(p.image?.storage_path||"");
 const fallbackImage=REFERENCE_PRODUCT_IMAGES[p.name]||REFERENCE_PRODUCT_IMAGE_LIST[i%REFERENCE_PRODUCT_IMAGE_LIST.length]||"";
 const imageUrl=listName==="featured"
   ? (REFERENCE_PRODUCT_IMAGES[p.name]||fallbackImage)
   : (rawImage?( /^https?:\/\//i.test(rawImage)?rawImage:window.APNA_SUPABASE_CONFIG.url+"/storage/v1/object/public/product-images/"+rawImage ):"");
 const imageMarkup=imageUrl
   ? '<img src="'+imageUrl+'" alt="'+escapeHtml(p.image?.alt_text||p.name)+'" loading="lazy" decoding="async"'+(fallbackImage?' onerror="this.onerror=null;this.src=\''+fallbackImage+'\';"':"")+'>' 
   : (fallbackImage?'<img src="'+fallbackImage+'" alt="'+escapeHtml(p.name)+'" loading="lazy" decoding="async">':'<span class="product-placeholder">APNA</span>');
 const wishButton=listName==="featured" ? '<button aria-label="'+(saved?"Remove from wishlist":"Add to wishlist")+'" onclick="event.preventDefault();event.stopPropagation();toggleWish(products['+i+'])">'+(saved?"♥":"♡")+'</button>' : "";
 return '<article class="product-card"><a href="product.html?id='+encodeURIComponent(p.id)+'" style="text-decoration:none;color:inherit"><div class="product-image">'+imageMarkup+wishButton+'</div><div class="product-info"><h3>'+escapeHtml(p.name)+'</h3><p>'+escapeHtml(p.type)+'</p><p class="price">₹'+Number(p.price).toLocaleString("en-IN")+'</p></div></a><button class="primary-btn add" data-i="'+i+'" data-list="'+listName+'" style="margin-top:12px;padding:10px 13px;font-size:11px;gap:15px">Add to Cart</button></article>';
}
function renderProductList(target,list){
 target.innerHTML=list.length?list.map((p,i)=>productCardMarkup(p,i,"new")).join(""):'<div class="apna-empty-products"><span class="apna-empty-kicker">FRESH SOON</span><strong>New pieces are on the way.</strong><p>Fresh Apna arrivals will appear here after approval.</p><a href="shop.html">Explore all products →</a></div>';
 target.querySelectorAll(".add").forEach(b=>b.onclick=()=>{const idx=Number(b.dataset.i);const p=list[idx];location.href="product.html?id="+encodeURIComponent(p.id)});
}
function render(){if(!root)return;const w=getWishlist();root.innerHTML=products.length?products.map((p,i)=>productCardMarkup(p,i,"featured")).join(""):'<div class="apna-empty-products"><span class="apna-empty-kicker">COMING SOON</span><strong>Curated everyday pieces.</strong><p>Apna Store products will appear here as they are approved.</p><a href="shop.html">Browse the store →</a></div>';root.querySelectorAll(".add").forEach(b=>b.onclick=()=>addReferenceProduct(products[Number(b.dataset.i)]))}
function toggleWish(p){let w=getWishlist();const i=w.findIndex(x=>x.productId===p.id||x.name===p.name);if(i>=0)w.splice(i,1);else w.push({productId:p.id,name:p.name,category:p.type,price:Number(p.price)});localStorage.setItem("apnaWishlist",JSON.stringify(w));render()}
/* Stay Connected — homepage newsletter subscription */
(function(){
  const form=document.getElementById("newsletterForm");
  const email=document.getElementById("newsletterEmail");
  const msg=document.getElementById("newsletterMessage");
  if(!form||!email)return;
  form.addEventListener("submit",async function(e){
    e.preventDefault();
    const value=email.value.trim().toLowerCase();
    if(!value)return;
    const button=form.querySelector("button");
    if(button)button.disabled=true;
    if(msg)msg.textContent="Saving…";
    try{
      const{error}=await apnaSupabase.from("newsletter_subscriptions").insert({email:value,source:"homepage"});
      if(error&&error.code!=="23505")throw error;
      if(msg)msg.textContent=error?.code==="23505"?"You're already connected.":"You're connected — thank you!";
      if(!error)email.value="";
    }catch(err){
      console.error("Newsletter subscription failed:",err);
      if(msg)msg.textContent="Something went wrong. Please try again.";
    }finally{if(button)button.disabled=false;}
  });
})();

loadCategories();loadProducts();loadMarketing();updateHeader();const search=document.getElementById("searchBtn");if(search)search.onclick=()=>location.href="search.html";const cartBtn=document.getElementById("cartBtn");if(cartBtn)cartBtn.onclick=()=>location.href="cart.html";

/* UI-03 — mobile navigation injection */
(function(){
  if(document.querySelector('.apna-mobile-nav')) return;
  const path=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const items=[
    ['index.html','Home','⌂'],
    ['shop.html','Shop','⌕'],
    ['wishlist.html','Wishlist','♡'],
    ['cart.html','Bag','▢'],
    ['account.html','Account','◎']
  ];
  const nav=document.createElement('nav');
  nav.className='apna-mobile-nav';
  nav.setAttribute('aria-label','Mobile navigation');
  nav.innerHTML=items.map(([href,label,icon])=>{
    const active=path===href?' active':'';
    const count=href==='cart.html'?'<b class="nav-count" id="mobileCartCount">0</b>':'';
    return '<a class="'+active.trim()+'" href="'+href+'"><span aria-hidden="true">'+icon+'</span><small>'+label+'</small>'+count+'</a>';
  }).join('');
  document.body.appendChild(nav);
  const update=()=>{const el=document.getElementById('mobileCartCount');if(!el)return;try{const cart=JSON.parse(localStorage.getItem('apnaCart')||'[]');const n=Array.isArray(cart)?cart.reduce((sum,item)=>sum+(Number(item.qty)||0),0):0;el.textContent=n>99?'99+':String(n);el.hidden=n===0}catch{el.hidden=true}};
  update();
  window.addEventListener('storage',update);
  setTimeout(update,300);
})();
