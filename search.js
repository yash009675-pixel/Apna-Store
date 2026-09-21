let products=[];let brands=[];let sellers=[];let variants=[];
const q=document.getElementById("q"),r=document.getElementById("results"),summary=document.getElementById("summary"),form=document.getElementById("form");
let clearBtn,suggestionsEl,recentEl,popularEl;

function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function normalize(v){return String(v??"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s-]/g," ").replace(/\s+/g," ").trim()}
function tokens(v){return normalize(v).split(" ").filter(Boolean)}
function editDistance(a,b){a=normalize(a);b=normalize(b);if(a===b)return 0;if(!a)return b.length;if(!b)return a.length;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const cur=[i];for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur}return prev[b.length]}
const SYN={tee:["t-shirt","tshirt"],tshirt:["tee","t-shirt"],shirt:["shirts","top"],sneaker:["sneakers","shoes","footwear"],shoe:["shoes","sneaker","footwear"],shoes:["shoe","sneaker","footwear"],dress:["dresses"],dresses:["dress"],kid:["kids"],kids:["kid"],men:["mens"],mens:["men"],women:["womens"],womens:["women"],"co-ord":["coord","co ord"]};

function readHistory(key){try{const v=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(v)?v.filter(Boolean).slice(0,8):[]}catch{return[]}}
function writeHistory(key,arr){try{localStorage.setItem(key,JSON.stringify(arr.slice(0,8)))}catch{}}
function rememberSearch(term){term=term.trim();if(!term)return;const recent=readHistory("apnaRecentSearches").filter(x=>normalize(x)!==normalize(term));recent.unshift(term);writeHistory("apnaRecentSearches",recent);const popular=readHistory("apnaPopularSearches");const counts={};popular.forEach(x=>{const parts=String(x).split("::");counts[parts[0]]=(counts[parts[0]]||0)+Number(parts[1]||1)});counts[term]=(counts[term]||0)+1;writeHistory("apnaPopularSearches",Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(x=>x[0]+"::"+x[1]))}
function popularLabels(){return readHistory("apnaPopularSearches").map(x=>String(x).split("::")[0]).filter(Boolean)}
function setQuery(value){q.value=value;syncUrl();render();updateClearButton();q.focus()}
function updateClearButton(){if(!clearBtn)return;const has=Boolean(q.value.trim());clearBtn.hidden=!has;clearBtn.setAttribute("aria-hidden",String(!has))}
function syncUrl(){const value=q.value.trim();history.replaceState({}, "",value?"search.html?q="+encodeURIComponent(value):"search.html")}

function fieldValues(p){return [p.name,p.category,p.slug,p.description,p.brand,p.seller,...(p.skus||[])].map(normalize).filter(Boolean)}
function scoreProduct(p,term){
 if(!term)return 0;
 const fields=[[normalize(p.name),16],[normalize(p.brand),11],[normalize(p.category),10],[normalize(p.seller),7],[normalize(p.slug),6],[normalize(p.description),3],...((p.skus||[]).map(x=>[normalize(x),12]))];
 let score=0;
 for(const token of tokens(term)){
  const alternatives=[token,...(SYN[token]||[])];let best=0;
  for(const alt of alternatives)for(const [value,weight] of fields){
   if(value===alt)best=Math.max(best,weight*3);else if(value.startsWith(alt))best=Math.max(best,weight*2);else if(value.includes(alt))best=Math.max(best,weight)
  }
  if(!best){
   const fuzzy=fields.reduce((m,[value,weight])=>{if(!value)return m;const d=Math.min(...value.split(/\s+/).map(x=>editDistance(token,x)));return d<=1?Math.max(m,weight*.6):d<=2&&token.length>=5?Math.max(m,weight*.3):m},0);
   if(!fuzzy)return 0;best=fuzzy;
  }
  score+=best;
 }
 const n=normalize(p.name),c=normalize(p.category),b=normalize(p.brand),s=normalize(p.seller);
 if(n===term)score+=40;else if(n.startsWith(term))score+=20;
 if(c===term)score+=24;if(b===term)score+=22;if(s===term)score+=12;
 return score;
}
function allSearchTerms(){
 const set=new Set();
 products.forEach(p=>fieldValues(p).forEach(v=>{if(v.length<=80)set.add(v)}));
 brands.forEach(x=>set.add(normalize(x.name)));sellers.forEach(x=>set.add(normalize(x.name)));
 return [...set].filter(Boolean);
}
function closestSuggestions(term){
 const words=tokens(term),pool=allSearchTerms(),out=[];
 words.forEach(word=>{
  let best=null,bestD=99;
  pool.forEach(value=>value.split(/\s+/).forEach(part=>{const d=editDistance(word,part);if(d<bestD&&d<=2&&part.length>=3){bestD=d;best=part}}));
  if(best&&!out.includes(best))out.push(best);
 });
 return out.slice(0,3);
}
function matchingList(term){
 return products.map(p=>({...p,_score:scoreProduct(p,term)})).filter(p=>!term||p._score>0).sort((a,b)=>term?(b._score-a._score||a.name.localeCompare(b.name)):a.name.localeCompare(b.name));
}
function renderQuickSections(term,list){
 const recent=readHistory("apnaRecentSearches"),popular=popularLabels();
 if(!suggestionsEl){suggestionsEl=document.createElement("div");suggestionsEl.id="searchSuggestions";form.after(suggestionsEl)}
 if(!recentEl){recentEl=document.createElement("div");recentEl.id="recentSearches";suggestionsEl.appendChild(recentEl)}
 if(!popularEl){popularEl=document.createElement("div");popularEl.id="popularSearches";suggestionsEl.appendChild(popularEl)}
 const closest=term&&list.length===0?closestSuggestions(term):[];
 const topSuggestions=term?[...new Set([...closest,...products.filter(p=>scoreProduct(p,term)>0).slice(0,5).map(p=>p.name)])].slice(0,6):[];
 suggestionsEl.innerHTML="";
 if(topSuggestions.length){const box=document.createElement("div");box.className="search-suggestion-box";box.innerHTML='<strong>Suggestions</strong>'+topSuggestions.map(x=>'<button type="button" data-search-suggestion="'+escapeHtml(x)+'">'+escapeHtml(x)+'</button>').join("");suggestionsEl.appendChild(box)}
 if(!term&&recent.length){const box=document.createElement("div");box.className="search-suggestion-box";box.innerHTML='<strong>Recent searches</strong>'+recent.map(x=>'<button type="button" data-search-suggestion="'+escapeHtml(x)+'">'+escapeHtml(x)+'</button>').join("");suggestionsEl.appendChild(box)}
 if(!term&&popular.length){const box=document.createElement("div");box.className="search-suggestion-box";box.innerHTML='<strong>Popular searches</strong>'+popular.slice(0,6).map(x=>'<button type="button" data-search-suggestion="'+escapeHtml(x)+'">'+escapeHtml(x)+'</button>').join("");suggestionsEl.appendChild(box)}
 suggestionsEl.querySelectorAll("[data-search-suggestion]").forEach(b=>b.onclick=()=>setQuery(b.dataset.searchSuggestion));
}
function render(){
 const term=normalize(q.value),list=matchingList(term);
 summary.textContent=term?list.length+" result(s) for “"+q.value.trim()+"”":"Browse all "+list.length+" products";
 r.innerHTML=list.length?list.map(p=>'<article class="product-card"><a href="product.html?id='+encodeURIComponent(p.id)+'" style="text-decoration:none;color:inherit"><div class="product-image"></div><div class="product-info"><h3>'+escapeHtml(p.name)+'</h3><p>'+escapeHtml(p.category)+(p.brand?" • "+escapeHtml(p.brand):"")+'</p><p class="price">₹'+Number(p.price).toLocaleString("en-IN")+'</p><span class="primary-btn" style="display:inline-flex;margin-top:12px;padding:10px 13px;font-size:11px;gap:15px">View product →</span></div></a></article>').join(""):'<div class="search-empty"><h2>No products found</h2><p>Try a different product name, category, brand, seller or SKU.</p>'+(closestSuggestions(term).length?'<div class="empty-suggestions"><strong>Try:</strong>'+closestSuggestions(term).map(x=>'<button type="button" data-search-suggestion="'+escapeHtml(x)+'">'+escapeHtml(x)+'</button>').join("")+'</div>':"")+'</div>';
 r.querySelectorAll("[data-search-suggestion]").forEach(b=>b.onclick=()=>setQuery(b.dataset.searchSuggestion));
 renderQuickSections(term,list);
}

async function loadProducts(){
 summary.textContent="Loading products…";
 const [productResult,categoryResult,brandResult,variantResult,profileResult]=await Promise.all([
  apnaSupabase.from("products").select("id,name,slug,description,price,category_id,brand_id,seller_id").eq("status","active").order("created_at",{ascending:true}),
  apnaSupabase.from("categories").select("id,name").eq("is_active",true),
  apnaSupabase.from("brands").select("id,name,slug").eq("is_active",true).order("sort_order").order("name"),
  apnaSupabase.from("product_variants").select("product_id,sku"),
  apnaSupabase.from("profiles").select("id,full_name,role").eq("role","seller")
 ]);
 if(productResult.error||categoryResult.error||brandResult.error||variantResult.error||profileResult.error){
  console.error("Search data query failed",productResult.error||categoryResult.error||brandResult.error||variantResult.error||profileResult.error);
  summary.textContent="Search could not load right now. Please refresh and try again.";r.innerHTML="";return;
 }
 const cm=new Map((categoryResult.data||[]).map(x=>[x.id,x.name])),bm=new Map((brandResult.data||[]).map(x=>[x.id,x.name])),sm=new Map((profileResult.data||[]).map(x=>[x.id,x.full_name]));
 const skuMap=new Map();(variantResult.data||[]).forEach(v=>{if(!skuMap.has(v.product_id))skuMap.set(v.product_id,[]);if(v.sku)skuMap.get(v.product_id).push(v.sku)});
 brands=brandResult.data||[];sellers=(profileResult.data||[]).map(x=>({id:x.id,name:x.full_name}));
 variants=variantResult.data||[];
 products=(productResult.data||[]).map(p=>({...p,category:cm.get(p.category_id)||"Apna Store",brand:bm.get(p.brand_id)||"",seller:sm.get(p.seller_id)||"",skus:skuMap.get(p.id)||[]}));
 render();
}

form.onsubmit=e=>{e.preventDefault();if(q.value.trim())rememberSearch(q.value);syncUrl();render();updateClearButton()};
q.addEventListener("input",()=>{syncUrl();render();updateClearButton()});
q.addEventListener("keydown",e=>{if(e.key==="Escape"){q.value="";syncUrl();render();updateClearButton()}});
window.addEventListener("popstate",()=>{q.value=new URLSearchParams(location.search).get("q")||"";render();updateClearButton()});
clearBtn=document.createElement("button");clearBtn.type="button";clearBtn.className="secondary-btn";clearBtn.textContent="Clear";clearBtn.addEventListener("click",()=>{q.value="";syncUrl();render();updateClearButton();q.focus()});clearBtn.hidden=!q.value.trim();form.appendChild(clearBtn);updateClearButton();
loadProducts();