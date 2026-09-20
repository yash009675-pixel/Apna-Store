const params=new URLSearchParams(location.search);
const productId=params.get("id");
const el=document.getElementById("product");
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function money(v){return Number(v||0).toLocaleString("en-IN")}
function updateProductSeo(product){const name=String(product?.name||"Product")+" | Apna Store";document.title=name;let d=document.querySelector('meta[name="description"]');if(!d){d=document.createElement("meta");d.name="description";document.head.appendChild(d)}d.content=String(product?.description||("Shop "+(product?.name||"this product")+" on Apna Store.")).replace(/\s+/g," ").slice(0,155);let link=document.querySelector('link[rel="canonical"]');if(!link){link=document.createElement("link");link.rel="canonical";document.head.appendChild(link)}link.href=location.origin+location.pathname+"?id="+encodeURIComponent(product?.id||productId);let og=document.querySelector('meta[property="og:title"]');if(!og){og=document.createElement("meta");og.setAttribute("property","og:title");document.head.appendChild(og)}og.content=name;}function showError(m){el.innerHTML='<div class="product-details"><p class="eyebrow">PRODUCT</p><h1>Product unavailable</h1><p class="detail-desc">'+esc(m)+'</p><a class="primary-btn" href="shop.html">Back to shop →</a></div>'}
function renderProduct(product,variants=[]){updateProductSeo(product);
 const available=(variants||[]).filter(v=>Number(v.stock||0)>0);
 const finalSizes=[...new Set(available.map(v=>v.size).filter(Boolean))];
 const finalColors=[...new Set(available.map(v=>v.color).filter(Boolean))];
 if(!finalSizes.length||!finalColors.length)return showError("This product currently has no available variants.");
 let size=available[0].size||"",color=available[0].color||"",qty=1,variantId=null;
 function findVariant(){const v=available.find(x=>(x.size||"")===size&&(x.color||"")===color);variantId=v?.id||null}
 findVariant();
 el.innerHTML='<div class="product-visual"><div class="product-image product-large" id="mainProductImage"><span>APNA<br>EDIT</span></div></div><div class="product-details"><p class="eyebrow">'+esc(product.category||"PRODUCT").toUpperCase()+'</p><h1>'+esc(product.name)+'</h1>'+(product.brand?'<p class="product-note">Brand: '+esc(product.brand)+'</p>':"")+'<p class="detail-price">₹'+money(product.price)+'</p><p class="detail-desc">'+esc(product.description||"A carefully selected everyday product from Apna Store.")+'</p><div class="option"><b>Size</b><div class="option-list">'+finalSizes.map((x,j)=>'<button class="'+(j===0?"selected":"")+'" data-size="'+esc(x)+'">'+esc(x)+'</button>').join("")+'</div></div><div class="option"><b>Color: <span id="colorName">'+esc(color)+'</span></b><div class="option-list">'+finalColors.map((x,j)=>'<button class="swatch '+(j===0?"selected":"")+'" data-color="'+esc(x)+'">'+esc(x)+'</button>').join("")+'</div></div><div class="buy-row"><div class="qty"><button id="minus">−</button><span id="qty">1</span><button id="plus">+</button></div><button class="primary-btn" id="add">Add to bag <span>→</span></button></div><p id="stockInfo" class="product-note"></p><p class="product-note">✓ Secure payment &nbsp; ✓ Easy returns &nbsp; ✓ Delivery across India</p></div>';
 if(product.image){const mi=document.getElementById("mainProductImage");mi.style.backgroundImage="url('"+product.image+"')";mi.style.backgroundSize="cover";mi.style.backgroundPosition="center";mi.classList.add("has-image");mi.innerHTML="";}
 function refreshOptions(){findVariant();const add=document.getElementById("add");const stockInfo=document.getElementById("stockInfo");const current=available.find(x=>x.id===variantId);add.disabled=!variantId;add.textContent=variantId?"Add to bag →":"Unavailable combination";if(variantId&&current){const stock=Number(current.stock||0);if(qty>stock)qty=stock;document.getElementById("qty").textContent=qty;stockInfo.textContent="✓ In stock: "+stock+" available for "+size+" / "+color+".";stockInfo.style.color="";}else{stockInfo.textContent="✕ This size + color combination is unavailable.";stockInfo.style.color="#a33";}}
 document.querySelectorAll("[data-size]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-size]").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");size=b.dataset.size;refreshOptions()});
 document.querySelectorAll("[data-color]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-color]").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");color=b.dataset.color;document.getElementById("colorName").textContent=color;refreshOptions()});
 document.getElementById("plus").onclick=()=>{const stock=available.find(x=>x.id===variantId)?.stock;if(!stock){alert("Please select an available size and color.");return}if(qty>=Number(stock)){alert("Only "+Number(stock)+" item(s) are available for this variant.");return}qty++;document.getElementById("qty").textContent=qty};
 document.getElementById("minus").onclick=()=>{if(qty>1)qty--;document.getElementById("qty").textContent=qty};
 document.querySelectorAll("[data-size]").forEach(b=>{b.disabled=!available.some(v=>(v.size||"")===b.dataset.size);});
 document.querySelectorAll("[data-color]").forEach(b=>{b.disabled=!available.some(v=>(v.color||"")===b.dataset.color);});
 refreshOptions();
 document.getElementById("add").onclick=()=>{if(!variantId){alert("Please select an available size and color.");return}const cart=JSON.parse(localStorage.getItem("apnaCart")||"[]"),key=product.id+"-"+size+"-"+color,existing=cart.find(x=>x.key===key),stock=Number(available.find(x=>x.id===variantId)?.stock||0);if(existing){if(Number(existing.qty)+qty>stock){alert("Only "+stock+" item(s) are available for this variant.");return}existing.qty+=qty}else cart.push({key,productId:product.id,variantId,name:product.name,category:product.category||"Product",price:Number(product.price),size,color,qty});localStorage.setItem("apnaCart",JSON.stringify(cart));location.href="cart.html"};
}
async function loadProduct(){
 if(!productId)return showError("Please choose a product from the shop.");
 try{
  const [{data,error},{data:categories,error:categoryError},{data:brands,error:brandError}]=await Promise.all([
   apnaSupabase.from("products").select("id,name,slug,description,price,category_id,brand_id").eq("id",productId).eq("status","active").maybeSingle(),
   apnaSupabase.from("categories").select("id,name"),
   apnaSupabase.from("brands").select("id,name").eq("is_active",true)
  ]);
  if(error||categoryError||brandError)throw error||categoryError||brandError;
  if(!data)return showError("This product does not exist.");
  const categoryMap=new Map((categories||[]).map(c=>[c.id,c.name]));
  const vr=await apnaSupabase.from("product_variants").select("id,size,color,sku,stock").eq("product_id",productId).order("size");const ir=await apnaSupabase.from("product_images").select("storage_path").eq("product_id",productId).order("is_primary",{ascending:false}).order("sort_order");if(ir.error)throw ir.error;const image=ir.data?.[0]?.storage_path?apnaSupabase.storage.from("product-images").getPublicUrl(ir.data[0].storage_path).data.publicUrl:null;
  if(vr.error)throw vr.error;
  const brandMap=new Map((brands||[]).map(b=>[b.id,b.name]));
  renderProduct({...data,category:categoryMap.get(data.category_id)||"Apna Store",brand:brandMap.get(data.brand_id)||"",image},vr.data||[]);
 }catch(e){console.error("Product detail load failed:",e);showError("We could not load this product right now. Please refresh and try again.")}
}
loadProduct();