let products=[];let selected=new URLSearchParams(location.search).get("category")||"All";
const root=document.getElementById("shopProducts"),count=document.getElementById("cartCount");
function readCart(){try{const c=JSON.parse(localStorage.getItem("apnaCart")||"[]");return Array.isArray(c)?c:[]}catch{return[]}}
function cart(){if(count)count.textContent=readCart().reduce((n,x)=>n+(Number(x.qty)||0),0)}
function readWishlist(){try{const w=JSON.parse(localStorage.getItem("apnaWishlist")||"[]");return Array.isArray(w)?w:[]}catch{return[]}}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function loadProducts(){
 root.innerHTML='<p class="checkout-note">Loading Apna products…</p>';
 const {data,error}=await apnaSupabase.from("products").select("id,name,slug,description,price,category_id,categories(name)").eq("status","active").order("created_at",{ascending:true});
 if(error){
  console.error("Shop product query failed:",error);
  root.innerHTML='<p class="checkout-note">We could not load products right now. Please refresh and try again.</p>';
  return;
 }
 products=(data||[]).map(p=>({...p,category:p.categories?.name||"Apna Store"}));
 syncCategoryChip();
 render();
}
function syncCategoryChip(){
 const valid=["All","Women","Men","Kids","Footwear"];
 if(!valid.includes(selected))selected="All";
 document.querySelectorAll(".chip").forEach(x=>x.classList.toggle("active",x.dataset.cat===selected));
}
function render(){
 let list=products.filter(p=>selected==="All"||p.category===selected);
 const s=document.getElementById("sort").value;
 if(s==="low")list.sort((a,b)=>Number(a.price)-Number(b.price));
 if(s==="high")list.sort((a,b)=>Number(b.price)-Number(a.price));
 const w=readWishlist();
 root.innerHTML=list.length?list.map(p=>{
  const saved=w.some(item=>item.productId===p.id||item.name===p.name);
  return '<article class="product-card"><div class="product-image"><button aria-label="'+(saved?"Remove from wishlist":"Add to wishlist")+'" onclick="wishlist(\''+p.id+'\')">'+(saved?"♥":"♡")+'</button></div><div class="product-info"><a href="product.html?id='+encodeURIComponent(p.id)+'" style="text-decoration:none;color:inherit"><h3>'+escapeHtml(p.name)+'</h3><p>'+escapeHtml(p.category)+'</p><p class="price">₹'+Number(p.price).toLocaleString("en-IN")+'</p></a><button class="primary-btn add" onclick="add(\''+p.id+'\')" style="margin-top:12px;padding:10px 13px;font-size:11px;gap:15px">View options →</button></div></article>';
 }).join(""):'<p>No products found.</p>';
}
function add(id){if(products.some(x=>x.id===id))location.href="product.html?id="+encodeURIComponent(id)}
async function wishlist(id){
 const p=products.find(x=>x.id===id);if(!p)return;
 const {data:{session}}=await apnaSupabase.auth.getSession();
 if(session){
  const {data:existing,error:readError}=await apnaSupabase.from("wishlists").select("id").eq("user_id",session.user.id).eq("product_id",p.id).maybeSingle();
  if(readError){console.error(readError);return}
  const result=existing
   ? await apnaSupabase.from("wishlists").delete().eq("id",existing.id)
   : await apnaSupabase.from("wishlists").insert({user_id:session.user.id,product_id:p.id});
  if(result.error){console.error("Wishlist update failed:",result.error);return}
 }else{
  const w=readWishlist(),at=w.findIndex(x=>x.productId===p.id||x.name===p.name);
  if(at>=0)w.splice(at,1);else w.push({name:p.name,category:p.category,price:Number(p.price),productId:p.id});
  localStorage.setItem("apnaWishlist",JSON.stringify(w));
 }
 render();
}
document.querySelectorAll(".chip").forEach(b=>b.onclick=()=>{document.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));b.classList.add("active");selected=b.dataset.cat;history.replaceState(null,"",selected==="All"?"shop.html":"shop.html?category="+encodeURIComponent(selected));render()});
document.getElementById("sort").onchange=render;
document.getElementById("searchBtn")?.addEventListener("click",()=>location.href="search.html");
loadProducts();cart();