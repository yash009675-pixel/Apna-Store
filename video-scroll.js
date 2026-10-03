/* ApnaStore Phase A — scroll story controller */
(function(){
  const story=document.getElementById('vsStory'); if(!story)return;
  const chapters=[...story.querySelectorAll('.vs-chapter')], tabs=[...story.querySelectorAll('.vs-tabs a')];
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
  function setTop(){const h=document.querySelector('.ref-header'); story.style.setProperty('--vs-top',(h?h.offsetHeight:0)+'px')}
  setTop(); addEventListener('resize',setTop,{passive:true});
  if(reduce.matches){chapters.forEach(c=>c.classList.add('vs-active')); return}
  story.classList.add('vs-on');
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){chapters.forEach(c=>c.classList.remove('vs-active'));e.target.classList.add('vs-active')}}),{threshold:.45});
  chapters.forEach(c=>io.observe(c));
  tabs.forEach(a=>a.addEventListener('click',e=>{const el=document.getElementById(a.dataset.target);if(el){e.preventDefault();el.scrollIntoView({behavior:'smooth',block:'start'})}}));
})();
