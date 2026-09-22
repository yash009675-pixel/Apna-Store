const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
let editId=params.get("id"),user,role,pendingImages=[],imageRows=[],variants=[];
const MAX_BYTES=5242880,MIN_DIM=400,MAX_DIM=6000,MAX_EDGE=2000;

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function variantKey(v){return String(v?.size||"")+"|"+String(v?.color||"");}
function setMsg(message,error=false){$("msg").className=error?"msg error":"msg";$("msg").textContent=message||"";}
function currentVariantOptions(){
 return variants.map(v=>({id:v.id,key:variantKey(v),label:[v.size,v.color].filter(Boolean).join(" / ")||"Standard"}));
}
function variantSelect(selected){
 const opts=currentVariantOptions();
 return '<select class="image-variant">'+(opts.length?'<option value="">General product image</option>'+opts.map(v=>'<option value="'+esc(v.id)+'" '+(selected===v.id?"selected":"")+'>'+esc(v.label)+'</option>').join(""):'<option value="">General product image</option>')+'</select>';
}
function validateFile(file){
 if(!/^image\/(jpeg|png|webp)$/.test(file.type))return "Only JPG, PNG or WebP images are supported.";
 if(file.size>MAX_BYTES)return "Each image must be 5 MB or smaller before optimization.";
 return "";
}
function readDimensions(file){
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{URL.revokeObjectURL(url);resolve({width:img.naturalWidth,height:img.naturalHeight,img});};
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("This image could not be read."));};
  img.src=url;
 });
}
async function prepareImage(file){
 const problem=validateFile(file);if(problem)throw new Error(problem);
 const meta=await readDimensions(file);
 if(meta.width<MIN_DIM||meta.height<MIN_DIM)throw new Error("Image must be at least "+MIN_DIM+"×"+MIN_DIM+" pixels.");
 if(meta.width>MAX_DIM||meta.height>MAX_DIM)throw new Error("Image dimensions cannot exceed "+MAX_DIM+"×"+MAX_DIM+" pixels.");
 const scale=Math.min(1,MAX_EDGE/meta.width,MAX_EDGE/meta.height);
 const w=Math.max(1,Math.round(meta.width*scale)),h=Math.max(1,Math.round(meta.height*scale));
 const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext("2d",{alpha:true});ctx.drawImage(meta.img,0,0,w,h);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",.82));
 if(!blob)throw new Error("This browser could not optimize the image.");
 const base=file.name.replace(/\.[^.]+$/,"").replace(/[^a-z0-9_-]+/gi,"-").replace(/^-+|-+$/g,"")||"product-image";
 return {file:new File([blob],base+".webp",{type:"image/webp",lastModified:Date.now()}),width:w,height:h,originalName:file.name};
}
function renderPending(){
 const box=$("previewList");
 box.innerHTML=pendingImages.map((p,i)=>'<div class="image-item preview-card"><img src="'+esc(p.previewUrl)+'" alt="'+esc(p.originalName)+'"><button type="button" class="preview-remove" data-pending-remove="'+i+'" aria-label="Remove image">×</button><div class="image-meta">'+esc(p.originalName)+'<br>'+p.width+"×"+p.height+" • optimized WebP</div>"+variantSelect(p.variantId||"")+'</div>').join("");
 box.querySelectorAll("[data-pending-remove]").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.pendingRemove);URL.revokeObjectURL(pendingImages[i].previewUrl);pendingImages.splice(i,1);renderPending()});
 box.querySelectorAll(".image-variant").forEach((s,i)=>s.onchange=()=>pendingImages[i].variantId=s.value||null);
}
function renderImages(){
 const box=$("imageList");
 if(!imageRows.length){box.innerHTML='<div class="empty-images">No uploaded product images yet.</div>';return;}
 box.innerHTML=imageRows.map((x,i)=>{const u=apnaSupabase.storage.from("product-images").getPublicUrl(x.storage_path).data.publicUrl;
 return '<div class="image-item" draggable="true" data-image-card="'+x.id+'"><img src="'+esc(u)+'" alt="'+esc(x.alt_text||$("name").value.trim())+'"><div class="image-meta">Image '+(i+1)+(x.is_primary?" • Primary":"")+'</div>'+variantSelect(x.variant_id||"")+'<div class="image-controls"><button type="button" data-up="'+x.id+'" '+(i===0?"disabled":"")+' title="Move up">↑</button><button type="button" data-down="'+x.id+'" '+(i===imageRows.length-1?"disabled":"")+' title="Move down">↓</button><button type="button" class="danger" data-delete="'+x.id+'">Delete</button></div><label class="primary-mark"><input type="radio" name="primaryImage" '+(x.is_primary?"checked":"")+' data-primary="'+x.id+'> Primary image</label></div>'}).join("");
 box.querySelectorAll("[data-primary]").forEach(el=>el.onchange=async()=>setPrimary(el.dataset.primary));
 box.querySelectorAll("[data-delete]").forEach(el=>el.onclick=()=>deleteImage(el.dataset.delete));
 box.querySelectorAll("[data-up]").forEach(el=>el.onclick=()=>moveImage(el.dataset.up,-1));
 box.querySelectorAll("[data-down]").forEach(el=>el.onclick=()=>moveImage(el.dataset.down,1));
 box.querySelectorAll(".image-variant").forEach((s,i)=>s.onchange=async()=>updateImageMeta(imageRows[i].id,{variant_id:s.value||null}));
 box.querySelectorAll("[data-image-card]").forEach(card=>{card.ondragstart=e=>e.dataTransfer.setData("text/plain",card.dataset.imageCard);card.ondragover=e=>e.preventDefault();card.ondrop=async e=>{e.preventDefault();const from=e.dataTransfer.getData("text/plain");if(from&&from!==card.dataset.imageCard)await reorderImage(from,card.dataset.imageCard);}});
}
async function updateImageMeta(id,patch){const {error}=await apnaSupabase.from("product_images").update(patch).eq("id",id);if(error){setMsg(error.message,true);return false;}await loadImages();return true;}
async function setPrimary(id){const {error}=await apnaSupabase.from("product_images").update({is_primary:false}).eq("product_id",editId);if(error){setMsg(error.message,true);return;}const r=await apnaSupabase.from("product_images").update({is_primary:true}).eq("id",id);if(r.error){setMsg(r.error.message,true);return;}await loadImages();}
async function moveImage(id,delta){const i=imageRows.findIndex(x=>x.id===id),j=i+delta;if(i<0||j<0||j>=imageRows.length)return;const next=[...imageRows];[next[i],next[j]]=[next[j],next[i]];for(let k=0;k<next.length;k++){const r=await apnaSupabase.from("product_images").update({sort_order:k}).eq("id",next[k].id);if(r.error){setMsg(r.error.message,true);return;}}await loadImages();}
async function reorderImage(fromId,toId){const from=imageRows.findIndex(x=>x.id===fromId),to=imageRows.findIndex(x=>x.id===toId);if(from<0||to<0||from===to)return;const next=[...imageRows],item=next.splice(from,1)[0];next.splice(to,0,item);for(let k=0;k<next.length;k++){const r=await apnaSupabase.from("product_images").update({sort_order:k}).eq("id",next[k].id);if(r.error){setMsg(r.error.message,true);return;}}await loadImages();}
async function deleteImage(id){const row=imageRows.find(x=>x.id===id);if(!row)return;setMsg("Deleting image…");const s=await apnaSupabase.storage.from("product-images").remove([row.storage_path]);if(s.error){setMsg(s.error.message,true);return;}const d=await apnaSupabase.from("product_images").delete().eq("id",id);if(d.error){setMsg(d.error.message,true);return;}const remaining=await apnaSupabase.from("product_images").select("id").eq("product_id",editId);if((remaining.data||[]).length&&!imageRows.find(x=>x.id===id)?.is_primary&&!imageRows.some(x=>x.id!==id&&x.is_primary))await setPrimary(remaining.data[0].id);await loadImages();setMsg("Image deleted.");}
async function loadImages(){
 if(!editId){renderPending();return;}
 const {data,error}=await apnaSupabase.from("product_images").select("id,storage_path,alt_text,sort_order,is_primary,variant_id").eq("product_id",editId).order("sort_order");
 if(error){setMsg(error.message,true);return;}imageRows=data||[];renderImages();
}
async function loadVariants(){
 if(!editId)return;
 const {data,error}=await apnaSupabase.from("product_variants").select("id,size,color,sku,stock").eq("product_id",editId).order("created_at");
 if(error){setMsg(error.message,true);return;}variants=data||[];renderImages();renderPending();
}
function addVariant(v={}){
 const row=document.createElement("div");row.className="variant";
 row.innerHTML='<input class="vsize" placeholder="Size" value="'+esc(v.size)+'"><input class="vcolor" placeholder="Color" value="'+esc(v.color)+'"><input class="vsku" placeholder="SKU" value="'+esc(v.sku)+'"><input class="vstock" type="number" min="0" placeholder="Stock" value="'+(v.stock??0)+'"><button type="button" class="btn remove">Remove</button>';
 row.querySelector(".remove").onclick=()=>{row.remove();};
 $("variantRows").appendChild(row);
}
async function uploadPreparedImage(prepared,variantId=null){
 const path=user.id+"/"+editId+"/"+crypto.randomUUID()+".webp";
 const up=await apnaSupabase.storage.from("product-images").upload(path,prepared.file,{cacheControl:"31536000",upsert:false,contentType:"image/webp"});
 if(up.error)throw up.error;
 const {data:imgs}=await apnaSupabase.from("product_images").select("id,sort_order").eq("product_id",editId).order("sort_order",{ascending:false}).limit(1);
 const next=(imgs?.[0]?.sort_order??-1)+1;
 const ins=await apnaSupabase.from("product_images").insert({product_id:editId,variant_id:variantId||null,storage_path:path,alt_text:$("name").value.trim(),sort_order:next,is_primary:!imageRows.length});
 if(ins.error){await apnaSupabase.storage.from("product-images").remove([path]);throw ins.error;}
}
async function uploadPendingImages(){
 if(!editId||!pendingImages.length)return true;
 setMsg("Optimizing and uploading "+pendingImages.length+" image(s)…");
 let ok=true;
 const map=new Map(variants.map(v=>[variantKey(v),v.id]));
 for(const p of pendingImages){
  try{await uploadPreparedImage(p,p.variantId||null);}catch(e){ok=false;setMsg(e.message||"Image upload failed.",true);}
  URL.revokeObjectURL(p.previewUrl);
 }
 pendingImages=[];await loadImages();renderPending();return ok;
}
async function handleFiles(files){
 const selected=[...files];if(!selected.length)return;
 let accepted=0;
 for(const file of selected){
  try{const prepared=await prepareImage(file);prepared.previewUrl=URL.createObjectURL(prepared.file);pendingImages.push(prepared);accepted++;}
  catch(e){setMsg(file.name+": "+(e.message||"Invalid image."),true);}
 }
 renderPending();if(accepted)setMsg(accepted+" image(s) ready. "+(editId?"They will upload now.":"Save the product to upload them."));
 if(editId&&accepted){await uploadPendingImages();}
}
async function boot(){
 const {data:s}=await apnaSupabase.auth.getSession();
 if(!s.session){location.href="auth.html";return;}
 user=s.session.user;
 const {data:p}=await apnaSupabase.from("profiles").select("role").eq("id",user.id).single();
 if(!p||!["seller","admin"].includes(p.role)){location.href="account.html";return;}
 role=p.role;
 const [catRes,brandRes]=await Promise.all([apnaSupabase.from("categories").select("id,name").eq("is_active",true).order("sort_order").order("name"),apnaSupabase.from("brands").select("id,name").eq("is_active",true).order("sort_order").order("name")]);
 if(catRes.error||brandRes.error){setMsg((catRes.error||brandRes.error).message,true);return;}
 $("category").innerHTML='<option value="">No category</option>'+(catRes.data||[]).map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join("");
 $("brand").innerHTML='<option value="">No brand</option>'+(brandRes.data||[]).map(b=>'<option value="'+b.id+'">'+esc(b.name)+'</option>').join("");
 if(editId){
  $("heading").textContent="Edit product";
  const {data:prod,error}=await apnaSupabase.from("products").select("id,name,description,price,compare_at_price,status,category_id,brand_id,seller_id").eq("id",editId).single();
  if(error||!prod||(role==="seller"&&prod.seller_id!==user.id)){location.href="seller-products.html";return;}
  $("name").value=prod.name||"";$("description").value=prod.description||"";$("price").value=prod.price??"";$("compare").value=prod.compare_at_price??"";$("status").value=prod.status||"draft";$("category").value=prod.category_id||"";$("brand").value=prod.brand_id||"";
  await loadVariants();await loadImages();
 }else addVariant();
 $("addVariant").onclick=()=>addVariant();
 const dz=$("dropzone");
 dz.onclick=()=>$("images").click();
 dz.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();$("images").click();}};
 dz.ondragover=e=>{e.preventDefault();dz.classList.add("drag");};
 dz.ondragleave=()=>dz.classList.remove("drag");
 dz.ondrop=e=>{e.preventDefault();dz.classList.remove("drag");handleFiles(e.dataTransfer.files);};
 $("images").onchange=()=>handleFiles($("images").files);
}
$("form").addEventListener("submit",async e=>{
 e.preventDefault();$("save").disabled=true;setMsg("Saving product…");
 try{
  const name=$("name").value.trim();if(!name)throw new Error("Please enter a product name.");
  const rows=[...document.querySelectorAll(".variant")].map(r=>({size:r.querySelector(".vsize").value.trim()||null,color:r.querySelector(".vcolor").value.trim()||null,sku:r.querySelector(".vsku").value.trim()||null,stock:Math.max(0,Number(r.querySelector(".vstock").value)||0)}));
  const {data:savedId,error}=await apnaSupabase.rpc("seller_save_product",{p_product_id:editId||null,p_name:name,p_description:$("description").value.trim(),p_price:Number($("price").value),p_compare_at_price:$("compare").value?Number($("compare").value):null,p_status:$("status").value,p_category_id:$("category").value||null,p_brand_id:$("brand").value||null,p_variants:rows});
  if(error)throw error;
  editId=savedId||editId;if(!editId)throw new Error("Product was saved but its ID could not be confirmed.");
  $("heading").textContent="Edit product";
  await loadVariants();
  const uploaded=await uploadPendingImages();
  await loadImages();
  setMsg(uploaded?"Product saved successfully. Image gallery is ready.":"Product saved, but one or more images need attention.",!uploaded);
 }catch(err){setMsg(err.message||"Could not save product.",true);}
 $("save").disabled=false;
});
boot();