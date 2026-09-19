const fallbackProducts=[
{id:"e58b74fe-d5c4-4f9c-8650-723e4ab75e53",name:"Relaxed Everyday Tee",category:"Women",price:599,description:"Everyday comfort."},
{id:"0faccd51-ad4a-4812-a78c-051346b41141",name:"Essential Overshirt",category:"Men",price:1299,description:"Easy everyday layer."},
{id:"2a8c646d-2504-482d-a3e9-facd4df96ed7",name:"Soft Knit Co-ord",category:"Women",price:999,description:"Soft knit set."},
{id:"7d074207-c476-47ee-9a79-3210be85724a",name:"Classic Daily Shirt",category:"Men",price:799,description:"Clean everyday shirt."},
{id:"a9ecfb24-0c10-48a9-8733-a6a1bcbe2da4",name:"Everyday Cargo",category:"Men",price:1199,description:"Relaxed utility cargo."},
{id:"a918ec4e-eafb-4133-884f-716401657876",name:"Easy Cotton Dress",category:"Women",price:899,description:"Light cotton dress."},
{id:"cf4547e1-b242-4c9c-9dd3-f65ec851bfb6",name:"Mini Weekend Set",category:"Kids",price:699,description:"Comfortable kids set."},
{id:"3cb85e55-1880-4c2d-933d-d93b3558d9c3",name:"Daily Court Sneaker",category:"Footwear",price:1499,description:"Everyday court sneaker."}
];
let products=[];let selected=new URLSearchParams(location.search).get("category")||"All";
const root=document.getElementById("shopProducts"),count=document.getElementById("cartCount");
function readCart(){try{const c=JSON.parse(localStorage.getItem("apnaCart")||"[]");return Array.isArray(c)?c:[]}catch{return[]}}
function cart(){if(count)count.textContent=readCart().reduce((n,x)=>n+(Number(x.qty)||0),0)}
function readWishlist(){try{const w=JSON.parse(localStorage.getItem("apnaWishlist")||"[]");return Array.isArray(w)?w:[]}catch{return[]}}
async function loadProducts(){
 root.innerHTML='<p class="checkout-note">Loading Apna products…</p>';
 const {data,error}=await apnaSupabase.from("products").select("id,name,slug,description,price,category_id").eq("status","active").order("created_at",{ascending:true});
 if(error){
  console.error("Shop product query failed:",error);
  products=fallbackProducts;
  syncCategoryChip();
  render();
  return;
 }
 const categoryNames={"678e7007-3084-4a96-a465-bf196e923837":"Footwear","94223447-f3b5-46c9-9349-55f9b4aa44d1":"Kids","93428b48-e9ce-464a-bae5-093db1aafa2e":"Men","9e6636b6-fa6f-492c-a25b-9089dff87863":"Women"};
 products=(data||[]).map(p=>({...p,category:categoryNames[p.category_id]||"Apna Store"}));
 if(!products.length) products=fallbackProducts;
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
  return '<article class="product-card"><div class="product-image"><button aria-label="'+(saved?"Remove from wishlist":"Add to wishlist")+'" onclick="wishlist(\''+p.id+'\')">'+(saved?"♥":"♡")+'</button></div><div class="product-info"><a href="product.html?id='+encodeURIComponent(p.id)+'" style="text-decoration:none;color:inherit"><h3>'+p.name+'</h3><p>'+p.category+'</p><p class="price">₹'+Number(p.price).toLocaleString("en-IN")+'</p></a><button class="primary-btn add" onclick="add(\''+p.id+'\')" style="margin-top:12px;padding:10px 13px;font-size:11px;gap:15px">View options →</button></div></article>';
 }).join(""):'<p>No products found.</p>';
}
function add(id){const p=products.find(x=>x.id===id);if(!p)return;location.href="product.html?id="+encodeURIComponent(p.id)}
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