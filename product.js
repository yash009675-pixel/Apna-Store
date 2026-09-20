const params=new URLSearchParams(location.search);
const productId=params.get("id");
const el=document.getElementById("product");
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function money(v){return Number(v||0).toLocaleString("en-IN")}
function showError(m){el.innerHTML='<div class="product-details"><p class="eyebrow">PRODUCT</p><h1>Product unavailable</h1><p class="detail-desc">'+esc(m)+'</p><a class="primary-btn" href="shop.html">Back to shop →</a></div>'}
function renderProduct(product,variants=[]){
 const available=(variants||[]).filter(v=>Number(v.stock||0)>0);
 const finalSizes=[...new Set(available.map(v=>v.size).filter(Boolean))];
 const finalColors=[...new Set(available.map(v=>v.color).filter(Boolean))];
 if(!finalSizes.length||!finalColors.length)return showError("This product currently has no available variants.");
 let size=available[0].size||"",color=available[0].color||"",qty=1,variantId=null;
 function findVariant(){const v=available.find(x=>(x.size||"")===size&&(x.color||"")===color);variantId=v?.id||null;return v}
 findVariant();
 el.innerHTML='<div class="product-visual"><div class="product-image product-large"><span>APNA<br>EDIT</span></div></div><div class="product-details"><p class="eyebrow">'+esc(product.category||"PRODUCT").toUpperCase()+'</p><h1>'+esc(product.name)+'</h1><div class="product-price-row"><p class="detail-price">₹'+money(product.price)+'</p>'+(product.compare_at_price&&Number(product.compare_at_price)>Number(product.price)?'<p class="compare-price">₹'+money(product.compare_at_price)+'</p><span class="save-badge">SAVE '+Math.round((1-Number(product.price)/Number(product.compare_at_price))*100)+'%</span>':"")+"</div><p class="detail-desc">'+esc(product.description||"A carefully selected everyday product from Apna Store.")+'</p><div class="option"><b>Size</b><div class="option-list">'+finalSizes.map((x,j)=>'<button class="'+(j===0?"selected":"")+'" data-size="'+esc(x)+'">'+esc(x)+'</button>').join("")+'</div></div><div class="option"><b>Color: <span id="colorName">'+esc(color)+'</span></b><div class="option-list">'+finalColors.map((x,j)=>'<button class="swatch '+(j===0?"selected":"")+'" data-color="'+esc(x)+'">'+esc(x)+'</button>').join("")+'</div></div><div class="buy-row"><div class="qty"><button id="minus">−</button><span id="qty">1</span><button id="plus">+</button></div><button class="primary-btn" id="add">Add to bag <span>→</span></button></div><p id="stockInfo" class="product-note"></p><p class="product-note">✓ Secure payment &nbsp; ✓ Easy returns &nbsp; ✓ Delivery across India</p></div>';
 function refreshOptions(){findVariant();const add=document.getElementById("add");const stockInfo=document.getElementById("stockInfo");const current=available.find(x=>x.id===variantId);add.disabled=!variantId;add.textContent=variantId?"Add to bag →":"Unavailable combination";if(variantId&&current){const stock=Number(current.stock||0);if(qty>stock)qty=stock;document.getElementById("qty").textContent=qty;stockInfo.textContent="✓ In stock: "+stock+" available for "+size+" / "+color+".";stockInfo.style.color="";}else{stockInfo.textContent="✕ This size + color combination is unavailable.";stockInfo.style.color="#a33";}}
 document.querySelectorAll("[data-size]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-size]").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");size=b.dataset.size;refreshOptions()});
 document.querySelectorAll("[data-color]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-color]").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");color=b.dataset.color;document.getElementById("colorName").textContent=color;refreshOptions()});
 document.getElementById("plus").onclick=()=>{const stock=available.find(x=>x.id===variantId)?.stock;if(!stock){alert("Please select an available size and color.");return}if(qty>=Number(stock)){alert("Only "+Number(stock)+" item(s) are available for this variant.");return}qty++;document.getElementById("qty").textContent=qty};
 document.getElementById("minus").onclick=()=>{if(qty>1)qty--;document.getElementById("qty").textContent=qty};
 document.querySelectorAll("[data-size]").forEach(b=>{const has=available.some(v=>(v.size||"")===b.dataset.size);b.disabled=!has;b.title=has?"":"Out of stock"});
 document.querySelectorAll("[data-color]").forEach(b=>{const has=available.some(v=>(v.color||"")===b.dataset.color);b.disabled=!has;b.title=has?"":"Out of stock"});
 refreshOptions();
 document.getElementById("add").onclick=()=>{if(!variantId){alert("Please select an available size and color.");return}const cart=JSON.parse(localStorage.getItem("apnaCart")||"[]"),current=available.find(x=>x.id===variantId),availableStock=Number(current?.stock||0);if(!availableStock){alert("This variant is out of stock.");return}if(qty>availableStock){qty=availableStock;document.getElementById("qty").textContent=qty}const key=product.id+"-"+size+"-"+color,existing=cart.find(x=>x.key===key);if(existing)existing.qty+=qty;else cart.push({key,productId:product.id,variantId,name:product.name,category:product.category||"Product",price:Number(product.price),compareAtPrice:product.compare_at_price?Number(product.compare_at_price):null,size,color,qty});localStorage.setItem("apnaCart",JSON.stringify(cart));location.href="cart.html"};
}
async function loadProduct(){
 if(!productId)return showError("Please choose a product from the shop.");
 try{
  const [{data,error},{data:categories,error:categoryError}]=await Promise.all([
   apnaSupabase.from("products").select("id,name,slug,description,price,compare_at_price,category_id").eq("id",productId).eq("status","active").maybeSingle(),
   apnaSupabase.from("categories").select("id,name")
  ]);
  if(error||categoryError)throw error||categoryError;
  if(!data)return showError("This product does not exist.");
  const categoryMap=new Map((categories||[]).map(c=>[c.id,c.name]));
  const vr=await apnaSupabase.from("product_variants").select("id,size,color,sku,stock").eq("product_id",productId).order("size");
  if(vr.error)throw vr.error;
  renderProduct({...data,category:categoryMap.get(data.category_id)||"Apna Store"},vr.data||[]);
 }catch(e){console.error("Product detail load failed:",e);showError("We could not load this product right now. Please refresh and try again.")}
}
loadProduct();