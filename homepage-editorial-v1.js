/* APNASTORE EDITORIAL EXPERIENCE — V1
   Lightweight visual behavior only. No commerce state is changed. */
(function(){
  'use strict';
  var root=document.querySelector('.apna-reference-home');
  if(!root || !('IntersectionObserver' in window)) return;
  var chapters=root.querySelectorAll('.ref-trending-section,.ref-collection,.ref-category-section,.ref-why,.ref-inspo');
  chapters.forEach(function(el){el.classList.add('editorial-chapter');});
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var observer=new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      entry.target.classList.toggle('editorial-active',entry.isIntersecting);
    });
  },{threshold:.25,rootMargin:'-10% 0px -35% 0px'});
  chapters.forEach(function(el){observer.observe(el);});
})();