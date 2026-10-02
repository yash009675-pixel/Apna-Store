/* APNASTORE PREMIUM INTERACTIONS — V1
   Presentation-only behavior. Does not modify commerce state. */
(function(){
  'use strict';
  const root=document.querySelector('.apna-reference-home');
  if(!root || !('IntersectionObserver' in window)) return;

  const selectors=[
    '.ref-trending-section .product-card',
    '.ref-category-section .category',
    '.ref-why .ref-benefit',
    '.ref-inspo .ref-inspo-grid>a',
    '.ref-collection'
  ];

  const items=root.querySelectorAll(selectors.join(','));
  items.forEach(el=>el.classList.add('apna-premium-reveal'));

  const observer=new IntersectionObserver((entries,obs)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  },{threshold:.12,rootMargin:'0px 0px -35px 0px'});

  items.forEach(el=>observer.observe(el));
})();
