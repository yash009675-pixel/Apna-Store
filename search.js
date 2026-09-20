let products=[];
const q=document.getElementById("q"),r=document.getElementById("results"),summary=document.getElementById("summary");
q.value=new URLSearchParams(location.search).get("q")||"";
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function normalize(v){return String(v??"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s-]/g," ").replace(/\s+/g," ").trim()}
function scoreProduct(p,term){
 if(!term)return 0;
 const fields=[[normalize(p.name),12],[normalize(p.category),8],[normalize(p.slug),6],[normalize(p.description),3]];
 let score=0;
 for(const token of term.split(" ").filter(Boolean)){
  let hit=false;
  for(const [value,weight] of fields){
   if(value===token){score+=weight*3;hit=true}
   else if(value.startsWith(token)){score+=weight*2;hit=true}
   else if(value.includes(token)){score+=weight;hit=true}
  }
  if(!hit)return 0;
 }
 const name=normalize(p.name),category=normalize(p.category);
 if(name===term)score+=30;else if(name.startsWith(term))score+=15;
 if(category===term)score+=20;
 return score;
}
async function loadProducts(){
 summary.textContent="Loading products…";
 const [{data,error},{data:categories,error:categoryError}]=await Promise.all([
  apnaSupabase.from("products").select("id,name,slug,description,price,category_id").eq("status","active").order("created_at",{ascending:true}),
  apnaSupabase.from("categories").select("id,name")
 ]);
 if(error||categoryError){console.error("Search product query failed:",error||categoryError);summary.textContent="Products could not be loaded. Please refresh and try again.";r.innerHTML="";return}
 const categoryMap=new Map((categories||[]).map(c=>[c.id,c.name]));
 products=(data||[]).map(p=>({...p,category:categoryMap.get(p.category_id)||"Apna Store"}));
 render();
}
function render(){
 const term=normalize(q.value);
 const list=products.map(p=>({...p,_score:scoreProduct(p,term)})).filter(p=>!term||p._score>0).sort((a,b)=>term?(b._score-a._score||a.name.localeCompare(b.name)):a.name.localeCompare(b.name));
 summary.textContent=term?list.length+" result(s) for “"+q.value.trim()+"”":"Browse all "+list.length+" products";
 r.innerHTML=list.length?list.map(p=>'<article class="product-card"><a href="product.html?id='+encodeURIComponent(p.id)+'" style="text-decoration:none;color:inherit"><div class="product-image"></div><div class="product-info"><h3>'+escapeHtml(p.name)+'</h3><p>'+escapeHtml(p.category)+'</p><p class="price">₹'+Number(p.price).toLocaleString("en-IN")+'</p><span class="primary-btn" style="display:inline-flex;margin-top:12px;padding:10px 13px;font-size:11px;gap:15px">View product →</span></div></a></article>').join(""):'<p>No products found. Try a product name, category, or keyword.</p>';
}
document.getElementById("form").onsubmit=e=>{e.preventDefault();const value=q.value.trim();history.replaceState({},'',value?'?q='+encodeURIComponent(value):'search.html');render()};
q.addEventListener("input",render);
loadProducts();