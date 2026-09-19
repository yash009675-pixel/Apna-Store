const products=[
{name:"Relaxed Everyday Tee",category:"Women",price:599},
{name:"Essential Overshirt",category:"Men",price:1299},
{name:"Soft Knit Co-ord",category:"Women",price:999},
{name:"Classic Daily Shirt",category:"Men",price:799},
{name:"Everyday Cargo",category:"Men",price:1199},
{name:"Easy Cotton Dress",category:"Women",price:899},
{name:"Mini Weekend Set",category:"Kids",price:699},
{name:"Daily Court Sneaker",category:"Footwear",price:1499}
];
const grid=document.getElementById("wishlistGrid");
function money(n){return "₹"+Number(n||0).toLocaleString("en-IN")}
function readWishlist(){try{const w=JSON.parse(localStorage.getItem("apnaWishlist")||"[]");return Array.isArray(w)?w:[]}catch{return[]}}
function render(){
  const saved=readWishlist();
  grid.innerHTML=saved.length?saved.map(item=>{
    const i=Number.isInteger(Number(item.productId))?Number(item.productId):products.findIndex(p=>p.name===item.name);
    const p=products[i]||item;
    return '<article class="product-card"><a href="product.html?id='+i+'"><div class="product-image wishlist-image"><span>'+p.name+'</span></div></a><div class="product-info"><h3>'+p.name+'</h3><p>'+p.category+'</p><p class="price">'+money(p.price)+'</p><button class="text-btn" data-remove="'+i+'">Remove from wishlist</button></div></article>';
  }).join(""):'<div class="empty-cart"><h2>Your wishlist is empty.</h2><p>Save pieces you love and find them here later.</p><a class="primary-btn" href="shop.html">Explore products →</a></div>';
  grid.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{
    const i=Number(b.dataset.remove),w=readWishlist().filter(x=>Number(x.productId)!==i&&x.name!==products[i]?.name);
    localStorage.setItem("apnaWishlist",JSON.stringify(w));render();
  });
}
render();