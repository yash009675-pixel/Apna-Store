let products=[];let categories=[];let brands=[];let variants=[];
const q=document.getElementById("q"),r=document.getElementById("results"),summary=document.getElementById("summary"),form=document.getElementById("form");
const categorySelect=document.getElementById("searchCategory"),brandSelect=document.getElementById("searchBrand"),sortSelect=document.getElementById("searchSort"),resetFiltersBtn=document.getElementById("resetSearchFilters"),imageNotice=document.getElementById("searchImageNotice");
const SORT_OPTIONS=new Set(["relevance","newest","price-asc","price-desc"]);
function validSort(value){return SORT_OPTIONS.has(value)?value:"relevance"}
const initialSearchParams=new URLSearchParams(location.search);
let searchState={query:initialSearchParams.get("q")||"",category:initialSearchParams.get("category")||"",brand:initialSearchParams.get("brand")||"",sort:validSort(initialSearchParams.get("sort"))};
q.value=searchState.query;if(sortSelect)sortSelect.value=searchState.sort;
let catalogReady=false,searchDataLoaded=false,imageLookupFailed=false;
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
function setQuery(value){q.value=value;searchState.query=value;syncUrl();render();updateClearButton();q.focus()}
function findCatalogRecord(value,rows,fields){const text=String(value??"").trim();if(!text)return null;const folded=normalize(text);return rows.find(row=>String(row.id||"")===text||fields.some(field=>{const candidate=String(row[field]||"");return candidate.toLowerCase()===text.toLowerCase()||normalize(candidate)===folded}))||null}
function resolveCategoryId(value){return String(findCatalogRecord(value,categories,["name"])?.id||"")}
function resolveBrandId(value){return String(findCatalogRecord(value,brands,["name","slug"])?.id||"")}
function updateRefinementControls(){if(catalogReady){searchState.category=resolveCategoryId(searchState.category);searchState.brand=resolveBrandId(searchState.brand)}if(categorySelect)categorySelect.value=searchState.category;if(brandSelect)brandSelect.value=searchState.brand;if(sortSelect)sortSelect.value=searchState.sort}
function updateClearButton(){if(!clearBtn)return;const has=Boolean(q.value.trim()||searchState.category||searchState.brand||searchState.sort!=="relevance");clearBtn.hidden=!has;clearBtn.setAttribute("aria-hidden",String(!has))}
function syncUrl(){const url=new URL(location.href),params=url.searchParams,value=q.value.trim();searchState.query=value;if(value)params.set("q",value);else params.delete("q");let categoryParam=searchState.category,brandParam=searchState.brand;if(catalogReady){const category=categories.find(item=>String(item.id)===String(searchState.category)),brand=brands.find(item=>String(item.id)===String(searchState.brand));categoryParam=category?.name||"";brandParam=brand?.slug||brand?.name||""}if(categoryParam)params.set("category",categoryParam);else params.delete("category");if(brandParam)params.set("brand",brandParam);else params.delete("brand");if(searchState.sort!=="relevance")params.set("sort",searchState.sort);else params.delete("sort");history.replaceState(history.state,"",url.pathname+(params.toString()?"?"+params.toString():"")+url.hash)}
function hydrateFromUrl(params=new URLSearchParams(location.search)){searchState.query=params.get("q")||"";q.value=searchState.query;const category=params.get("category")||"",brand=params.get("brand")||"";searchState.category=catalogReady?resolveCategoryId(category):category;searchState.brand=catalogReady?resolveBrandId(brand):brand;searchState.sort=validSort(params.get("sort"));updateRefinementControls();updateClearButton()}
function setImageNotice(){if(!imageNotice)return;imageNotice.textContent=imageLookupFailed?"Product images could not be loaded right now.":"";imageNotice.hidden=!imageLookupFailed}

function fieldValues(p){return [p.name,p.category,p.slug,p.description,p.brand,...(p.skus||[])].map(normalize).filter(Boolean)}
function scoreProduct(p,term){
 if(!term)return 0;
 const fields=[[normalize(p.name),16],[normalize(p.brand),11],[normalize(p.category),10],[normalize(p.slug),6],[normalize(p.description),3],...((p.skus||[]).map(x=>[normalize(x),12]))];
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
 const n=normalize(p.name),c=normalize(p.category),b=normalize(p.brand);
 if(n===term)score+=40;else if(n.startsWith(term))score+=20;
 if(c===term)score+=24;if(b===term)score+=22;
 return score;
}
function allSearchTerms(){
 const set=new Set();
 products.forEach(p=>fieldValues(p).forEach(v=>{if(v.length<=80)set.add(v)}));
 brands.forEach(x=>set.add(normalize(x.name)));
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
 const list=products.map(p=>({...p,_score:scoreProduct(p,term)})).filter(p=>(!term||p._score>0)&&(!searchState.category||String(p.category_id||"")===String(searchState.category))&&(!searchState.brand||String(p.brand_id||"")===String(searchState.brand)));
 const byName=(a,b)=>String(a.name||"").localeCompare(String(b.name||""));
 return list.sort((a,b)=>{
  if(searchState.sort==="newest"){const dateB=Date.parse(b.created_at||"")||0,dateA=Date.parse(a.created_at||"")||0;return dateB-dateA||byName(a,b)}
  if(searchState.sort==="price-asc")return Number(a.price||0)-Number(b.price||0)||byName(a,b);
  if(searchState.sort==="price-desc")return Number(b.price||0)-Number(a.price||0)||byName(a,b);
  return (term?b._score-a._score:0)||byName(a,b);
 });
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
 if(!searchDataLoaded)return;
 const term=normalize(q.value),list=matchingList(term),category=categories.find(item=>String(item.id)===String(searchState.category)),brand=brands.find(item=>String(item.id)===String(searchState.brand));
 const refinements=[category?.name,brand?.name,searchState.sort==="newest"?"Newest":searchState.sort==="price-asc"?"Price: low to high":searchState.sort==="price-desc"?"Price: high to low":""].filter(Boolean);
 const refinementSummary=refinements.length?" · "+refinements.join(" · "):"";
 summary.textContent=term?list.length+" result(s) for “"+q.value.trim()+"”"+refinementSummary:"Browse all "+list.length+" products"+refinementSummary;
 const emptySuggestions=term?closestSuggestions(term):[];
 const emptyCopy=term?"Try a different product name, category, brand, or SKU.":"Try changing or resetting the selected category or brand.";
 r.innerHTML=list.length?list.map(p=>{const meta=[p.category,p.brand].filter(Boolean).join(" • "),image=p.image?.url?'<img src="'+escapeHtml(p.image.url)+'" alt="'+escapeHtml(p.image.alt||p.name)+'" loading="lazy" decoding="async">':"";return '<article class="product-card"><a href="product.html?id='+encodeURIComponent(p.id)+'" style="text-decoration:none;color:inherit"><div class="product-image">'+image+'</div><div class="product-info"><h3>'+escapeHtml(p.name)+'</h3><p>'+escapeHtml(meta)+'</p><p class="price">₹'+Number(p.price).toLocaleString("en-IN")+'</p><span class="primary-btn" style="display:inline-flex;margin-top:12px;padding:10px 13px;font-size:11px;gap:15px">View product →</span></div></a></article>'}).join(""):'<div class="search-empty"><h2>No products found</h2><p>'+escapeHtml(emptyCopy)+'</p>'+(emptySuggestions.length?'<div class="empty-suggestions"><strong>Try:</strong>'+emptySuggestions.map(x=>'<button type="button" data-search-suggestion="'+escapeHtml(x)+'">'+escapeHtml(x)+'</button>').join("")+'</div>':"")+'</div>';
 r.querySelectorAll("[data-search-suggestion]").forEach(b=>b.onclick=()=>setQuery(b.dataset.searchSuggestion));
 renderQuickSections(term,list);
}

function publicProductImageUrl(storagePath){if(typeof storagePath!=="string"||!storagePath.trim()||!window.apnaSupabase?.storage)return"";try{const result=window.apnaSupabase.storage.from("product-images").getPublicUrl(storagePath.trim()),raw=result?.data?.publicUrl;if(!raw)return"";const url=new URL(raw,location.origin);return url.protocol==="https:"||url.protocol==="http:"?url.href:""}catch{return""}}
function buildProductImageMap(rows){const primary=row=>row.is_primary===true||row.is_primary==="true"||row.is_primary===1;const ordered=[...(rows||[])].sort((a,b)=>Number(primary(b))-Number(primary(a))||Number(a.sort_order||0)-Number(b.sort_order||0)||(Date.parse(a.created_at||"")||0)-(Date.parse(b.created_at||"")||0));const map=new Map();ordered.forEach(row=>{if(map.has(String(row.product_id)))return;const url=publicProductImageUrl(row.storage_path);if(url)map.set(String(row.product_id),{url,alt:String(row.alt_text||"")})});return map}
function populateRefinementOptions(){if(categorySelect)categorySelect.innerHTML='<option value="">All categories</option>'+categories.filter(item=>item?.id&&item?.name).map(item=>'<option value="'+escapeHtml(item.id)+'">'+escapeHtml(item.name)+'</option>').join("");if(brandSelect)brandSelect.innerHTML='<option value="">All brands</option>'+brands.filter(item=>item?.id&&item?.name).map(item=>'<option value="'+escapeHtml(item.id)+'">'+escapeHtml(item.name)+'</option>').join("");updateRefinementControls()}
async function loadProducts(){
 summary.textContent="Loading products…";
 const [productResult,categoryResult,brandResult,variantResult]=await Promise.all([
  apnaSupabase.from("products").select("id,name,slug,description,price,category_id,brand_id,created_at").eq("status","active").order("created_at",{ascending:true}),
  apnaSupabase.from("categories").select("id,name,sort_order").eq("is_active",true).order("sort_order").order("name"),
  apnaSupabase.from("brands").select("id,name,slug").eq("is_active",true).order("sort_order").order("name"),
  apnaSupabase.from("product_variants").select("product_id,sku")
 ]);
 if(productResult.error||categoryResult.error||brandResult.error||variantResult.error){
  console.error("Search data query failed",productResult.error||categoryResult.error||brandResult.error||variantResult.error);
  summary.textContent="Search could not load right now. Please refresh and try again.";r.innerHTML="";return;
 }
 const productRows=productResult.data||[],productIds=productRows.map(item=>item.id).filter(Boolean);
 const imageResult=productIds.length?await apnaSupabase.from("product_images").select("product_id,storage_path,alt_text,sort_order,is_primary,created_at").in("product_id",productIds).order("is_primary",{ascending:false}).order("sort_order",{ascending:true}).order("created_at",{ascending:true}):{data:[],error:null};
 imageLookupFailed=Boolean(imageResult.error);
 if(imageLookupFailed)console.warn("Search product image query failed:",imageResult.error);
 const categoryMap=new Map((categoryResult.data||[]).map(item=>[String(item.id),item.name])),brandMap=new Map((brandResult.data||[]).map(item=>[String(item.id),item.name]));
 const skuMap=new Map();(variantResult.data||[]).forEach(variant=>{if(!skuMap.has(variant.product_id))skuMap.set(variant.product_id,[]);if(variant.sku)skuMap.get(variant.product_id).push(variant.sku)});
 categories=categoryResult.data||[];brands=brandResult.data||[];variants=variantResult.data||[];
 const imageMap=buildProductImageMap(imageResult.data||[]);
 products=productRows.map(product=>({...product,category:categoryMap.get(String(product.category_id))||"",brand:brandMap.get(String(product.brand_id))||"",skus:skuMap.get(product.id)||[],image:imageMap.get(String(product.id))||null}));
 catalogReady=true;populateRefinementOptions();hydrateFromUrl(new URLSearchParams(location.search));syncUrl();searchDataLoaded=true;setImageNotice();render();updateClearButton();
}

function clearSearchState(){q.value="";searchState.query="";searchState.category="";searchState.brand="";searchState.sort="relevance";updateRefinementControls();syncUrl();render();updateClearButton();q.focus()}
function resetRefinements(){searchState.category="";searchState.brand="";searchState.sort="relevance";updateRefinementControls();syncUrl();render();updateClearButton()}
form.onsubmit=e=>{e.preventDefault();const term=q.value.trim();if(term){const list=matchingList(normalize(term));if(window.apnaTrackSearch)apnaTrackSearch(term,list.length,list.slice(0,20).map(x=>x.id));rememberSearch(term)}syncUrl();render();updateClearButton()};
q.addEventListener("input",()=>{searchState.query=q.value;syncUrl();render();updateClearButton()});
q.addEventListener("keydown",e=>{if(e.key==="Escape"){e.preventDefault();clearSearchState()}});
if(categorySelect)categorySelect.addEventListener("change",()=>{searchState.category=categorySelect.value;syncUrl();render();updateClearButton()});
if(brandSelect)brandSelect.addEventListener("change",()=>{searchState.brand=brandSelect.value;syncUrl();render();updateClearButton()});
if(sortSelect)sortSelect.addEventListener("change",()=>{searchState.sort=validSort(sortSelect.value);sortSelect.value=searchState.sort;syncUrl();render();updateClearButton()});
if(resetFiltersBtn)resetFiltersBtn.addEventListener("click",resetRefinements);
window.addEventListener("popstate",()=>{hydrateFromUrl(new URLSearchParams(location.search));if(catalogReady)syncUrl();render();updateClearButton()});
clearBtn=document.createElement("button");clearBtn.type="button";clearBtn.className="secondary-btn";clearBtn.textContent="Clear";clearBtn.setAttribute("aria-label","Clear search and refinements");clearBtn.addEventListener("click",clearSearchState);clearBtn.hidden=!q.value.trim();form.appendChild(clearBtn);updateClearButton();
loadProducts();