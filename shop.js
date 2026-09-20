let products=[];let variants=[];let cloudWishlistIds=new Set();let selected=new URLSearchParams(location.search).get("category")||"All";
const root=document.getElementById("shopProducts"),count=document.getElementById("cartCount");
const filters={min:"",max:"",size:"",color:"",stock:"all"};
function readCart(){try{const c=JSON.parse(localStorage.getItem("apnaCart")||"[]");return Array.isArray(c)?c:[]}catch{return[]}}
function cart(){if(count)count.textContent=readCart().reduce((n,x)=>n+(Number(x.qty)||0),0)}
function readWishlist(){try{const w=JSON.parse(localStorage.getItem("apnaWishlist")||"[]");return Array.isArray(w)?w:[]}catch{return[]}}
async function loadCloudWishlist(){cloudWishlistIds=new Set();const {data:sessionData,error:sessionError}=await apnaSupabase.auth.getSession();if(sessionError||!sessionData?.session)return;const {data,error}=await apnaSupabase.from("wishlists").select("product_id").eq("user_id",sessionData.session.user.id);if(error){console.error("Wishlist state load failed:",error);return;}cloudWishlistIds=new Set((data||[]).map(row=>row.product_id));}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function showWishlistMessage(message){let el=document.getElementById("wishlistMessage");if(!el){el=document.createElement("p");el.id="wishlistMessage";el.className="checkout-note";root.parentElement.insertBefore(el,root)}el.textContent=message;clearTimeout(showWishlistMessage.timer);showWishlistMessage.timer=setTimeout(()=>{el.textContent=""},3000)}
function parseFilters(){const p=new URLSearchParams(location.search);filters.min=p.get("min")||"";filters.max=p.get("max")||"";filters.size=p.get("size")||"";filters.color=p.get("color")||"";filters.stock=p.get("stock")==="in"?"in":"all"}
function syncFilterControls(){document.getElementById("minPrice").value=filters.min;document.getElementById("maxPrice").value=filters.max;document.getElementById("sizeFilter").value=filters.size;document.getElementById("colorFilter").value=filters.color;document.getElementById("stockFilter").value=filters.stock}
function buildFilterOptions(){
 const sizes=[...new Set(variants.map(v=>v.size).filter(Boolean))].sort((a,b)=>{const na=Number(a),nb=Number(b);return Number.isNaN(na)||Number.isNaN(nb)?a.localeCompare(b):na-nb});
 const colors=[...new Set(variants.map(v=>v.color).filter(Boolean))].sort();
 const sizeEl=document.getElementById("sizeFilter"),colorEl=document.getElementById("colorFilter");
 sizeEl.innerHTML='<option value="">All sizes</option>'+sizes.map(v=>'<option value="'+escapeHtml(v)+'">'+escapeHtml(v)+'</option>').join("");
 colorEl.innerHTML='<option value="">All colors</option>'+colors.map(v=>'<option value="'+escapeHtml(v)+'">'+escapeHtml(v)+'</option>').join("");
 syncFilterControls();
}
async function loadProducts(){
 root.innerHTML='<p class="checkout-note">Loading Apna products…</p>';
 const [productResult,categoryResult,variantResult]=await Promise.all([
  apnaSupabase.from("products").select("id,name,slug,description,price,category_id").eq("status","active").order("created_at",{ascending:true}),
  apnaSupabase.from("categories").select("id,name"),
  apnaSupabase.from("product_variants").select("product_id,size,color,stock")
 ]);
 if(productResult.error){console.error("Shop product query failed:",productResult.error);root.innerHTML='<p class="checkout-note">We could not load products right now. Please refresh and try again.</p>';return}
 if(categoryResult.error)console.warn("Shop category query failed:",categoryResult.error);
 if(variantResult.error){console.error("Shop variant query failed:",variantResult.error);root.innerHTML='<p class="checkout-note">We could not load product filters right now. Please refresh and try again.</p>';return}
 const categories=new Map((categoryResult.data||[]).map(c=>[c.id,c.name]));
 variants=variantResult.data||[];
 products=(productResult.data||[]).map(p=>({...p,category:categories.get(p.category_id)||"Apna Store"}));
 buildFilterOptions();syncCategoryChip();render();
}
function syncCategoryChip(){const valid=["All","Women","Men","Kids","Footwear"];if(!valid.includes(selected))selected="All";document.querySelectorAll(".chip").forEach(x=>x.classList.toggle("active",x.dataset.cat===selected))}
function matchingVariantIds(){
 const wantedSize=filters.size,wantedColor=filters.color,wantedStock=filters.stock==="in";
 return new Set(variants.filter(v=>(!wantedSize||v.size===wantedSize)&&(!wantedColor||v.color===wantedColor)&&(!wantedStock||Number(v.stock)>0)).map(v=>v.product_id));
}
function render(){
 const min=filters.min===""?null:Number(filters.min),max=filters.max===""?null:Number(filters.max);
 const hasPriceMin=Number.isFinite(min),hasPriceMax=Number.isFinite(max);
 const variantFilterActive=Boolean(filters.size||filters.color||filters.stock==="in");
 const matchingIds=variantFilterActive?matchingVariantIds():null;
 let list=products.filter(p=>{
  const price=Number(p.price);
  return (selected==="All"||p.category===selected)&&(!hasPriceMin||price>=min)&&(!hasPriceMax||price<=max)&&(!matchingIds||matchingIds.has(p.id));
 });
 const s=document.getElementById("sort").value;
 if(s==="low")list.sort((a,b)=>Number(a.price)-Number(b.price));if(s==="high")list.sort((a,b)=>Number(b.price)-Number(a.price));
 const w=readWishlist();
 root.innerHTML=list.length?list.map(p=>{const saved=cloudWishlistIds.has(p.id)||(!cloudWishlistIds.size&&w.some(item=>item.productId===p.id||item.name===p.name));return '<article class="product-card"><div class="product-image"><button class="wishlist-toggle" aria-label="'+(saved?"Remove from wishlist":"Add to wishlist")+'" title="'+(saved?"Remove from wishlist":"Add to wishlist")+'" data-product-id="'+p.id+'">'+(saved?"♥":"♡")+'</button></div><div class="product-info"><a href="product.html?id='+encodeURIComponent(p.id)+'" style="text-decoration:none;color:inherit"><h3>'+escapeHtml(p.name)+'</h3><p>'+escapeHtml(p.category)+'</p><p class="price">₹'+Number(p.price).toLocaleString("en-IN")+'</p></a><button class="primary-btn add" data-view-product-id="'+p.id+'" style="margin-top:12px;padding:10px 13px;font-size:11px;gap:15px">View options →</button></div></article>'}).join(""):'<p>No products match these filters.</p>';
 root.querySelectorAll(".wishlist-toggle").forEach(b=>b.addEventListener("click",()=>wishlist(b.dataset.productId)));
 root.querySelectorAll("[data-view-product-id]").forEach(b=>b.addEventListener("click",()=>location.href="product.html?id="+encodeURIComponent(b.dataset.viewProductId)));
 const resultCount=document.getElementById("filterResultCount");if(resultCount)resultCount.textContent=list.length+" product"+(list.length===1?"":"s");
}
async function wishlist(id){
 const p=products.find(x=>x.id===id);if(!p)return;
 const button=root.querySelector('.wishlist-toggle[data-product-id="'+id+'"]');if(button)button.disabled=true;
 try{
  const {data,error:sessionError}=await apnaSupabase.auth.getSession();if(sessionError)throw sessionError;const session=data?.session;
  if(session){
   const {data:existing,error:readError}=await apnaSupabase.from("wishlists").select("id").eq("user_id",session.user.id).eq("product_id",p.id).maybeSingle();if(readError)throw readError;
   const result=existing?await apnaSupabase.from("wishlists").delete().eq("id",existing.id):await apnaSupabase.from("wishlists").insert({user_id:session.user.id,product_id:p.id});
   if(result.error)throw result.error;
   if(existing)cloudWishlistIds.delete(p.id);else cloudWishlistIds.add(p.id);
   showWishlistMessage(existing?"Removed from your wishlist.":"Saved to your wishlist.");
  }else{
   cloudWishlistIds=new Set();
   const w=readWishlist(),at=w.findIndex(x=>x.productId===p.id||x.name===p.name);if(at>=0){w.splice(at,1);showWishlistMessage("Removed from your wishlist.")}else{w.push({name:p.name,category:p.category,price:Number(p.price),productId:p.id});showWishlistMessage("Saved to your wishlist.")}localStorage.setItem("apnaWishlist",JSON.stringify(w));
  }
  render();
 }catch(error){console.error("Wishlist update failed:",error);showWishlistMessage("Wishlist could not be updated. Please sign in again or refresh.");}
 finally{const current=root.querySelector('.wishlist-toggle[data-product-id="'+id+'"]');if(current)current.disabled=false}
}
function syncUrl(){
 const params=new URLSearchParams(location.search);
 if(selected==="All")params.delete("category");else params.set("category",selected);
 const sort=document.getElementById("sort").value;if(sort==="default")params.delete("sort");else params.set("sort",sort);
 for(const key of ["min","max","size","color"]){if(filters[key])params.set(key,filters[key]);else params.delete(key)}
 if(filters.stock==="in")params.set("stock","in");else params.delete("stock");
 const query=params.toString();history.replaceState({},"",query?"shop.html?"+query:"shop.html")
}
function applyFilters(){filters.min=document.getElementById("minPrice").value.trim();filters.max=document.getElementById("maxPrice").value.trim();filters.size=document.getElementById("sizeFilter").value;filters.color=document.getElementById("colorFilter").value;filters.stock=document.getElementById("stockFilter").value;syncUrl();render()}
function clearFilters(){filters.min=filters.max=filters.size=filters.color="";filters.stock="all";syncFilterControls();syncUrl();render()}
document.getElementById("sort").onchange=()=>{syncUrl();render()};
window.addEventListener("popstate",()=>{const params=new URLSearchParams(location.search);selected=params.get("category")||"All";const sort=params.get("sort")||"default";document.getElementById("sort").value=["default","low","high"].includes(sort)?sort:"default";parseFilters();syncFilterControls();syncCategoryChip();render()});
document.querySelectorAll(".chip").forEach(b=>b.onclick=()=>{selected=b.dataset.cat;syncCategoryChip();syncUrl();render()});
document.getElementById("applyFilters")?.addEventListener("click",applyFilters);
document.getElementById("clearFilters")?.addEventListener("click",clearFilters);
document.getElementById("searchBtn")?.addEventListener("click",()=>location.href="search.html");
const initialSort=new URLSearchParams(location.search).get("sort")||"default";document.getElementById("sort").value=["default","low","high"].includes(initialSort)?initialSort:"default";parseFilters();syncCategoryChip();loadCloudWishlist().then(()=>loadProducts());cart();