const $=id=>document.getElementById(id);
const money=v=>"₹"+Number(v||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const num=v=>Number(v||0).toLocaleString("en-IN");
const pct=v=>Number(v||0).toFixed(2)+"%";
let state={days:30};
function isoDate(d){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function change(cur,prev){const a=Number(cur||0),b=Number(prev||0);if(b===0)return a===0?0:null;return ((a-b)/Math.abs(b))*100}
function changeHtml(v){if(v===null)return '<span class="growth-change">No prior-period baseline</span>';const cls=v>0?"up":v<0?"down":"";return '<span class="growth-change '+cls+'">'+(v>0?"↑ ":v<0?"↓ ":"")+Math.abs(v).toFixed(1)+'% vs previous period</span>'}
function dateRange(){
 const end=new Date();end.setHours(0,0,0,0);end.setDate(end.getDate()+1);
 const start=new Date(end);start.setDate(start.getDate()-state.days);
 return {start,end};
}
function renderMetrics(cur,prev){
 const cards=[
  ["Sales / Revenue",money(cur.revenue),change(cur.revenue,prev.revenue)],
  ["Orders",num(cur.orders),change(cur.orders,prev.orders)],
  ["Units sold",num(cur.units),change(cur.units,prev.units)],
  ["Visitors",num(cur.visitors),change(cur.visitors,prev.visitors)],
  ["Product views",num(cur.views),change(cur.views,prev.views)],
  ["Conversion",pct(cur.conversion_rate),change(cur.conversion_rate,prev.conversion_rate)],
  ["Avg. order value",money(cur.average_order_value),change(cur.average_order_value,prev.average_order_value)],
  ["Active products",null,null]
 ];
 $("metrics").innerHTML=cards.map(x=>'<div class="growth-card"><span>'+x[0]+'</span><strong>'+String(x[1]??"—")+'</strong>'+(x[2]!==undefined?changeHtml(x[2]):"")+'</div>').join("");
}
function svgChart(series){
 const svg=$("trendChart"),W=900,H=260,p=28;
 if(!series?.length){svg.innerHTML='<text x="50%" y="50%" text-anchor="middle" fill="currentColor">No recorded activity in this period.</text>';return}
 const maxRev=Math.max(1,...series.map(x=>Number(x.revenue||0))),maxOrd=Math.max(1,...series.map(x=>Number(x.orders||0))),maxVis=Math.max(1,...series.map(x=>Number(x.visitors||0)));
 const x=i=>p+(i*(W-p*2))/Math.max(1,series.length-1),y=v=>H-p-(v*(H-p*2))/Math.max(1,maxOrd),yv=v=>H-p-(v*(H-p*2))/maxVis;
 const bars=series.map((d,i)=>{const bw=Math.max(2,(W-p*2)/series.length*.72),h=(Number(d.revenue||0)/maxRev)*(H-p*2);return '<rect x="'+(x(i)-bw/2).toFixed(1)+'" y="'+(H-p-h).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+h.toFixed(1)+'" rx="2" fill="currentColor" opacity=".12"><title>'+escapeHtml(new Date(d.bucket).toLocaleString("en-IN"))+': '+money(d.revenue)+'</title></rect>'}).join("");
 const orderPath=series.map((d,i)=>(i?"L":"M")+x(i).toFixed(1)+" "+y(Number(d.orders||0)).toFixed(1)).join(" ");
 const visPath=series.map((d,i)=>(i?"L":"M")+x(i).toFixed(1)+" "+yv(Number(d.visitors||0)).toFixed(1)).join(" ");
 const labels=series.filter((_,i)=>i===0||i===series.length-1||i===Math.floor(series.length/2)).map((d)=>{const i=series.indexOf(d);return '<text x="'+x(i).toFixed(1)+'" y="'+(H-7)+'" text-anchor="middle" font-size="10" fill="currentColor">'+escapeHtml(new Date(d.bucket).toLocaleDateString("en-IN",{day:"2-digit",month:"short"}))+'</text>'}).join("");
 svg.innerHTML=bars+'<path d="'+orderPath+'" fill="none" stroke="currentColor" stroke-width="2.5"></path><path d="'+visPath+'" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 4" opacity=".6"></path>'+labels;
}
function renderProducts(rows){
 if(!rows?.length){$("products").innerHTML='<tr><td colspan="7" class="growth-empty">No product performance data recorded in this period.</td></tr>';return}
 $("products").innerHTML=rows.map(p=>'<tr><td><strong>'+escapeHtml(p.product_name)+'</strong></td><td>'+num(p.views)+'</td><td>'+num(p.visitors)+'</td><td>'+num(p.orders)+'</td><td>'+num(p.units)+'</td><td>'+money(p.revenue)+'</td><td>'+pct(p.conversion_rate)+'</td></tr>').join("");
}
function renderInsights(rows){
 const list=rows?.length?rows:["No additional insight is available until real activity is recorded."];
 $("insights").innerHTML=list.map(x=>'<div class="growth-insight">'+escapeHtml(x)+'</div>').join("");
}
async function load(){
 $("status").textContent="Loading real seller analytics…";
 const {data:sessionData,error:sessionError}=await apnaSupabase.auth.getSession();
 if(sessionError||!sessionData.session){location.href="auth.html";return}
 const {data:profile,error:profileError}=await apnaSupabase.from("profiles").select("role").eq("id",sessionData.session.user.id).single();
 if(profileError||!profile||![ "seller","admin" ].includes(profile.role)){location.href="account.html";return}
 const r=dateRange(),start=new Date(r.start),end=new Date(r.end);
 const from=$("fromDate").value,to=$("toDate").value;
 const startAt=from?new Date(from+"T00:00:00"):start;
 const endAt=to?new Date(to+"T00:00:00"):end;
 if(from&&to&&endAt<=startAt){$("status").textContent="Please choose a valid date range.";return}
 endAt.setHours(0,0,0,0);endAt.setDate(endAt.getDate()+1);
 const {data,error}=await apnaSupabase.rpc("seller_growth_insights",{p_start_at:startAt.toISOString(),p_end_at:endAt.toISOString(),p_granularity:$("granularity").value});
 if(error){console.error(error);$("status").textContent=error.message||"Could not load seller insights.";return}
 const d=data||{};renderMetrics(d.current||{},d.previous||{});svgChart(d.series||[]);renderProducts(d.products||[]);renderInsights(d.insights||[]);
 $("rangeLabel").textContent=new Date(d.range.start_at).toLocaleDateString("en-IN")+" → "+new Date(d.range.end_at).toLocaleDateString("en-IN");
 $("status").textContent="Showing real recorded marketplace activity. Visitors/views start accumulating after analytics tracking is live.";
}
function setDates(days){state.days=days;const end=new Date();end.setDate(end.getDate()+1);const start=new Date(end);start.setDate(start.getDate()-days);$("fromDate").value=isoDate(start);$("toDate").value=isoDate(new Date(end.getTime()-86400000))}
$("back").onclick=()=>location.href="seller-dashboard.html";
document.querySelectorAll(".preset").forEach(b=>b.onclick=()=>{document.querySelectorAll(".preset").forEach(x=>x.classList.remove("active"));b.classList.add("active");setDates(Number(b.dataset.days));load()});
$("apply").onclick=()=>load();
setDates(30);
load();