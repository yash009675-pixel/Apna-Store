/* Real scroll-scene controller — visual only, no shopping logic */
(function(){
  const root=document.querySelector('.apna-reference-home');
  if(!root) return;
  const hero=root.querySelector('.ref-hero');
  const heroImg=root.querySelector('.ref-hero-image');
  const heroCopy=root.querySelector('.ref-hero-copy');
  const sections=[...root.querySelectorAll('.ref-category-section,.ref-trending-section,.ref-collection,.ref-why')];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function tick(){
    const vh=window.innerHeight||800;
    if(hero){
      const r=hero.getBoundingClientRect(), p=clamp(-r.top/(vh*.72),0,1);
      if(heroImg) heroImg.style.transform='scale('+(1.06+p*.10)+') translateY('+(p*-4)+'%)';
      if(heroCopy){heroCopy.style.transform='translateY('+(p*-28)+'px)';heroCopy.style.opacity=String(1-p*.8)}
    }
    sections.forEach(s=>{
      const r=s.getBoundingClientRect(), center=vh*.5, d=(r.top+r.height*.5-center)/vh;
      const p=clamp(1-Math.abs(d)*1.8,0,1), enter=clamp((vh-r.top)/(vh*.75),0,1);
      s.classList.toggle('apna-scroll-ready',p>.18);
      const title=s.querySelector('.ref-section-title,.ref-collection-copy'), visual=s.querySelector('.ref-categories,.ref-products,.ref-benefits,.ref-collection-image');
      if(title) title.style.transform='translateY('+(24*(1-p))+'px)';
      if(visual){visual.style.transform='translateY('+(18*(1-p))+'px) scale('+(0.985+p*.015)+')';visual.style.opacity=String(.55+p*.45)}
      if(s.classList.contains('ref-collection')){
        const im=s.querySelector('.ref-collection-image'), cp=s.querySelector('.ref-collection-copy');
        if(im) im.style.transform='scale('+(1.06-(p*.06))+') translateY('+(12*(1-p))+'px)';
        if(cp){cp.style.transform='translateY('+(34*(1-p))+'px)';cp.style.opacity=String(.45+p*.55)}
      }
    });
  }
  let raf=0; function onScroll(){if(!raf){raf=requestAnimationFrame(()=>{raf=0;tick()})}}
  window.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('resize',tick);
  tick();
})();
