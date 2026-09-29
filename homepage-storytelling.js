(function(){
  const items=document.querySelectorAll('.apna-story-reveal');
  if(!items.length)return;
  if(!('IntersectionObserver' in window)){items.forEach(el=>el.classList.add('is-visible'));return;}
  const observer=new IntersectionObserver((entries,obs)=>{
    entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');obs.unobserve(entry.target);}});
  },{threshold:.16,rootMargin:'0px 0px -8% 0px'});
  items.forEach(el=>observer.observe(el));
})();
