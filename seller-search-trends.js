const $=id=>document.getElementById(id);
const num=v=>Number(v||0).toLocaleString("en-IN");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let days=30;
function iso(d){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function setDates(n){days=n;const end=new Date();const start=new Date();start.setDate(start.getDate()-n+1);$("fromDate").value=iso(start);$("toDate").value=iso(end)}
function table(rows,cols,empty){if(!rows?.length)return '<div class="trend-empty">'+empty+'</div>';return '<div style="overflow:auto"><table class="trend-table"><thead><tr>'+cols.map(c=>'<th>'+c[0]+'</th>').join("")+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+cols.map(c=>'<td>'+c[1](r)+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>'}
async function load(){
 const {data:s,error:se}=await apnaSupabase.auth.getSession();if(se||!s.session){location.href="auth.html";return}
 const {data:p,error:pe}=await apnaSupabase.from("profiles").select("role").eq("id",s.session.user.id).single();if(pe||!p||![ "seller","admin" ].includes(p.role)){location.href="account.html";return}
 const from=$("fromDate").value,to=$("toDate").value;
 const start=new Date((from||iso(new Date(Date.now()-days*86400000)))+"T00:00:00");
 const end=new Date((to||iso(new Date()))+"T00:00:00");end.setDate(end.getDate()+1);
 if(end<=start){$("status").textContent="Please choose a valid date range.";return}
 $("status").textContent="Loading real search activity…";
 const {data,error}=await apnaSupabase.rpc("seller_search_trends",{p_start_at:start.toISOString(),p_end_at:end.toISOString()});
 if(error){console.error(error);$("status").textContent=error.message||"Could not load search trends.";return}
 const d=data||{};
 $("popular").innerHTML=table(d.popular_searches,[["Search",x=>'<strong>'+esc(x.term)+'</strong>'],["Searches",x=>num(x.searches)],["Visitors",x=>num(x.visitors)]],"No recorded searches yet.");
 $("rising").innerHTML=table(d.rising_searches,[["Search",x=>'<strong>'+esc(x.term)+'</strong>'],["Current",x=>num(x.searches)],["Previous",x=>num(x.previous_searches)],["Change",x=>'<span class="trend-rise">↑ '+Number(x.change_percent||0).toFixed(1)+'%</span>']],"No rising searches recorded yet.");
 $("zero").innerHTML=table(d.zero_result_searches,[["Search",x=>'<strong>'+esc(x.term)+'</strong>'],["Searches",x=>num(x.searches)],["Visitors",x=>num(x.visitors)],["Status",()=>'<span class="trend-zero">0 results</span>']],"No zero-result searches recorded.");
 $("categories").innerHTML=table(d.category_demand,[["Category",x=>esc(x.category_name)],["Demand",x=>num(x.searches)]],"No matched category demand recorded.");
 $("products").innerHTML=table(d.product_demand,[["Product",x=>'<strong>'+esc(x.product_name)+'</strong>'],["Search demand",x=>num(x.searches)]],"No seller-product search demand recorded.");
 $("keywords").innerHTML=table(d.keyword_trends,[["Keyword",x=>esc(x.term)],["Current",x=>num(x.current_searches)],["Previous",x=>num(x.previous_searches)],["Δ",x=>x.delta>0?'<span class="trend-rise">+'+num(x.delta)+'</span>':num(x.delta)]],"No keyword trend data recorded.");
 $("status"]="Showing real submitted search activity from "+new Date(d.range.start_at).toLocaleDateString("en-IN")+" to "+new Date(d.range.end_at).toLocaleDateString("en-IN")+".";
}
document.querySelectorAll(".preset").forEach(b=>b.onclick=()=>{document.querySelectorAll(".preset").forEach(x=>x.classList.remove("active"));b.classList.add("active");setDates(Number(b.dataset.days));load()});
$("apply").onclick=load;setDates(30);load();