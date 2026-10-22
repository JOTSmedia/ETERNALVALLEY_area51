import { initCinematicTour } from './cinematicTour.js?v=73';
import { veoTour } from './VeoTourController.js?v=73';
import { plotsForScene, sceneForPlot, sceneImage } from './sceneCatalog.js?v=73';
import { State } from './state.js?v=73';
import { IS_DEMO } from './config.js?v=73';
import { CINEMATIC_SCENES } from './cinematicCatalog.js?v=73';

// Photographic destinations and filmed travel share the same real plot catalog.
// A destination photograph describes its setting; it is not a cadastral plot map.
export function initPhotographicView(UI) {
  if (document.getElementById('viewPhotographic')) return;
  const scenes=CINEMATIC_SCENES;
  let current=Math.max(0,scenes.findIndex(s=>s.id==='grand-gate-open')),request=0,filter='available',query='';
  const section=document.createElement('section');
  section.id='viewPhotographic';section.className='photo-sanctuary hidden';
  section.setAttribute('aria-label','Explore the photographic sanctuary');
  section.innerHTML=`
    <img class="photo-scene" alt="" decoding="async"><div class="photo-shade"></div>
    <div class="photo-heading">
      <span class="photo-eyebrow">ETERNAL VALLEY / A PLACE TO REMEMBER</span>
      <h1></h1><p class="photo-description"></p>
      <div class="photo-actions">
        <button class="photo-explore" type="button">View plots here <span aria-hidden="true">↗</span></button>
        <button class="photo-film" type="button">▶ Travel through this place</button>
      </div>
      <span class="photo-status" role="status" aria-live="polite"></span>
    </div>
    <aside class="photo-plots" aria-label="Plots and memorials" hidden>
      <div class="photo-plots-title"><div><span class="photo-eyebrow">FIND YOUR PLACE</span><h2>Plots & memorials</h2></div><button class="photo-plots-close" aria-label="Close plot browser">×</button></div>
      <p class="photo-plot-context"></p>
      <label class="photo-search-label">Find a plot or companion<input class="photo-search" type="search" placeholder="Plot ID or memorial name"></label>
      <div class="photo-filters" role="group" aria-label="Filter plots">
        <button data-filter="available" aria-pressed="true">Available</button><button data-filter="memorials" aria-pressed="false">Memorials</button><button data-filter="mine" aria-pressed="false">My places</button>
      </div>
      <div class="photo-results" role="status" aria-live="polite"></div><div class="photo-plot-list"></div>
      <p class="photo-inventory-note">The photograph shows the destination. Each plot has its own catalog ID and memorial record.</p>
      ${IS_DEMO?'<p class="photo-demo-note">Preview mode · Purchases are simulated.</p>':''}
    </aside>
    <div class="photo-footer">
      <div class="photo-navigation"><button class="photo-prev" aria-label="Previous destination">←</button><span class="photo-count" aria-live="polite"></span><button class="photo-next" aria-label="Next destination">→</button></div>
      <label class="photo-picker-label">Explore a destination<select class="photo-picker" aria-label="Choose a photographic destination"></select></label>
      <button class="photo-my-places" type="button">My memorials</button>
    </div>`;
  document.getElementById('stage').appendChild(section);
  const $=selector=>section.querySelector(selector);
  const picker=$('.photo-picker'),drawer=$('.photo-plots'),status=$('.photo-status');
  scenes.forEach((s,i)=>picker.add(new Option(s.name,i)));
  const owned=()=>State.data?.ownedPlots||{};
  function renderPlots() {
    const scene=scenes[current];
    let list=plotsForScene(scene,UI.plots,owned());
    if(filter==='mine') list=UI.plots.filter(p=>owned()[p.id] && UI.plots.filter(other=>other.id===p.id).length===1);
    else list=list.filter(p=>filter==='available' ? p.status==='available'&&!owned()[p.id] : p.status!=='available'||owned()[p.id]);
    const term=query.trim().toLowerCase();
    if(term)list=list.filter(p=>`${p.id} ${p.memorial?.petName||owned()[p.id]?.memorial?.petName||''}`.toLowerCase().includes(term));
    $('.photo-plot-context').textContent=filter==='mine'?'Your memorials across the sanctuary':scene.name;
    $('.photo-results').textContent=`${list.length} ${filter==='available'?'available plots':'memorials'}`;
    const cards=$('.photo-plot-list');cards.replaceChildren();
    for(const plot of list.slice(0,60)) {
      const mine=!!owned()[plot.id],available=plot.status==='available'&&!mine;
      const card=document.createElement('button');card.className='photo-plot-card';card.type='button';
      const badge=document.createElement('span');badge.className='photo-plot-badge';badge.textContent=mine?'YOUR MEMORIAL':available?'AVAILABLE':'MEMORIAL';
      const name=document.createElement('strong');name.textContent=available?`Plot ${plot.id}`:(plot.memorial?.petName||owned()[plot.id]?.memorial?.petName||'Beloved companion');
      const detail=document.createElement('span');detail.textContent=available?`$${Number(plot.price).toLocaleString()} · View details`:`Plot ${plot.id} · Visit memorial`;
      card.append(badge,name,detail);
      card.onclick=async()=>{
        if(filter==='mine'){const destination=sceneForPlot(plot,scenes);if(destination)await show(scenes.indexOf(destination));}
        closePlots();UI.openPlot(plot);
      };
      cards.appendChild(card);
    }
    if(!list.length){const empty=document.createElement('p');empty.className='photo-empty';empty.textContent=filter==='mine'?'Your memorials will appear here after you reserve a plot.':query?'No matching plots. Try another ID or name.':'No catalog plots are available in this view yet. Explore another destination.';cards.appendChild(empty);}
    if(list.length>60){const note=document.createElement('p');note.textContent='Showing the first 60. Search by plot ID or companion name to narrow your selection.';cards.appendChild(note);}
    section.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
  }
  function openPlots(nextFilter=filter) {filter=nextFilter;drawer.hidden=false;section.classList.add('plots-open');renderPlots();$('.photo-search').focus();}
  function closePlots(){drawer.hidden=true;section.classList.remove('plots-open');}
  async function show(index) {
    current=(index+scenes.length)%scenes.length;const scene=scenes[current],ticket=++request;
    status.textContent='Opening this place…';$('.photo-explore').disabled=true;$('.photo-film').disabled=true;
    const next=new Image();next.src=sceneImage(scene);
    try{await next.decode();if(ticket!==request)return;
      $('.photo-scene').src=next.src;$('.photo-scene').alt=scene.name;
      $('h1').textContent=scene.name;$('.photo-description').textContent=scene.sub;
      $('.photo-count').textContent=`${String(current+1).padStart(2,'0')} / ${scenes.length}`;picker.value=String(current);
      status.textContent='';$('.photo-explore').disabled=false;$('.photo-film').disabled=false;
      if(!drawer.hidden)renderPlots();
    }catch{if(ticket===request)status.textContent='This view could not load. Choose another destination.';}
  }
  UI.showPhotographic=async(sceneId=null,{browse=false}={})=>{
    UI.stopCinematicTour?.();veoTour.stop();UI.closePanel();document.body.classList.remove('is-film');
    UI._setView({view:'viewPhotographic',btn:'btnPhotographic'});
    if(sceneId){const i=scenes.findIndex(s=>s.id===sceneId);if(i>=0)current=i;}
    await show(current);if(browse)openPlots();
  };
  UI.visitPhotographicPlot=async plot=>{const s=sceneForPlot(plot,scenes);await UI.showPhotographic(s?.id);UI.openPlot(plot);};
  initCinematicTour(UI, () => veoTour.stop());
  $('.photo-explore').onclick=()=>openPlots('available');
  $('.photo-film').onclick=()=>UI.startFilmTour(scenes[current].id);
  $('.photo-my-places').onclick=()=>openPlots('mine');
  $('.photo-plots-close').onclick=()=>{closePlots();$('.photo-explore').focus();};
  $('.photo-search').oninput=e=>{query=e.target.value;renderPlots();};
  section.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;renderPlots();});
  $('.photo-prev').onclick=()=>show(current-1);$('.photo-next').onclick=()=>show(current+1);
  picker.onchange=()=>show(Number(picker.value));
  section.addEventListener('keydown',e=>{if(e.key==='Escape'){closePlots();return;}if(e.target.matches('select,input,button'))return;if(e.key==='ArrowLeft'){e.preventDefault();show(current-1);}if(e.key==='ArrowRight'){e.preventDefault();show(current+1);}});
  document.getElementById('btnPhotographic').onclick=()=>UI.showPhotographic();
}
