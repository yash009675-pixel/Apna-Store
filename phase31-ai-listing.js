let phase31Draft=null;
const p31$=id=>document.getElementById(id);
const p31esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function p31Message(v,error=false){const el=p31$("aiListingMessage");el.textContent=v||"";el.className=error?"msg error":"msg"}
function p31Json(raw){
  let s=String(raw||"").trim().replace(/^\`\`\`(?:json)?/i,"").replace(/\`\`\`$/,"").trim();
  const first=s.indexOf("{"),last=s.lastIndexOf("}");
  if(first>=0&&last>first)s=s.slice(first,last+1);
  return JSON.parse(s);
}
function p31Render(d){
  const r=p31$("aiListingResult");phase31Draft=d;
  const fields=[
    ["Product Title",d.product_title],["Description",d.description],["Bullet Points",(d.bullet_points||[]).join("\n• ")],
    ["Attributes",JSON.stringify(d.attributes||{},null,2)],["Search Keywords",(d.search_keywords||[]).join(", ")],
    ["Category Suggestion",d.category_suggestion],["SEO Title",d.seo_title],["SEO Description",d.seo_description]
  ];
  r.innerHTML='<div class="ai-draft-grid">'+fields.map((x,i)=>'<div class="ai-draft-field '+(i===1||i===2||i===3||i===4||i===7?"full":"")+'"><strong>'+p31esc(x[0])+'</strong><pre>'+p31esc(x[1]||"—")+'</pre></div>').join("")+'</div><div class="ai-draft-actions"><button type="button" class="btn dark" id="aiApplyDraft">Apply to form</button><button type="button" class="btn" id="aiDiscardDraft">Discard</button></div>';
  r.hidden=false;
  p31$("aiApplyDraft").onclick=p31Apply;
  p31$("aiDiscardDraft").onclick=()=>{phase31Draft=null;r.hidden=true;p31Message("Draft discarded.")};
}
function p31Apply(){
  const d=phase31Draft;if(!d)return;
  if(d.product_title)p31$("name").value=d.product_title;
  if(d.description)p31$("description").value=d.description;
  if(d.attributes)p31$("attributes").value=JSON.stringify(d.attributes,null,2);
  if(d.search_keywords?.length){const a={};a.search_keywords=d.search_keywords;p31$("attributes").value=JSON.stringify(Object.assign(a,d.attributes||{}),null,2)}
  if(d.category_suggestion){const sel=p31$("category"),needle=String(d.category_suggestion).trim().toLowerCase();const opt=[...sel.options].find(o=>o.textContent.trim().toLowerCase()===needle||o.textContent.trim().toLowerCase().includes(needle));if(opt)sel.value=opt.value}
  p31Message("AI draft applied. Please review all fields, pricing, stock and category before saving/submitting.");
  window.scrollTo({top:document.getElementById("form").offsetTop-70,behavior:"smooth"});
}
async function p31Generate(){
  const input=p31$("aiListingInput").value.trim();if(!input){p31Message("Describe the product first.",true);return}
  const btn=p31$("aiListingGenerate");btn.disabled=true;p31Message("Generating listing draft…");
  try{
    let authorization="";if(window.apnaSupabase?.auth){const s=await window.apnaSupabase.auth.getSession();const token=s.data?.session?.access_token;if(token)authorization="Bearer "+token}
    const prompt="Act as the Apna Store seller listing assistant. Create a draft listing for this seller input: "+input+". Return ONLY valid JSON with exactly these keys: product_title, description, bullet_points (array of strings), attributes (object), search_keywords (array of strings), category_suggestion, seo_title, seo_description. Do not invent factual certifications, measurements, materials or compliance claims not supplied by the seller. Use concise marketplace-ready wording. Category suggestion must be a suggestion only; the seller must review it.";
    const res=await fetch("https://xxedwtmdylfufrfzyrdb.supabase.co/functions/v1/apna-ai-assistant",{method:"POST",headers:Object.assign({"Content-Type":"application/json"},authorization?{Authorization:authorization}:{}),body:JSON.stringify({message:prompt,page:"seller-product.html",mode:"listing_assistant"})});
    const data=await res.json();if(!res.ok)throw new Error(data?.error||"AI unavailable");
    const draft=p31Json(data.answer);p31Render(draft);p31Message("Draft generated. Nothing has been saved automatically.");
  }catch(e){p31Message(e?.message||"AI listing assistant is temporarily unavailable.",true)}
  finally{btn.disabled=false}
}
document.addEventListener("DOMContentLoaded",()=>{const b=p31$("aiListingGenerate");if(b)b.onclick=p31Generate});
