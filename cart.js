const box=document.getElementById("cart");

function readCart(){
  try{
    const raw=localStorage.getItem("apnaCart");
    const data=raw?JSON.parse(raw):[];
    if(!Array.isArray(data)) return [];
    return data.filter(x=>x&&x.name).map(x=>({...x,price:Number(x.price)||0,qty:Math.max(1,Number(x.qty)||1)}));
  }catch(e){
    console.error("Apna Store cart read error:",e);
    return [];
  }
}
function saveCart(c){localStorage.setItem("apnaCart",JSON.stringify(c));}
function money(n){return "₹"+Number(n||0).toLocaleString("en-IN");}

function draw(){
  if(!box) return;
  const c=readCart();
  if(!c.length){
    box.innerHTML='<div class="empty-cart">Your bag is empty. <a href="shop.html">Start shopping →</a></div>';
    return;
  }
  const subtotal=c.reduce((s,x)=>s+(x.price*x.qty),0);
  const shipping=subtotal>=999?0:49;
  const total=subtotal+shipping;
  box.innerHTML='<div class="cart-layout"><div class="cart-items">'+
    c.map((x,i)=>'<article class="cart-item"><div class="cart-thumb"><span>'+x.name+'</span></div><div class="cart-product"><h3>'+x.name+'</h3><p>'+(x.category||"Apna Store")+'</p><p>'+[x.size,x.color].filter(Boolean).join(" · ")+'</p><b>'+money(x.price)+'</b><div class="cart-controls"><button onclick="change('+i+',-1)">−</button><span>'+x.qty+'</span><button onclick="change('+i+',1)">+</button><button class="remove-btn" onclick="removeItem('+i+')">Remove</button></div></div></article>').join("")+
    '</div><aside class="cart-summary"><p class="eyebrow">SUMMARY</p><div><span>Subtotal</span><b>'+money(subtotal)+'</b></div><div><span>Delivery</span><b>'+(shipping?money(shipping):"FREE")+'</b></div><small>Free delivery on orders over ₹999.</small><div class="summary-total"><span>Total</span><b>'+money(total)+'</b></div><a class="primary-btn" href="checkout.html">Proceed to checkout →</a></aside></div>';
}

function change(i,d){
  const c=readCart();
  if(!c[i]) return;
  c[i].qty+=d;
  if(c[i].qty<=0)c.splice(i,1);
  saveCart(c);draw();
}
function removeItem(i){
  const c=readCart();
  c.splice(i,1);
  saveCart(c);draw();
}
draw();