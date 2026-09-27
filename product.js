const params=new URLSearchParams(location.search);
const productId=params.get("id")||params.get("product")||params.get("productId")||params.get("product_id")||"";
const productSlug=params.get("slug")||"";
function rememberRecentlyViewed(product){
 try{
  const current=JSON.parse(localStorage.getItem("apnaRecentlyViewed")||"[]");
  const next=[String(product.id),...current.map(String).filter(id=>id!==String(product.id))].slice(0,8);
  localStorage.setItem("apnaRecentlyViewed",JSON.stringify(next));
 }catch(e){console.warn("Recently viewed save failed:",e)}
}
const el=document.getElementById("product");
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function money(v){return Number(v||0).toLocaleString("en-IN")}
function setMeta(name,content){let m=document.querySelector('meta[name="'+name+'"]');if(!m){m=document.createElement("meta");m.name=name;document.head.appendChild(m)}m.content=String(content||"").slice(0,180)}
function setProperty(property,content){let m=document.querySelector('meta[property="'+property+'"]');if(!m){m=document.createElement("meta");m.setAttribute("property",property);document.head.appendChild(m)}m.content=String(content||"").slice(0,300)}
function setCanonical(url){let l=document.querySelector('link[rel="canonical"]');if(!l){l=document.createElement("link");l.rel="canonical";document.head.appendChild(l)}l.href=url}
function setProductStructuredData(product,images,price,inStock=true){
 let s=document.getElementById("productStructuredData");if(!s){s=document.createElement("script");s.id="productStructuredData";s.type="application/ld+json";document.head.appendChild(s)}
 const data={"@context":"https://schema.org","@type":"Product","name":product.name,"description":String(product.description||"").slice(0,500),"sku":product.sku||undefined,"brand":product.brand?{"@type":"Brand","name":product.brand}:undefined,"image":images||[],"offers":{"@type":"Offer","priceCurrency":"INR","price":Number(price||0),"availability":"https://schema.org/"+(inStock?"InStock":"OutOfStock"),"url":location.href}};
 s.textContent=JSON.stringify(data);
}
function updateProductSeo(product){const name=String(product?.name||"Product")+" | Apna Store";document.title=name;let d=document.querySelector('meta[name="description"]');if(!d){d=document.createElement("meta");d.name="description";document.head.appendChild(d)}d.content=String(product?.description||("Shop "+(product?.name||"this product")+" on Apna Store.")).replace(/\s+/g," ").slice(0,155);let link=document.querySelector('link[rel="canonical"]');if(!link){link=document.createElement("link");link.rel="canonical";document.head.appendChild(link)}link.href=location.origin+location.pathname+"?id="+encodeURIComponent(product?.id||productId);setProperty("og:type","product");setProperty("og:title",name);setProperty("og:description",d.content);setProperty("og:url",link.href);setProperty("og:site_name","Apna Store")}
function showError(m){el.innerHTML='<div class="product-details"><p class="eyebrow">PRODUCT</p><h1>Product unavailable</h1><p class="detail-desc">'+esc(m)+'</p><a class="primary-btn" href="shop.html">Back to shop →</a></div>'}
async function notifyBackInStock(product,variantId){try{const {data:{session}}=await apnaSupabase.auth.getSession();if(!session){sessionStorage.setItem("apnaReturnAfterAuth",location.href);location.href="auth.html";return}const {error}=await apnaSupabase.rpc("subscribe_back_in_stock",{p_product_id:product.id,p_variant_id:variantId||null});if(error)throw error;const b=document.getElementById("backInStockBtn");if(b){b.textContent="✓ Notify Me enabled";b.disabled=true}}catch(e){console.error("Back-in-stock subscription failed:",e);alert(e?.message||"Could not enable the stock alert. Please try again.")}}
async function openSizeFit(product){const {data:{session}}=await apnaSupabase.auth.getSession();if(!session){sessionStorage.setItem("apnaReturnAfterAuth",location.href);location.href="auth.html";return}const {data,error}=await apnaSupabase.rpc("get_size_fit",{p_product_id:product.id});if(error){alert(error.message);return}const chart=data?.size_chart;const rows=Array.isArray(chart?.rows)?chart.rows:[];const text=rows.length?rows.map(x=>[x.size,x.chest_cm&&"Chest "+x.chest_cm+"cm",x.waist_cm&&"Waist "+x.waist_cm+"cm",x.hip_cm&&"Hip "+x.hip_cm+"cm"].filter(Boolean).join(" · ")).join("\n"):"Seller has not provided a size chart yet.";const choice=data?.recommended_size?"Recommended size: "+data.recommended_size:"Complete your measurements for a recommendation.";alert("Size Guide\n\n"+text+"\n\nFit preference: "+(data?.fit_preference||"regular")+"\n"+choice+(data?.fit_notes?"\n\n"+data.fit_notes:""))}
function openCompare(){try{const ids=JSON.parse(localStorage.getItem("apnaCompare")||"[]");if(!ids.includes(productId))ids.push(productId);localStorage.setItem("apnaCompare",JSON.stringify(ids.slice(-4)));location.href="compare.html"}catch(e){console.error(e)}}
function getWishlist(){try{return JSON.parse(localStorage.getItem("apnaWishlist")||"[]")}catch{return[]}}
async function toggleProductFollow(product){try{const {data:{session}}=await apnaSupabase.auth.getSession();if(!session){sessionStorage.setItem("apnaReturnAfterAuth",location.href);location.href="auth.html";return}const {data}=await apnaSupabase.from("customer_follows").select("id").eq("user_id",session.user.id).eq("target_type","product").eq("target_id",product.id).maybeSingle();const follow=!data;const {error}=await apnaSupabase.rpc("toggle_customer_follow",{p_type:"product",p_id:product.id,p_follow:follow});if(error)throw error;const b=document.getElementById("followProductBtn");if(b)b.textContent=follow?"✓ Following Product":"＋ Follow Product"}catch(e){console.error("Product follow failed:",e);alert(e?.message||"Could not update product follow.")}}
async function enablePriceDropAlert(product){try{const {data:{session}}=await apnaSupabase.auth.getSession();if(!session){sessionStorage.setItem("apnaReturnAfterAuth",location.href);location.href="auth.html";return}const {error}=await apnaSupabase.rpc("sync_price_drop_alert",{p_product_id:product.id});if(error)throw error;const b=document.getElementById("priceDropBtn");if(b){b.textContent="✓ Price Drop Alert enabled";b.disabled=true}}catch(e){console.error("Price drop alert failed:",e);alert(e?.message||"Could not enable price drop alert.")}}
async function wishlistState(){const {data:{session}}=await apnaSupabase.auth.getSession();if(session){const {data}=await apnaSupabase.from("wishlists").select("id").eq("user_id",session.user.id).eq("product_id",productId).maybeSingle();return !!data}return getWishlist().some(x=>String(x.productId)===String(productId))}
async function toggleWishlist(product){
  const {data:{session}}=await apnaSupabase.auth.getSession();
  if(session){
    const existing=await apnaSupabase.from("wishlists").select("id").eq("user_id",session.user.id).eq("product_id",product.id).maybeSingle();
    if(existing.data){
      await apnaSupabase.from("wishlists").delete().eq("id",existing.data.id);
    }else{
      await apnaSupabase.from("wishlists").insert({user_id:session.user.id,product_id:product.id});
    }
  }else{
    const list=getWishlist();
    const i=list.findIndex(x=>String(x.productId)===String(product.id));
    if(i>=0) list.splice(i,1);
    else list.push({productId:product.id,name:product.name,price:Number(product.price),category:product.category||"Product"});
    localStorage.setItem("apnaWishlist",JSON.stringify(list));
  }
  const btn=document.getElementById("wishlistBtn");
  if(btn){
    const saved=await wishlistState();
    btn.textContent=saved?"♥ Saved":"♡ Wishlist";
  }
}
async function renderRelated(product){const box=document.getElementById("relatedProducts");if(!box||!product.category_id)return;const {data}=await apnaSupabase.from("products").select("id,name,price,compare_at_price").eq("status","active").eq("category_id",product.category_id).neq("id",product.id).order("created_at",{ascending:false}).limit(4);if(!data?.length){box.closest("section")?.remove();return}const ids=data.map(p=>p.id);const {data:imgs}=await apnaSupabase.from("product_images").select("product_id,storage_path,is_primary,sort_order").in("product_id",ids).order("is_primary",{ascending:false}).order("sort_order");const imageMap=new Map();(imgs||[]).forEach(x=>{if(!imageMap.has(x.product_id))imageMap.set(x.product_id,apnaSupabase.storage.from("product-images").getPublicUrl(x.storage_path).data.publicUrl)});box.innerHTML=data.map(p=>{const img=imageMap.get(p.id);return '<a class="product-card" href="product.html?id='+encodeURIComponent(p.id)+'"><div class="product-image">'+(img?'<img src="'+esc(img)+'" alt="'+esc(p.name)+'" loading="lazy">':'<span>'+esc(p.name)+'</span>')+'</div><div class="product-info"><h3>'+esc(p.name)+'</h3><p class="price">₹'+money(p.price)+'</p></div></a>'}).join("")}
function renderProduct(product,variants=[],images=[],flashSale=null,dailyDeal=null){
 updateProductSeo(product);
 const available=(variants||[]).filter(v=>Number(v.stock||0)>0);
 const allSizes=[...new Set((variants||[]).map(v=>v.size).filter(Boolean))],allColors=[...new Set((variants||[]).map(v=>v.color).filter(Boolean))];
 if(!available.length){el.innerHTML='<div class="product-details"><div class="product-detail-top"><p class="eyebrow">PRODUCT</p><button id="wishlistBtn" class="wishlist-detail">♡ Wishlist</button><button id="compareBtn" class="text-btn">⇄ Compare</button><button id="sizeFitBtn" class="text-btn"><span class="ui-icon" aria-hidden="true">↗</span> Size / Fit Guide</button><button id="followProductBtn" class="text-btn">＋ Follow Product</button><button id="priceDropBtn" class="text-btn"><span class="ui-icon" aria-hidden="true">!</span> Price Drop Alert</button></div><h1>'+esc(product.name)+'</h1><p class="detail-desc">'+esc(product.description||"This product is currently out of stock.")+'</p><button id="backInStockBtn" class="primary-btn">Notify Me When Available</button></div>';document.getElementById("wishlistBtn").onclick=()=>toggleWishlist(product);document.getElementById("compareBtn").onclick=openCompare;document.getElementById("sizeFitBtn").onclick=()=>openSizeFit(product);document.getElementById("followProductBtn").onclick=()=>toggleProductFollow(product);document.getElementById("priceDropBtn").onclick=()=>enablePriceDropAlert(product);document.getElementById("backInStockBtn").onclick=()=>notifyBackInStock(product,null);return;}
 let size=available[0].size||"",color=available[0].color||"",qty=1,variantId=null;
 function findVariant(){const v=available.find(x=>(x.size||"")===size&&(x.color||"")===color);variantId=v?.id||null}
 findVariant();
 const mrp=Number(product.compare_at_price||0),basePrice=Number(product.price||0),price=Number(flashSale?.sale_price||dailyDeal?.deal_price||basePrice),discount=mrp>price?Math.round((1-price/mrp)*100):0;
 let gallery=[];
 el.innerHTML='<div class="product-main-layout"><div class="product-visual"><div class="product-gallery"><div class="product-thumbs" id="productThumbs">'+gallery.map((u,i)=>'<button class="product-thumb '+(i===0?"selected":"")+'" data-gallery="'+i+'" aria-label="Product image '+(i+1)+'"><img src="'+esc(u)+'" alt="'+esc(product.name)+'"></button>').join("")+'</div><div class="product-large '+(gallery.length?"has-image":"")+'" id="mainProductImage">'+(gallery.length?'<button class="gallery-zoom" id="galleryZoom" aria-label="Zoom product image">⌕</button><img class="product-main-img" src="'+esc(gallery[0])+'" alt="'+esc(product.name)+'"><span class="gallery-counter">1 / '+gallery.length+'</span>':"<span>APNA<br>STORE</span>")+'</div><p class="gallery-note">Click image or zoom icon to view full size</p></div></div><div class="product-details"><div class="product-detail-top"><p class="eyebrow">'+esc(product.category||"PRODUCT").toUpperCase()+'</p><button id="wishlistBtn" class="wishlist-detail">♡ Wishlist</button><button id="compareBtn" class="text-btn">⇄ Compare</button><button id="sizeFitBtn" class="text-btn">↗ Size / Fit Guide</button><button id="followProductBtn" class="text-btn">＋ Follow Product</button><button id="priceDropBtn" class="text-btn">! Price Drop Alert</button></div><h1>'+esc(product.name)+'</h1>'+(product.brand?'<p class="product-note">Brand: '+esc(product.brand)+'</p>':"")+'<div class="price-block"><strong>₹'+money(price)+'</strong>'+(mrp>price?'<del>₹'+money(mrp)+'</del><span class="discount-badge">'+discount+'% OFF</span>':"")+(flashSale?'<span class="discount-badge"><span class="ui-icon" aria-hidden="true">⚡</span> FLASH SALE</span>':(dailyDeal?'<span class="discount-badge"><span class="ui-icon" aria-hidden="true">★</span> DEAL OF THE DAY</span>':""))+'</div><p class="detail-desc">'+esc(product.description||"A carefully selected everyday product from Apna Store.")+'</p><div class="detail-meta"><span><i class="meta-icon" aria-hidden="true">✓</i> Secure checkout</span><span><i class="meta-icon" aria-hidden="true">↺</i> Easy returns</span><span><i class="meta-icon" aria-hidden="true">→</i> India delivery</span></div><div class="option"><b>Size</b><div class="option-list">'+(allSizes.length?allSizes.map(x=>'<button '+(!available.some(v=>(v.size||"")===x)?"disabled ":"")+'data-size="'+esc(x)+'">'+esc(x)+'</button>').join(""):"<span class=\"product-note\">One size</span>")+'</div></div><div class="option"><b>Color: <span id="colorName">'+esc(color||"Standard")+'</span></b><div class="option-list">'+(allColors.length?allColors.map(x=>'<button class="swatch" '+(!available.some(v=>(v.color||"")===x)?"disabled ":"")+'data-color="'+esc(x)+'">'+esc(x)+'</button>').join(""):"<span class=\"product-note\">Standard</span>")+'</div></div><div class="buy-row"><div class="qty"><button id="minus">−</button><span id="qty">1</span><button id="plus">+</button></div><button class="primary-btn" id="add">Add to bag <span>→</span></button></div><p id="stockInfo" class="product-note"></p><div class="delivery-check"><b>Check delivery</b><div><input id="pincode" inputmode="numeric" maxlength="6" placeholder="Enter 6-digit pincode"><button id="checkPincode" class="text-btn">Check</button></div><small id="pincodeMessage">Delivery availability will be confirmed at checkout.</small></div><div class="product-specs"><h3>Product information</h3><div><span>SKU</span><b id="skuInfo">—</b></div><div><span>Category</span><b>'+esc(product.category||"Apna Store")+'</b></div><div><span>Seller</span><b><a id="sellerStoreLink" href="seller-store.html">Visit seller store →</a></b></div></div></div></div><div id="productReviewsMount"></div><section class="related-section section"><div class="section-head"><div><p class="eyebrow">YOU MAY ALSO LIKE</p><h2>Related products</h2></div></div><div class="products" id="relatedProducts"><p class="checkout-note">Loading related products…</p></div></section>';
 const sellerStoreLink=document.getElementById("sellerStoreLink");if(sellerStoreLink&&product.seller_id)sellerStoreLink.href="seller-store.html?seller="+encodeURIComponent(product.seller_id);
 const main=document.getElementById("mainProductImage"),thumbBox=document.getElementById("productThumbs");
 let activeImage=null;
 function galleryForVariant(id){const specific=(images||[]).filter(x=>x.variant_id===id);const general=(images||[]).filter(x=>!x.variant_id);return (specific.length?specific:general.length?general:images||[]).map(x=>x.url).filter(Boolean);}
 function renderGallery(list){gallery=list;activeImage=gallery[0]||null;thumbBox.innerHTML=gallery.map((u,i)=>'<button class="product-thumb '+(i===0?"selected":"")+'" data-gallery="'+i+'" aria-label="Product image '+(i+1)+'"><img src="'+esc(u)+'" alt="'+esc(product.name)+'"></button>').join("");setImage(0);thumbBox.querySelectorAll("[data-gallery]").forEach((b,i)=>b.onclick=()=>setImage(i));}
 function setImage(i){activeImage=gallery[i]||null;main.classList.toggle("has-image",!!activeImage);main.style.backgroundImage="none";main.innerHTML=activeImage?'<button class="gallery-zoom" id="galleryZoom" aria-label="Zoom product image">⌕</button><img class="product-main-img" src="'+esc(activeImage)+'" alt="'+esc(product.name)+'"><span class="gallery-counter">'+(i+1)+' / '+gallery.length+'</span>':'<span>APNA<br>STORE</span>';thumbBox.querySelectorAll("[data-gallery]").forEach((b,j)=>b.classList.toggle("selected",j===i));document.getElementById("galleryZoom")?.addEventListener("click",e=>{e.stopPropagation();openLightbox(i)})}
 function openLightbox(start){
  if(!gallery[start])return;
  let index=start,scale=1;
  const previousOverflow=document.body.style.overflow;
  const overlay=document.createElement("div");overlay.className="image-lightbox";overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");overlay.setAttribute("aria-label","Product image viewer");
  const stage=document.createElement("div");stage.className="lightbox-stage";
  const close=document.createElement("button"),prev=document.createElement("button"),next=document.createElement("button"),zoomOut=document.createElement("button"),zoomIn=document.createElement("button"),zoomReset=document.createElement("button"),img=document.createElement("img"),counter=document.createElement("span");
  close.className="lightbox-close";close.setAttribute("aria-label","Close");close.textContent="×";
  prev.className="lightbox-prev";prev.setAttribute("aria-label","Previous image");prev.textContent="‹";
  next.className="lightbox-next";next.setAttribute("aria-label","Next image");next.textContent="›";
  zoomOut.className="lightbox-zoom-out";zoomOut.setAttribute("aria-label","Zoom out");zoomOut.textContent="−";
  zoomIn.className="lightbox-zoom-in";zoomIn.setAttribute("aria-label","Zoom in");zoomIn.textContent="+";
  zoomReset.className="lightbox-zoom-reset";zoomReset.setAttribute("aria-label","Reset zoom");zoomReset.textContent="Reset";
  counter.className="lightbox-counter";
  img.alt=product.name;img.decoding="async";img.draggable=false;img.style.display="block";img.style.width="auto";img.style.height="auto";img.style.maxWidth="100%";img.style.maxHeight="100%";img.style.objectFit="contain";img.style.transformOrigin="center center";img.style.transition="transform .18s ease";
  stage.appendChild(img);overlay.append(close,prev,stage,next,zoomOut,zoomIn,zoomReset,counter);
  const applyZoom=()=>{img.style.transform="scale("+scale+")";stage.classList.toggle("is-zoomed",scale>1);img.style.cursor=scale>1?"zoom-out":"zoom-in"};
  const draw=()=>{const url=gallery[index];if(!url)return;scale=1;img.onload=()=>applyZoom();img.src=url;img.alt=product.name;counter.textContent=(index+1)+" / "+gallery.length;applyZoom()};
  const closeLightbox=()=>{document.body.style.overflow=previousOverflow;document.removeEventListener("keydown",onKey);overlay.remove()};
  const goPrevious=()=>{index=(index-1+gallery.length)%gallery.length;draw()};const goNext=()=>{index=(index+1)%gallery.length;draw()};
  const onKey=e=>{if(e.key==="Escape"){e.preventDefault();closeLightbox()}else if(e.key==="ArrowLeft"){e.preventDefault();goPrevious()}else if(e.key==="ArrowRight"){e.preventDefault();goNext()}else if(e.key==="+"){e.preventDefault();scale=Math.min(3,+(scale+.25).toFixed(2));applyZoom()}else if(e.key==="-"){e.preventDefault();scale=Math.max(1,+(scale-.25).toFixed(2));applyZoom()}else if(e.key==="0"){e.preventDefault();scale=1;applyZoom()}};
  close.onclick=e=>{e.stopPropagation();closeLightbox()};prev.onclick=e=>{e.stopPropagation();goPrevious()};next.onclick=e=>{e.stopPropagation();goNext()};zoomIn.onclick=e=>{e.stopPropagation();scale=Math.min(3,+(scale+.25).toFixed(2));applyZoom()};zoomOut.onclick=e=>{e.stopPropagation();scale=Math.max(1,+(scale-.25).toFixed(2));applyZoom()};zoomReset.onclick=e=>{e.stopPropagation();scale=1;applyZoom()};img.onclick=e=>{e.stopPropagation();scale=scale>1?1:2;applyZoom()};stage.onclick=e=>{if(e.target===stage)closeLightbox()};overlay.onclick=e=>{if(e.target===overlay)closeLightbox()};img.onerror=()=>{counter.textContent=(index+1)+" / "+gallery.length+" · Image unavailable"};
  document.body.style.overflow="hidden";document.addEventListener("keydown",onKey);document.body.appendChild(overlay);draw();setTimeout(()=>close.focus(),0);
 }

 main.onclick=()=>{if(activeImage)openLightbox(Math.max(0,gallery.indexOf(activeImage)))};

 async function refreshOptions(){findVariant();renderGallery(galleryForVariant(variantId));const add=document.getElementById("add"),stockInfo=document.getElementById("stockInfo"),current=available.find(x=>x.id===variantId);add.disabled=!variantId;add.innerHTML=variantId?'Add to bag <span>→</span>':'Unavailable combination';const stickyButton=document.getElementById("mobileStickyAdd");if(stickyButton){stickyButton.disabled=!variantId;stickyButton.textContent=variantId?"Add to bag →":"Unavailable";}if(variantId&&current){const stock=Number(current.stock||0);if(qty>stock)qty=stock;document.getElementById("qty").textContent=qty;document.getElementById("skuInfo").textContent=current.sku||"—";stockInfo.textContent="✓ In stock: "+stock+" available for "+(size||"standard")+" / "+(color||"standard")+"."}else{document.getElementById("skuInfo").textContent="—";stockInfo.textContent="✕ This size + color combination is unavailable.";let alertBtn=document.getElementById("backInStockBtn");if(!alertBtn){const wrap=document.createElement("div");wrap.innerHTML='<button id="backInStockBtn" class="text-btn">Notify Me When Available</button>';document.querySelector(".buy-row")?.after(wrap);alertBtn=wrap.firstElementChild;alertBtn.onclick=()=>notifyBackInStock(product,variantId)}alertBtn.hidden=!!variantId;}}
 document.querySelectorAll("[data-size]").forEach(b=>{if(b.dataset.size===size)b.classList.add("selected");b.onclick=()=>{document.querySelectorAll("[data-size]").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");size=b.dataset.size;refreshOptions()};});
 document.querySelectorAll("[data-color]").forEach(b=>{if(b.dataset.color===color)b.classList.add("selected");b.onclick=()=>{document.querySelectorAll("[data-color]").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");color=b.dataset.color;document.getElementById("colorName").textContent=color;refreshOptions()};});
 document.getElementById("plus").onclick=()=>{const stock=available.find(x=>x.id===variantId)?.stock;if(!stock)return alert("Please select an available size and color.");if(qty>=Number(stock))return alert("Only "+Number(stock)+" item(s) are available for this variant.");qty++;document.getElementById("qty").textContent=qty};
 document.getElementById("minus").onclick=()=>{if(qty>1)qty--;document.getElementById("qty").textContent=qty};
 document.getElementById("add").onclick=()=>{if(!variantId)return alert("Please select an available size and color.");const cart=JSON.parse(localStorage.getItem("apnaCart")||"[]"),key=product.id+"-"+size+"-"+color,existing=cart.find(x=>x.key===key),stock=Number(available.find(x=>x.id===variantId)?.stock||0);if(existing){if(Number(existing.qty)+qty>stock)return alert("Only "+stock+" item(s) are available for this variant.");existing.qty+=qty}else cart.push({key,productId:product.id,variantId,name:product.name,category:product.category||"Product",price,size,color,qty});localStorage.setItem("apnaCart",JSON.stringify(cart));location.href="cart.html"};
 document.getElementById("wishlistBtn").onclick=()=>toggleWishlist(product);document.getElementById("compareBtn").onclick=openCompare;document.getElementById("sizeFitBtn").onclick=()=>openSizeFit(product);document.getElementById("followProductBtn").onclick=()=>toggleProductFollow(product);document.getElementById("priceDropBtn").onclick=()=>enablePriceDropAlert(product);if(!document.getElementById("shareProductBtn")){const share=document.createElement("button");share.id="shareProductBtn";share.className="text-btn";share.textContent="↗ Share";document.querySelector(".product-detail-top")?.appendChild(share);share.onclick=async()=>{try{if(navigator.share)await navigator.share({title:product.name,text:"Check out this product on Apna Store",url:location.href});else{await navigator.clipboard.writeText(location.href);share.textContent="✓ Link copied";setTimeout(()=>share.textContent="↗ Share",1800)}}catch(e){}}}
 document.getElementById("checkPincode").onclick=()=>{const p=document.getElementById("pincode").value.trim(),m=document.getElementById("pincodeMessage");if(!/^[1-9][0-9]{5}$/.test(p)){m.textContent="Please enter a valid 6-digit Indian pincode.";return}m.textContent="Pincode accepted. Final delivery availability and estimate will be confirmed at checkout.";};
 setProductStructuredData(product,images.map(x=>x.url),price,available.length>0);refreshOptions();wishlistState().then(v=>{document.getElementById("wishlistBtn").textContent=v?"♥ Saved":"♡ Wishlist"});renderRelated(product);const addButton=document.getElementById("add");if(addButton&&!document.querySelector(".mobile-sticky-buy")){const sticky=document.createElement("div");sticky.className="mobile-sticky-buy";sticky.innerHTML='<span class="mobile-sticky-price">₹'+money(price)+'</span><button id="mobileStickyAdd" type="button">Add to bag →</button>';document.body.appendChild(sticky);const syncSticky=()=>{const b=document.getElementById("mobileStickyAdd");if(b){b.disabled=addButton.disabled;b.textContent=addButton.disabled?"Unavailable":"Add to bag →"}};document.getElementById("mobileStickyAdd").onclick=()=>{if(!addButton.disabled)addButton.click()};syncSticky();}
}
async function loadProduct(){
 if(!productId&&!productSlug)return showError("Please choose a product from the shop.");
 try{
  let productQuery=apnaSupabase.from("products").select("id,name,slug,description,price,compare_at_price,category_id,brand_id,seller_id").eq("status","active");
  productQuery=productId?productQuery.eq("id",productId):productQuery.eq("slug",productSlug);
  let {data,error}=await productQuery.maybeSingle();
  if(error)throw error;

  // Keep older/shared product links working: if an old URL used an ID-like value
  // in a slug parameter, retry by slug before declaring the product unavailable.
  if(!data&&productId){
   const fallback=await apnaSupabase.from("products").select("id,name,slug,description,price,compare_at_price,category_id,brand_id,seller_id").eq("slug",productId).eq("status","active").maybeSingle();
   if(fallback.error)throw fallback.error;
   data=fallback.data||null;
  }
  if(!data)return showError("This product is no longer available.");

  // Category/brand labels are optional metadata. A problem in either table
  // must not make a valid active product disappear.
  const [categoryResult,brandResult]=await Promise.all([
   apnaSupabase.from("categories").select("id,name"),
   apnaSupabase.from("brands").select("id,name").eq("is_active",true)
  ]);
  const categories=categoryResult.data||[],brands=brandResult.data||[];
  if(categoryResult.error)console.warn("Product category lookup failed:",categoryResult.error);
  if(brandResult.error)console.warn("Product brand lookup failed:",brandResult.error);

  const categoryMap=new Map(categories.map(c=>[c.id,c.name])),brandMap=new Map(brands.map(b=>[b.id,b.name]));
  const realProductId=data.id;
  const [vr,ir]=await Promise.all([
   apnaSupabase.from("product_variants").select("id,size,color,sku,stock").eq("product_id",realProductId).order("size"),
   apnaSupabase.from("product_images").select("storage_path,alt_text,sort_order,is_primary,variant_id").eq("product_id",realProductId).order("is_primary",{ascending:false}).order("sort_order")
  ]);
  if(vr.error||ir.error)throw vr.error||ir.error;
  const images=(ir.data||[]).map(x=>{const u=apnaSupabase.storage.from("product-images").getPublicUrl(x.storage_path).data.publicUrl;return {url:u,alt:x.alt_text||data.name,variant_id:x.variant_id||null}}).filter(x=>x.url);
  const renderedProduct={...data,category:categoryMap.get(data.category_id)||"Apna Store",brand:brandMap.get(data.brand_id)||""};
  const [{data:flashRows},{data:dealRows}]=await Promise.all([apnaSupabase.rpc("get_active_flash_sales"),apnaSupabase.rpc("get_active_daily_deals")]);
  const flashSale=(flashRows||[]).find(x=>x.product_id===realProductId)||null;
  const dailyDeal=(dealRows||[]).find(x=>x.product_id===realProductId)||null;
  renderProduct(renderedProduct,vr.data||[],images,flashSale,dailyDeal);
  rememberRecentlyViewed(renderedProduct);
  if(window.apnaTrackProductView)apnaTrackProductView(realProductId);
  if(window.apnaRecommendationFeed)window.apnaRecommendationFeed(realProductId);
 }catch(e){
  console.error("Product detail load failed:",e);
  showError("We could not load this product right now. Please refresh and try again.");
 }
}
loadProduct();