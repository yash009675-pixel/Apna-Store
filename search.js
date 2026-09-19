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
let products=[];
const q=document.getElementById("q"),r=document.getElementById("results"),summary=document.getElementById("summary");
q.value=new URLSearchParams(location.search).get("q")||"";
async function loadProducts(){
 summary.textContent="Loading products…";
 const {data,error}=await apnaSupabase.from("products").select("id,name,slug,description,price,category_id,categories(name)").eq("status","active").order("created_at",{ascending:true});
 if(error){console.error("Search product query failed:",error);products=fallbackProducts;render();return;}
 products=(data||[]).map(p=>({...p,category:p.categories?.name||"Apna Store"}));
 if(!products.length)products=fallbackProducts;
 render();
}
function render(){
 const term=q.value.trim().toLowerCase();
 const list=products.filter(p=>!term||[p.name,p.category,p.description,p.slug].filter(Boolean).join(" ").toLowerCase().includes(term));
 summary.textContent=term?list.length+" result(s) for “"+q.value.trim()+"”":"Browse all "+list.length+" products";
 r.innerHTML=list.length?list.map(p=>'<article class="product-card"><a href="product.html?id='+encodeURIComponent(p.id)+'" style="text-decoration:none;color:inherit"><div class="product-image"></div><div class="product-info"><h3>'+p.name+'</h3><p>'+p.category+'</p><p class="price">₹'+Number(p.price).toLocaleString("en-IN")+'</p><span class="primary-btn" style="display:inline-flex;margin-top:12px;padding:10px 13px;font-size:11px;gap:15px">View product →</span></div></a></article>').join(""):'<p>No products found. Try another search.</p>';
}
document.getElementById("form").onsubmit=e=>{e.preventDefault();history.replaceState({},'', '?q='+encodeURIComponent(q.value.trim()));render()};
loadProducts();