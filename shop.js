const products=[
["Relaxed Everyday Tee","Women",599],
["Essential Overshirt","Men",1299],
["Soft Knit Co-ord","Women",999],
["Classic Daily Shirt","Men",799],
["Everyday Cargo","Men",1199],
["Easy Cotton Dress","Women",899],
["Mini Weekend Set","Kids",699],
["Daily Court Sneaker","Footwear",1499]
];
let selected="All";
const root=document.getElementById("shopProducts"),count=document.getElementById("cartCount");

function readCart(){try{const c=JSON.parse(localStorage.getItem("apnaCart")||"[]");return Array.isArray(c)?c:[]}catch{return[]}}
function cart(){const c=readCart();if(count)count.textContent=c.reduce((n,x)=>n+(Number(x.qty)||0),0)}
function readWishlist(){try{const w=JSON.parse(localStorage.getItem("apnaWishlist")||"[]");return Array.isArray(w)?w:[]}catch{return[]}}

function render(){
  let list=products.map((p,i)=>({p,i})).filter(x=>selected==="All"||x.p[1]===selected);
  const s=document.getElementById("sort").value;
  if(s==="low")list.sort((a,b)=>a.p[2]-b.p[2]);
  if(s==="high")list.sort((a,b)=>b.p[2]-a.p[2]);
  const w=readWishlist();
  root.innerHTML=list.map(x=>{
    const p=x.p, saved=w.some(item=>item.name===p[0]);
    return '<article class="product-card"><div class="product-image"><button aria-label="'+(saved?"Remove from wishlist":"Add to wishlist")+'" onclick="wishlist('+x.i+')">'+(saved?"♥":"♡")+'</button></div><div class="product-info"><a href="product.html?id='+x.i+'" style="text-decoration:none;color:inherit"><h3>'+p[0]+'</h3><p>'+p[1]+'</p><p class="price">₹'+p[2].toLocaleString("en-IN")+'</p></a><button class="primary-btn add" onclick="add('+x.i+')" style="margin-top:12px;padding:10px 13px;font-size:11px;gap:15px">Add to bag →</button></div></article>';
  }).join("");
}
function add(i){
  const c=readCart(),p=products[i],e=c.find(x=>x.name===p[0]);
  e?e.qty++:c.push({name:p[0],category:p[1],price:p[2],qty:1});
  localStorage.setItem("apnaCart",JSON.stringify(c));cart();
}
function wishlist(i){
  const p=products[i],w=readWishlist(),at=w.findIndex(x=>x.name===p[0]);
  if(at>=0)w.splice(at,1);else w.push({name:p[0],category:p[1],price:p[2],productId:i});
  localStorage.setItem("apnaWishlist",JSON.stringify(w));render();
}
document.querySelectorAll(".chip").forEach(b=>b.onclick=()=>{document.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));b.classList.add("active");selected=b.dataset.cat;render()});
document.getElementById("sort").onchange=render;
render();cart();