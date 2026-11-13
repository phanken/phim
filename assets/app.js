const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
const app=$('#app'), modal=$('#detailModal'), detailBody=$('#detailBody');
const BASE_PATH=String(window.KENFLIX_BASE_PATH||'').replace(/\/+$/,'');
function sitePath(path='/'){
 const raw=String(path||'/');
 const p=raw.startsWith('/')?raw:'/'+raw;
 return (BASE_PATH+p)||'/';
}
function navigate(path,replace=false){
 const url=sitePath(path);
 if(replace) history.replaceState(null,'',url); else history.pushState(null,'',url);
 route();
}
const IMG_BASE='https://phimimg.com/';
const IMG_ALT='https://img.phimapi.com/';
const FALLBACK='data:image/svg+xml;charset=UTF-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="100%" height="100%" fill="#191919"/><text x="50%" y="50%" fill="#666" font-family="Arial" font-size="22" text-anchor="middle">KENFLIX</text></svg>');
const genres=[
 ['hanh-dong','Hành động'],['tinh-cam','Tình cảm'],['hai-huoc','Hài hước'],['co-trang','Cổ trang'],
 ['tam-ly','Tâm lý'],['hinh-su','Hình sự'],['chien-tranh','Chiến tranh'],['the-thao','Thể thao'],
 ['vo-thuat','Võ thuật'],['vien-tuong','Viễn tưởng'],['phieu-luu','Phiêu lưu'],['khoa-hoc','Khoa học'],
 ['kinh-di','Kinh dị'],['am-nhac','Âm nhạc'],['than-thoai','Thần thoại'],['gia-dinh','Gia đình'],
 ['hoc-duong','Học đường'],['bi-an','Bí ẩn']
];
const countries=[
 ['viet-nam','Việt Nam'],['trung-quoc','Trung Quốc'],['han-quoc','Hàn Quốc'],['nhat-ban','Nhật Bản'],['thai-lan','Thái Lan'],
 ['au-my','Âu Mỹ'],['dai-loan','Đài Loan'],['hong-kong','Hồng Kông'],['an-do','Ấn Độ'],
 ['anh','Anh'],['phap','Pháp'],['canada','Canada'],['duc','Đức']
];
const listLinks=[
 ['phim-moi-cap-nhat','Phim mới cập nhật'],['phim-le','Phim lẻ'],['phim-bo','Phim bộ'],
 ['hoat-hinh','Hoạt hình'],['tv-shows','TV Shows'],['phim-chieu-rap','Phim chiếu rạp']
];
let hls=null, currentDetail=null, currentServer=0, currentEpisode=0, currentPlayer='auto', saveTimer=null, preparedPlayer=null;

function esc(s=''){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function stripHtml(s=''){const d=document.createElement('div');d.innerHTML=s;return d.textContent||d.innerText||''}
function img(url){if(!url)return FALLBACK;if(/^https?:\/\//i.test(url))return url;return IMG_BASE+String(url).replace(/^\/+/,'')}
function imgError(el){const src=el.getAttribute('data-src-original')||'';if(!el.dataset.altTried && src && !/^https?:/i.test(src)){el.dataset.altTried='1';el.src=IMG_ALT+src.replace(/^\/+/,'');return}el.src=FALLBACK}
function api(params){
 const p={...params}, action=p.action||'latest'; delete p.action;
 const routes={latest:()=>'/danh-sach/phim-moi-cap-nhat',list:()=>'/v1/api/danh-sach/'+encodeURIComponent(p.type||'phim-le'),genre:()=>'/v1/api/the-loai/'+encodeURIComponent(p.slug||''),country:()=>'/v1/api/quoc-gia/'+encodeURIComponent(p.slug||''),search:()=>'/v1/api/tim-kiem',detail:()=>'/v1/api/phim/'+encodeURIComponent(p.slug||'')};
 if(!routes[action])return Promise.reject(new Error('Chức năng API không hợp lệ'));
 delete p.type; delete p.slug;
 if(['list','genre','country'].includes(action)){p.sort_field='modified.time';p.sort_type='desc';}
 const qs=new URLSearchParams(p),url='https://phimapi.com'+routes[action]+'?'+qs.toString();
 return fetch(url,{cache:'no-store',headers:{Accept:'application/json'}}).then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok||j.status==='error')throw new Error(j.message||('PhimAPI HTTP '+r.status));return j}).catch(e=>{if(e instanceof TypeError)throw new Error('Trình duyệt không kết nối được PhimAPI (có thể API chặn CORS). Cần proxy API hoặc hosting PHP.');throw e});
}
function dataItems(j){return j?.data?.items||j?.items||j?.data?.item?.items||[]}
function pagination(j){const p=j?.data?.params?.pagination||j?.params?.pagination||j?.pagination||{};const total=Number(p.totalItems||p.total_items||j?.pagination?.totalItems||0);const per=Number(p.totalItemsPerPage||p.total_items_per_page||24);const current=Number(p.currentPage||p.current_page||1);let pages=Number(p.totalPages||p.total_pages||0);if(!pages&&total)pages=Math.ceil(total/per);return {total,per,current,pages:pages||1}}
function titleForType(type){return ({'phim-le':'Phim lẻ','phim-bo':'Phim bộ','hoat-hinh':'Hoạt hình','tv-shows':'TV Shows','phim-chieu-rap':'Phim chiếu rạp'})[type]||'Danh sách phim'}
function toast(text){const t=$('#toast');t.textContent=text;t.classList.add('show');clearTimeout(t._tm);t._tm=setTimeout(()=>t.classList.remove('show'),2200)}
function movieCard(m,extra=''){const poster=m.poster_url||m.thumb_url||'';return `<article class="movie-card ${extra}" data-slug="${esc(m.slug)}" onclick="openDetail('${esc(m.slug)}')">
  <div class="poster">
    <img loading="lazy" src="${esc(img(poster))}" data-src-original="${esc(poster)}" onerror="imgError(this)" alt="${esc(m.name||'Phim')}">
    <div class="card-badges">${m.quality?`<span class="tag red">${esc(m.quality)}</span>`:''}${m.lang?`<span class="tag">${esc(m.lang)}</span>`:''}</div>
  </div>
  <div class="card-name">${esc(m.name||'Không tên')}</div>
  <div class="card-meta"><span>${esc(m.year||'')}</span><span>${esc(m.episode_current||m.time||'')}</span></div>
</article>`}
function skeletonRow(n=7){return `<div class="row-scroll">${Array.from({length:n},()=>'<div class="movie-card"><div class="poster skeleton"></div><div class="card-name skeleton" style="height:15px"></div></div>').join('')}</div>`}

function renderMenus(){
 $('#genreMenu').innerHTML=genres.map(([s,n])=>`<a href="${sitePath(`/genre/${s}`)}">${n}</a>`).join('');
 $('#countryMenu').innerHTML=countries.map(([s,n])=>`<a href="${sitePath(`/country/${s}`)}">${n}</a>`).join('');
 $('#listMenu').innerHTML=listLinks.map(([s,n])=>s==='phim-moi-cap-nhat'?`<a href="${sitePath('/')}">${n}</a>`:`<a href="${sitePath(`/list/${s}`)}">${n}</a>`).join('');
}
renderMenus();

async function home(){
 destroyPreparedPlayer();
 app.innerHTML=`<section class="hero skeleton" id="hero"></section><div class="home-content">
   <section class="section" id="continueSection"></section>
   ${['latest','phim-bo','phim-le','hoat-hinh','phim-chieu-rap'].map((x,i)=>`<section class="section" id="row-${x}"><div class="section-head"><h2 class="section-title">${['Mới cập nhật','Phim bộ','Phim lẻ','Hoạt hình','Phim chiếu rạp'][i]}</h2></div>${skeletonRow()}</section>`).join('')}
 </div>`;
 renderContinue();
 const requests=[
  ['latest',api({action:'latest',page:1})],
  ['phim-bo',api({action:'list',type:'phim-bo',page:1,limit:18})],
  ['phim-le',api({action:'list',type:'phim-le',page:1,limit:18})],
  ['hoat-hinh',api({action:'list',type:'hoat-hinh',page:1,limit:18})],
  ['phim-chieu-rap',api({action:'list',type:'phim-chieu-rap',page:1,limit:18})],
 ];
 const results=await Promise.allSettled(requests.map(x=>x[1]));
 results.forEach((res,i)=>{const key=requests[i][0]; if(res.status==='fulfilled'){const items=dataItems(res.value);renderRow(key,items); if(i===0&&items[0])renderHero(items[0]);} else renderRowError(key,res.reason.message)});
}
function renderHero(m){const hero=$('#hero');if(!hero)return;hero.classList.remove('skeleton');const bg=m.thumb_url||m.poster_url||'';hero.style.backgroundImage=`url("${img(bg).replace(/"/g,'')}")`;hero.innerHTML=`<div class="hero-content">
 <h1 class="hero-title">${esc(m.name||'Kenflix')}</h1><div class="hero-origin">${esc(m.origin_name||'')}</div>
 <div class="hero-meta"><span>${esc(m.year||'')}</span><span>${esc(m.quality||'')}</span><span>${esc(m.lang||'')}</span><span>${esc(m.episode_current||'')}</span></div>
 <div class="hero-desc">${esc(stripHtml(m.content||'Khám phá phim mới cập nhật trên Kenflix.'))}</div>
 <div class="actions"><button class="btn primary" onclick="event.stopPropagation();watchFromSlug('${esc(m.slug)}')">▶ Xem ngay</button><button class="btn secondary" onclick="event.stopPropagation();openDetail('${esc(m.slug)}')">ⓘ Chi tiết</button></div>
 </div>`}
function renderRow(key,items){const box=$('#row-'+key);if(!box)return;const title=key==='latest'?'🔥 Mới cập nhật':titleForType(key);box.innerHTML=`<div class="section-head"><h2 class="section-title">${title}</h2>${key!=='latest'?`<a class="section-link" href="${sitePath(`/list/${key}`)}">Xem tất cả ›</a>`:''}</div><div class="row-scroll">${items.slice(0,20).map(x=>movieCard(x)).join('')||'<div class="empty">Chưa có phim</div>'}</div>`}
function renderRowError(key,msg){const box=$('#row-'+key);if(box)box.innerHTML=`<div class="section-head"><h2 class="section-title">${key==='latest'?'🔥 Mới cập nhật':titleForType(key)}</h2></div><div class="empty">Không tải được: ${esc(msg)}</div>`}

function getContinue(){try{return JSON.parse(localStorage.getItem('kenflix_continue')||'[]')}catch{return []}}
function setContinue(list){localStorage.setItem('kenflix_continue',JSON.stringify(list.slice(0,24)))}
function saveContinue(movie,serverIndex,episodeIndex,progress=0){
 if(!movie?.slug)return;let list=getContinue().filter(x=>x.slug!==movie.slug);
 list.unshift({slug:movie.slug,name:movie.name,origin_name:movie.origin_name,poster_url:movie.poster_url||movie.thumb_url,year:movie.year,quality:movie.quality,lang:movie.lang,serverIndex,episodeIndex,progress:Math.max(0,Math.min(100,progress||0)),updated:Date.now()});
 setContinue(list);renderContinue();
}
function removeContinue(slug,e){e?.stopPropagation();setContinue(getContinue().filter(x=>x.slug!==slug));renderContinue();toast('Đã xoá khỏi Tiếp tục xem')}
function renderContinue(){
 const sec=$('#continueSection');if(!sec)return;const list=getContinue();if(!list.length){sec.innerHTML='';sec.style.display='none';return}
 sec.style.display='block';sec.innerHTML=`<div class="section-head"><h2 class="section-title">Tiếp tục xem</h2></div><div class="row-scroll">${list.map(m=>`<article class="movie-card continue-card" style="--progress:${Number(m.progress||0)}%" onclick="resumeMovie('${esc(m.slug)}')">
 <button class="remove-continue" title="Xoá" onclick="removeContinue('${esc(m.slug)}',event)">×</button>
 <div class="poster"><img src="${esc(img(m.poster_url))}" data-src-original="${esc(m.poster_url||'')}" onerror="imgError(this)" alt="${esc(m.name)}"></div>
 <div class="card-name">${esc(m.name)}</div><div class="card-meta"><span>Tập ${Number(m.episodeIndex||0)+1}</span><span>${esc(m.quality||'')}</span></div></article>`).join('')}</div>`}
async function resumeMovie(slug){const c=getContinue().find(x=>x.slug===slug);navigate(`/watch/${encodeURIComponent(slug)}?s=${c?.serverIndex||0}&e=${c?.episodeIndex||0}`)}

function openDetail(slug){
 navigate(`/phim/${encodeURIComponent(slug)}`);
}

function detailFavoriteState(){
 const b=$('#detailFavorite');if(!b||!currentDetail)return;
 const on=favoriteSlugs().includes(currentDetail.slug);
 b.classList.toggle('active',on);
 b.innerHTML=on?'♥ Đã yêu thích':'♡ Yêu thích';
}
function toggleDetailFavorite(){
 if(!currentDetail)return;
 const exists=favoriteSlugs().includes(currentDetail.slug);
 let list=favoriteSlugs().filter(x=>x!==currentDetail.slug);
 if(!exists)list.unshift(currentDetail.slug);
 localStorage.setItem('kenflix_favorites',JSON.stringify(list));
 detailFavoriteState();
 toast(exists?'Đã bỏ khỏi yêu thích':'Đã thêm vào yêu thích');
}
function detailEpisodeLabel(ep,index=0){
 return prettyEpisodeName(ep,index);
}
async function detailPage(slug){
 destroyPreparedPlayer();
 app.innerHTML='<div class="page-loading">Đang tải thông tin phim...</div>';
 try{
  const j=await api({action:'detail',slug});
  const m=j?.data?.item||j?.movie||j?.item||{};
  currentDetail=m;
  const servers=m.episodes||[];
  const bg=m.thumb_url||m.poster_url||'';
  const content=stripHtml(m.content||'');
  const origin=m.origin_name||'';
  const countries=(m.country||[]).map(x=>x.name).join(', ');
  const cats=(m.category||[]).map(x=>`<a href="${sitePath(`/genre/${encodeURIComponent(x.slug)}`)}">${esc(x.name)}</a>`).join(' · ');
  const firstAvailable=servers.findIndex(s=>(s.server_data||[]).length>0);
  const firstServer=firstAvailable<0?0:firstAvailable;
  const hasVideo=firstAvailable>=0;
  const meta=[m.year,m.quality,m.lang,m.episode_current,m.time].filter(Boolean);
  const groups=servers.map((server,si)=>{
    const eps=server.server_data||[];
    if(!eps.length)return '';
    return `<section class="detail-episodes-group">
      <h2>${esc(server.server_name||`Server ${si+1}`)}</h2>
      <div class="detail-episode-grid">${eps.map((ep,ei)=>`<button onpointerdown="prepareEpisodePlayer(currentDetail,${si},${ei})" onclick="openWatchFromDetail(${si},${ei})">${esc(detailEpisodeLabel(ep,ei))}</button>`).join('')}</div>
    </section>`;
  }).join('');

  app.innerHTML=`<div class="movie-detail-page">
    <section class="movie-detail-hero" style="background-image:url('${esc(img(bg))}')">
      <div class="movie-detail-overlay"></div>
      <div class="movie-detail-copy">
        <h1>${esc(m.name||'')}</h1>
        <div class="movie-detail-tags">${meta.map(x=>`<span>${esc(x)}</span>`).join('')}</div>
        <p class="movie-detail-desc">${esc(content)}</p>
        <div class="movie-detail-actions">
          <button class="btn primary" ${hasVideo?'':'disabled'} onclick="openWatchFromDetail(${firstServer},0)">▶ Xem phim</button>
          <button class="btn secondary detail-favorite" id="detailFavorite" onclick="toggleDetailFavorite()">♡ Yêu thích</button>
        </div>
        ${origin?`<div class="movie-detail-origin">${esc(origin)}</div>`:''}
      </div>
    </section>
    <div class="movie-detail-body">
      ${cats?`<div class="movie-detail-extra"><b>Thể loại:</b> ${cats}</div>`:''}
      ${countries?`<div class="movie-detail-extra"><b>Quốc gia:</b> ${esc(countries)}</div>`:''}
      ${groups||'<div class="empty">Phim này chưa có tập phát.</div>'}
    </div>
  </div>`;
  detailFavoriteState();

  if(isMobilePlayback() && hasVideo){
   setTimeout(()=>prepareEpisodePlayer(m,firstServer,0),0);
  }
 }catch(e){
  app.innerHTML=`<div class="error-page"><h2>Không mở được phim</h2><p>${esc(e.message)}</p><a class="btn secondary" href="${sitePath('/')}">Về trang chủ</a></div>`;
 }
}
function closeModal(){modal.classList.remove('show');modal.setAttribute('aria-hidden','true');document.body.style.overflow=''}
$('#modalClose').onclick=closeModal;modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});

async function listing(kind,value,page=1){
 destroyPreparedPlayer();
 const label=kind==='genre'?(genres.find(g=>g[0]===value)?.[1]||value):kind==='country'?(countries.find(g=>g[0]===value)?.[1]||value):titleForType(value);
 app.innerHTML=`<div class="page"><div class="page-top"><h1>${esc(label)}</h1><span class="count" id="resultCount"></span></div><div class="movie-grid" id="grid">${Array.from({length:12},()=>'<div class="movie-card"><div class="poster skeleton"></div></div>').join('')}</div><div class="pagination" id="pager"></div></div>`;
 try{
   const args=kind==='genre'?{action:'genre',slug:value,page,limit:24}:kind==='country'?{action:'country',slug:value,page,limit:24}:{action:'list',type:value,page,limit:24};
   const j=await api(args);renderListing(j,kind,value,page)
 }catch(e){$('#grid').innerHTML=`<div class="error-page">${esc(e.message)}</div>`}
}
async function searchPage(keyword,page=1){
 destroyPreparedPlayer();
 app.innerHTML=`<div class="page"><div class="page-top"><h1>Kết quả: “${esc(keyword)}”</h1><span class="count" id="resultCount"></span></div><div class="movie-grid" id="grid">${Array.from({length:12},()=>'<div class="movie-card"><div class="poster skeleton"></div></div>').join('')}</div><div class="pagination" id="pager"></div></div>`;
 try{const j=await api({action:'search',keyword,page,limit:24});renderListing(j,'search',keyword,page)}catch(e){$('#grid').innerHTML=`<div class="error-page">${esc(e.message)}</div>`}
}
function renderListing(j,kind,value,page){const items=dataItems(j),p=pagination(j);$('#grid').innerHTML=items.map(x=>movieCard(x)).join('')||'<div class="empty">Không có phim phù hợp.</div>';$('#resultCount').textContent=p.total?`${p.total.toLocaleString('vi-VN')} phim`:`${items.length} phim`;renderPager(p,kind,value,page)}
function renderPager(p,kind,value,page){const box=$('#pager');if(!box||p.pages<=1)return;let s=`<button ${page<=1?'disabled':''} onclick="navPage('${kind}','${esc(value)}',${page-1})">‹</button>`;let a=Math.max(1,page-2),b=Math.min(p.pages,page+2);if(a>1)s+=`<button onclick="navPage('${kind}','${esc(value)}',1)">1</button>`;for(let n=a;n<=b;n++)s+=`<button class="${n===page?'active':''}" onclick="navPage('${kind}','${esc(value)}',${n})">${n}</button>`;if(b<p.pages)s+=`<button onclick="navPage('${kind}','${esc(value)}',${p.pages})">${p.pages}</button>`;s+=`<button ${page>=p.pages?'disabled':''} onclick="navPage('${kind}','${esc(value)}',${page+1})">›</button>`;box.innerHTML=s}
function navPage(kind,value,page){if(kind==='search')navigate(`/search/${encodeURIComponent(value)}?page=${page}`);else if(kind==='genre')navigate(`/genre/${encodeURIComponent(value)}?page=${page}`);else if(kind==='country')navigate(`/country/${encodeURIComponent(value)}?page=${page}`);else navigate(`/list/${encodeURIComponent(value)}?page=${page}`)}

async function watchFromSlug(slug){navigate(`/watch/${encodeURIComponent(slug)}`)}
function prettyEpisodeName(ep,index=0){
 const raw=String(ep?.name||'').trim();
 if(/^\d+$/.test(raw))return `Tập ${raw.padStart(2,'0')}`;
 if(/^tập\s*\d+$/i.test(raw)){const n=raw.match(/\d+/)?.[0]||String(index+1);return `Tập ${n.padStart(2,'0')}`}
 return raw||`Tập ${String(index+1).padStart(2,'0')}`;
}
function updateWatchLabels(){
 const ep=episode();const label=prettyEpisodeName(ep,currentEpisode);const movie=currentDetail?.name||'';
 const top=$('#watchTopTitle'), bottom=$('#watchEpisodeTitle');
 if(top)top.textContent=`${movie} · ${label}`;
 if(bottom)bottom.textContent=`${label} · ${movie}`;
 const prev=$('#prevEpisodeBtn'), next=$('#nextEpisodeBtn');
 if(prev)prev.disabled=currentEpisode<=0;
 const eps=currentDetail?.episodes?.[currentServer]?.server_data||[];
 if(next)next.disabled=currentEpisode>=eps.length-1;
}
function filterEpisodes(value=''){
 const q=String(value).trim().toLowerCase();
 $$('#episodes .episode-btn').forEach(btn=>{btn.hidden=!!q && !String(btn.dataset.search||'').includes(q)});
}
function favoriteSlugs(){try{return JSON.parse(localStorage.getItem('kenflix_favorites')||'[]')}catch{return []}}
function updateFavoriteButton(){const b=$('#watchFavorite');if(!b||!currentDetail)return;const on=favoriteSlugs().includes(currentDetail.slug);b.classList.toggle('active',on);b.textContent=on?'♥':'♡';b.title=on?'Bỏ khỏi yêu thích':'Thêm vào yêu thích'}
function toggleWatchFavorite(){if(!currentDetail)return;let list=favoriteSlugs().filter(x=>x!==currentDetail.slug);if(!favoriteSlugs().includes(currentDetail.slug))list.unshift(currentDetail.slug);localStorage.setItem('kenflix_favorites',JSON.stringify(list));updateFavoriteButton()}

function destroyPreparedPlayer(){
 if(!preparedPlayer)return;
 try{preparedPlayer.video?.pause()}catch{}
 try{preparedPlayer.hls?.destroy()}catch{}
 try{preparedPlayer.video?.remove()}catch{}
 preparedPlayer=null;
}

function prepareEpisodePlayer(movie,serverIndex=0,episodeIndex=0){
 if(!movie?.slug)return null;
 const ep=movie?.episodes?.[serverIndex]?.server_data?.[episodeIndex];
 if(!ep?.link_m3u8)return null;

 if(preparedPlayer &&
    preparedPlayer.slug===movie.slug &&
    preparedPlayer.serverIndex===Number(serverIndex) &&
    preparedPlayer.episodeIndex===Number(episodeIndex)){
  return preparedPlayer;
 }

 destroyPreparedPlayer();

 const v=document.createElement('video');
 v.controls=true;
 v.playsInline=true;
 v.preload='auto';
 v.setAttribute('playsinline','');
 v.setAttribute('webkit-playsinline','');
 v.style.position='fixed';
 v.style.left='-10px';
 v.style.top='-10px';
 v.style.width='2px';
 v.style.height='2px';
 v.style.opacity='0.01';
 v.style.pointerEvents='none';
 v.style.zIndex='-1';
 document.body.appendChild(v);

 const p={
  slug:movie.slug,
  serverIndex:Number(serverIndex)||0,
  episodeIndex:Number(episodeIndex)||0,
  video:v,
  hls:null,
  ready:false,
  mounted:false,
  failed:false,
  fallback:ep.link_embed||''
 };

 if(v.canPlayType('application/vnd.apple.mpegurl')){
  v.src=ep.link_m3u8;
  v.load();
  v.addEventListener('canplay',()=>{p.ready=true},{once:true});
  v.addEventListener('error',()=>{
   p.failed=true;
   if(p.mounted&&p.fallback){
    try{v.pause()}catch{}
    playEmbed($('#playerWrap'),p.fallback,true);
   }
  });
 }else if(window.Hls&&Hls.isSupported()){
  const ph=new Hls({enableWorker:true,startLevel:-1});
  p.hls=ph;
  ph.attachMedia(v);
  ph.on(Hls.Events.MEDIA_ATTACHED,()=>ph.loadSource(ep.link_m3u8));
  ph.on(Hls.Events.MANIFEST_PARSED,()=>{p.ready=true});
  ph.on(Hls.Events.ERROR,(ev,data)=>{
   if(!data?.fatal)return;
   p.failed=true;
   if(p.mounted&&p.fallback){
    try{ph.destroy()}catch{}
    if(hls===ph)hls=null;
    playEmbed($('#playerWrap'),p.fallback,true);
   }
  });
 }else{
  v.remove();
  return null;
 }

 preparedPlayer=p;
 return p;
}

function claimPreparedPlayer(movie,serverIndex,episodeIndex){
 if(!preparedPlayer || !movie?.slug)return null;
 if(preparedPlayer.slug!==movie.slug ||
    preparedPlayer.serverIndex!==Number(serverIndex) ||
    preparedPlayer.episodeIndex!==Number(episodeIndex))return null;
 const p=preparedPlayer;
 preparedPlayer=null;
 return p;
}

function startPreparedFromGesture(p){
 if(!p?.video)return;
 const v=p.video;
 v.muted=false;
 v.removeAttribute('muted');
 const promise=v.play();
 if(promise?.catch){
  promise.catch(()=>{
   const retry=()=>v.play().catch(()=>{});
   if(v.readyState>=2)retry();
   else v.addEventListener('canplay',retry,{once:true});
  });
 }
}

function mountPreparedPlayer(p,savedProgress=0){
 const wrap=$('#playerWrap');
 if(!wrap||!p?.video)return false;
 const v=p.video;
 p.mounted=true;

 if(p.failed&&p.fallback){
  try{p.hls?.destroy()}catch{}
  try{v.remove()}catch{}
  playEmbed(wrap,p.fallback,true);
  return true;
 }

 hls=p.hls||null;
 wrap.innerHTML='';
 v.style.position='';
 v.style.left='';
 v.style.top='';
 v.style.width='100%';
 v.style.height='100%';
 v.style.opacity='';
 v.style.pointerEvents='';
 v.style.zIndex='';
 wrap.appendChild(v);

 if(savedProgress>0&&savedProgress<98){
  const seek=()=>{
   if(isFinite(v.duration)&&v.duration>0){
    try{v.currentTime=v.duration*savedProgress/100}catch{}
   }
  };
  if(v.readyState>=1)seek(); else v.addEventListener('loadedmetadata',seek,{once:true});
 }

 v.addEventListener('timeupdate',()=>{
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{
   if(v.duration>0)saveContinue(currentDetail,currentServer,currentEpisode,(v.currentTime/v.duration)*100)
  },800)
 });
 v.addEventListener('ended',()=>{
  saveContinue(currentDetail,currentServer,currentEpisode,100);
  nextEpisode(true)
 });

 if(v.paused)v.play().catch(()=>{});

 // Chuẩn bị sẵn tập kế tiếp nhưng không làm ảnh hưởng player đang chạy.
 const eps=currentDetail?.episodes?.[currentServer]?.server_data||[];
 if(currentEpisode+1<eps.length){
  setTimeout(()=>{
   if(!preparedPlayer)prepareEpisodePlayer(currentDetail,currentServer,currentEpisode+1);
  },1200);
 }
 return true;
}

function openWatchFromDetail(serverIndex=0,episodeIndex=0){
 if(currentDetail?.slug && currentDetail?.episodes?.length){
  const prepared=claimPreparedPlayer(currentDetail,serverIndex,episodeIndex);

  // play() xảy ra ngay trong cú tap, trước khi đổi URL/giao diện
  if(prepared)startPreparedFromGesture(prepared);

  const url=sitePath(`/watch/${encodeURIComponent(currentDetail.slug)}?s=${serverIndex}&e=${episodeIndex}`);
  history.pushState(null,'',url);
  renderWatchPage(currentDetail,serverIndex,episodeIndex,true,prepared);
  return;
 }
 if(currentDetail?.slug){
  navigate(`/watch/${encodeURIComponent(currentDetail.slug)}?s=${serverIndex}&e=${episodeIndex}`);
 }
}

function renderWatchPage(m,serverIndex=0,episodeIndex=0,fromUserGesture=false,prepared=null){
 destroyPlayer();
 currentDetail=m;
 const servers=m.episodes||[];
 if(!servers.length)throw new Error('Phim này chưa có nguồn phát');

 currentServer=Math.min(Math.max(0,Number(serverIndex)||0),servers.length-1);
 const eps=servers[currentServer]?.server_data||[];
 currentEpisode=Math.min(Math.max(0,Number(episodeIndex)||0),Math.max(0,eps.length-1));

 const epLabel=prettyEpisodeName(eps[currentEpisode],currentEpisode);
 const originLine=[m.origin_name,m.year].filter(Boolean).join(' · ');

 app.innerHTML=`<div class="watch watch-cinema">
   <div class="watch-topbar">
     <div class="watch-top-left"><a class="watch-back" href="${sitePath('/')}" aria-label="Trang chủ">←</a><strong id="watchTopTitle">${esc(m.name||'')} · ${esc(epLabel)}</strong></div>
     <button class="watch-favorite" id="watchFavorite" onclick="toggleWatchFavorite()" aria-label="Yêu thích">♡</button>
   </div>
   <div class="watch-layout">
     <section class="watch-main">
       <div class="player-wrap" id="playerWrap"></div>
       <div class="watch-bottom-bar">
         <h2 id="watchEpisodeTitle">${esc(epLabel)} · ${esc(m.name||'')}</h2>
         <div class="watch-episode-nav">
           <button id="prevEpisodeBtn" onpointerdown="prepareAdjacentEpisode(-1)" onclick="prevEpisodeFromTap()">← Tập trước</button>
           <button id="nextEpisodeBtn" onpointerdown="prepareAdjacentEpisode(1)" onclick="nextEpisodeFromTap()">Tập tiếp →</button>
         </div>
       </div>
     </section>
     <aside class="watch-sidebar">
       <div class="watch-side-head">
         <h2>${esc(m.name||'')}</h2>
         <div class="watch-origin">${esc(originLine)}</div>
         <div class="watch-side-badges">${m.lang?`<span class="watch-badge green">${esc(m.lang)}</span>`:''}${m.quality?`<span class="watch-badge">${esc(m.quality)}</span>`:''}</div>
       </div>
       <div class="watch-side-divider"></div>
       <div class="episode-search"><input type="search" placeholder="Tìm tập... (vd: 5, 12)" oninput="filterEpisodes(this.value)"></div>
       <div class="server-tabs" id="servers"></div>
       <div class="episode-list" id="episodes"></div>
     </aside>
   </div>
 </div>`;

 renderServers();
 renderEpisodes();
 updateFavoriteButton();

 if(prepared?.video){
  const continueItem=getContinue().find(x=>x.slug===currentDetail.slug);
  const savedProgress=(continueItem&&continueItem.serverIndex===currentServer&&continueItem.episodeIndex===currentEpisode)?Number(continueItem.progress||0):0;
  mountPreparedPlayer(prepared,savedProgress);
  saveContinue(currentDetail,currentServer,currentEpisode,savedProgress);
  history.replaceState(null,'',sitePath(`/watch/${encodeURIComponent(currentDetail.slug)}?s=${currentServer}&e=${currentEpisode}`));
 }else{
  playEpisode(currentServer,currentEpisode,true,fromUserGesture);
 }
}

async function watchPage(slug,serverIndex=0,episodeIndex=0){
 // Nếu vừa đi từ trang chi tiết, không gọi API lại: giữ nguyên user gesture để autoplay.
 if(currentDetail?.slug===slug && currentDetail?.episodes?.length){
  try{
   renderWatchPage(currentDetail,serverIndex,episodeIndex,false);
   return;
  }catch{}
 }

 app.innerHTML='<div class="page-loading">Đang mở phim...</div>';
 destroyPlayer();

 try{
  const j=await api({action:'detail',slug});
  const m=j?.data?.item||j?.movie||j?.item||{};
  renderWatchPage(m,serverIndex,episodeIndex,false);
 }catch(e){
  app.innerHTML=`<div class="error-page"><h2>Không mở được phim</h2><p>${esc(e.message)}</p><a class="btn secondary" href="${sitePath('/')}">Về trang chủ</a></div>`;
 }
}
function renderServers(){
 const box=$('#servers');if(!box)return;const servers=currentDetail?.episodes||[];
 box.innerHTML=servers.map((s,i)=>`<button class="server-btn ${i===currentServer?'active':''}" onpointerdown="prepareEpisodePlayer(currentDetail,${i},0)" onclick="changeServerFromTap(${i})">${esc(s.server_name||`Server ${i+1}`)}</button>`).join('')
}
function renderEpisodes(){
 const box=$('#episodes');if(!box)return;const eps=currentDetail?.episodes?.[currentServer]?.server_data||[];
 box.innerHTML=eps.map((e,i)=>{const label=prettyEpisodeName(e,i);return `<button class="episode-btn ${i===currentEpisode?'active':''}" data-search="${esc((label+' '+(e.name||'')+' '+(i+1)).toLowerCase())}" onpointerdown="prepareEpisodePlayer(currentDetail,${currentServer},${i})" onclick="playEpisodeFromTap(${currentServer},${i})">${esc(label)}</button>`}).join('');
}
function playEpisodeFromTap(serverIndex,episodeIndex){
 serverIndex=Number(serverIndex)||0;
 episodeIndex=Number(episodeIndex)||0;

 // pointerdown đã bắt đầu tải; click gọi play() ngay trong user gesture.
 let p=claimPreparedPlayer(currentDetail,serverIndex,episodeIndex);
 if(!p){
  prepareEpisodePlayer(currentDetail,serverIndex,episodeIndex);
  p=claimPreparedPlayer(currentDetail,serverIndex,episodeIndex);
 }

 if(p)startPreparedFromGesture(p);

 currentServer=serverIndex;
 currentEpisode=episodeIndex;

 // Dừng player cũ SAU KHI đã gọi play() trên player mới.
 destroyPlayer();

 renderServers();
 renderEpisodes();
 updateWatchLabels();
 updateFavoriteButton();

 const continueItem=getContinue().find(x=>x.slug===currentDetail.slug);
 const savedProgress=(continueItem&&continueItem.serverIndex===currentServer&&continueItem.episodeIndex===currentEpisode)
  ?Number(continueItem.progress||0):0;

 if(p?.video){
  mountPreparedPlayer(p,savedProgress);
 }else{
  // Không có m3u8/preload thì dùng luồng thường nhưng vẫn đánh dấu là user gesture.
  playEpisode(currentServer,currentEpisode,true,true);
  return;
 }

 saveContinue(currentDetail,currentServer,currentEpisode,savedProgress);
 history.replaceState(null,'',sitePath(`/watch/${encodeURIComponent(currentDetail.slug)}?s=${currentServer}&e=${currentEpisode}`));
}

function changeServerFromTap(i){
 playEpisodeFromTap(Number(i)||0,0);
}

function changeServer(i){
 currentServer=i;
 currentEpisode=0;
 renderServers();
 renderEpisodes();
 playEpisode(i,0);
}
function episode(){return currentDetail?.episodes?.[currentServer]?.server_data?.[currentEpisode]||null}
function setPlayerMode(mode){currentPlayer=mode;playEpisode(currentServer,currentEpisode)}
function playEpisode(s,e,initial=false,fromUserGesture=false){
 currentServer=s;currentEpisode=e;renderServers();renderEpisodes();updateWatchLabels();const ep=episode();if(!ep)return;
 const wrap=$('#playerWrap');if(!wrap)return;destroyPlayer();
 const continueItem=getContinue().find(x=>x.slug===currentDetail.slug);
 const savedProgress=(continueItem&&continueItem.serverIndex===s&&continueItem.episodeIndex===e)?Number(continueItem.progress||0):0;
 const useEmbed=currentPlayer==='embed';
 const useHls=currentPlayer==='hls'||(currentPlayer==='auto'&&!!ep.link_m3u8);

 if(useHls&&ep.link_m3u8){
  playHls(wrap,ep,savedProgress,ep.link_embed,fromUserGesture);
 }else if(useEmbed&&ep.link_embed){
  playEmbed(wrap,ep.link_embed,true);
 }else if(ep.link_m3u8){
  playHls(wrap,ep,savedProgress,ep.link_embed,fromUserGesture);
 }else if(ep.link_embed){
  playEmbed(wrap,ep.link_embed,true);
 }else{
  wrap.innerHTML='<div class="player-error">Tập này chưa có link phát.</div>';
 }
 saveContinue(currentDetail,s,e,savedProgress);
 history.replaceState(null,'',sitePath(`/watch/${encodeURIComponent(currentDetail.slug)}?s=${s}&e=${e}`));
}
function isMobilePlayback(){
 return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints>1 && /Macintosh/i.test(navigator.userAgent));
}
function showUnmuteButton(v){
 const wrap=$('#playerWrap');if(!wrap||!v||!v.muted)return;
 let btn=$('#mobileUnmute');
 if(!btn){
  btn=document.createElement('button');
  btn.id='mobileUnmute';
  btn.className='mobile-unmute';
  btn.type='button';
  btn.innerHTML='🔊 Bật tiếng';
  wrap.appendChild(btn);
 }
 btn.onclick=async()=>{
  try{
   v.muted=false;
   v.removeAttribute('muted');
   await v.play().catch(()=>{});
   btn.remove();
  }catch{}
 };
}
async function startVideoPlayback(v,allowMutedFallback=true){
 if(!v)return false;

 try{
  v.muted=false;
  v.removeAttribute('muted');
  await v.play();
  const old=$('#mobileUnmute');if(old)old.remove();
  return true;
 }catch(err){
  // NotSupported/Abort thường do source chưa sẵn sàng: không vội ép mute.
  const blocked=err?.name==='NotAllowedError';
  if(!(allowMutedFallback && blocked && isMobilePlayback()))return false;
 }

 try{
  v.muted=true;
  v.setAttribute('muted','');
  await v.play();
  showUnmuteButton(v);
  return true;
 }catch{
  return false;
 }
}
function playEmbed(wrap,url,autoplay=true){
 let src=url;
 try{
  const u=new URL(url,location.href);

  if(autoplay){
   // Các player khác nhau dùng tên tham số khác nhau; gửi các dạng phổ biến.
   u.searchParams.set('autoplay','1');
   u.searchParams.set('autostart','1');
   u.searchParams.set('autoPlay','1');
  }

  // Không thêm muted: Kenflix ưu tiên autoplay có tiếng.
  src=u.toString();
 }catch{}

 wrap.innerHTML='';
 const iframe=document.createElement('iframe');
 iframe.src=src;
 iframe.allow='autoplay; fullscreen; picture-in-picture; encrypted-media';
 iframe.allowFullscreen=true;
 iframe.setAttribute('webkitallowfullscreen','true');
 iframe.setAttribute('mozallowfullscreen','true');
 iframe.setAttribute('referrerpolicy','origin');
 iframe.setAttribute('loading','eager');
 iframe.setAttribute('fetchpriority','high');
 wrap.appendChild(iframe);
}
function playHls(wrap,url,savedProgress,fallback,fromUserGesture=false){
 const v=document.createElement('video');
 v.controls=true;
 v.autoplay=true;
 v.playsInline=true;
 v.preload='auto';
 v.setAttribute('playsinline','');
 v.setAttribute('webkit-playsinline','');
 wrap.innerHTML='';
 wrap.appendChild(v);
 let loaded=()=>{if(savedProgress>0&&savedProgress<98&&isFinite(v.duration)&&v.duration>0){try{v.currentTime=v.duration*savedProgress/100}catch{}}};
 v.addEventListener('loadedmetadata',loaded,{once:true});
 v.addEventListener('timeupdate',()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(v.duration>0)saveContinue(currentDetail,currentServer,currentEpisode,(v.currentTime/v.duration)*100)},800)});
 v.addEventListener('ended',()=>{saveContinue(currentDetail,currentServer,currentEpisode,100);nextEpisode(true)});
 v.addEventListener('error',()=>{if(fallback){playEmbed(wrap,fallback,true)}});
 if(v.canPlayType('application/vnd.apple.mpegurl')){
  v.src=url;
  // Quan trọng: gọi play ngay trong cú chạm trước khi user activation hết hạn.
  if(fromUserGesture)startVideoPlayback(v,true);
  v.addEventListener('loadedmetadata',()=>startVideoPlayback(v,true),{once:true});
  if(!fromUserGesture)startVideoPlayback(v,true);
 }
 else if(window.Hls&&Hls.isSupported()){
  hls=new Hls({enableWorker:true});
  hls.loadSource(url);
  hls.attachMedia(v);

  // Android + hls.js: thử play ngay trong gesture; khi manifest sẵn sàng thử lại.
  if(fromUserGesture)startVideoPlayback(v,false);
  hls.on(Hls.Events.MANIFEST_PARSED,()=>startVideoPlayback(v,true));
  hls.on(Hls.Events.ERROR,(ev,data)=>{if(data.fatal&&fallback){destroyPlayer();playEmbed(wrap,fallback)}})
 }
 else if(fallback)playEmbed(wrap,fallback);else wrap.innerHTML='<div class="player-error">Trình duyệt không hỗ trợ HLS.</div>'
}
function destroyPlayer(){clearTimeout(saveTimer);if(hls){try{hls.destroy()}catch{}hls=null}const v=$('#playerWrap video');if(v){try{v.pause()}catch{}}}
function prepareAdjacentEpisode(step){
 const eps=currentDetail?.episodes?.[currentServer]?.server_data||[];
 const target=currentEpisode+Number(step||0);
 if(target>=0&&target<eps.length)prepareEpisodePlayer(currentDetail,currentServer,target);
}
function nextEpisodeFromTap(){
 const eps=currentDetail?.episodes?.[currentServer]?.server_data||[];
 if(currentEpisode+1<eps.length)playEpisodeFromTap(currentServer,currentEpisode+1);
 else toast('Đã là tập cuối');
}
function prevEpisodeFromTap(){
 if(currentEpisode>0)playEpisodeFromTap(currentServer,currentEpisode-1);
 else toast('Đây là tập đầu');
}
function nextEpisode(auto=false){
 const eps=currentDetail?.episodes?.[currentServer]?.server_data||[];
 if(currentEpisode+1<eps.length){
  playEpisode(currentServer,currentEpisode+1);
  if(auto)toast('Đang phát tập tiếp theo')
 }else toast('Đã là tập cuối')
}
function prevEpisode(){
 if(currentEpisode>0)playEpisode(currentServer,currentEpisode-1);
 else toast('Đây là tập đầu')
}

function route(){
 closeModal();destroyPlayer();window.scrollTo(0,0);
 let path=location.pathname; if(BASE_PATH&&path.startsWith(BASE_PATH))path=path.slice(BASE_PATH.length); path=path.replace(/^\/+|\/+$/g,''); const parts=path.split('/').filter(Boolean);const params=new URLSearchParams(location.search);const page=Math.max(1,Number(params.get('page')||1));
 $('#nav').classList.remove('show');$$('.dropdown-menu').forEach(x=>x.classList.remove('show'));
 if(!parts.length)return home();
 if(parts[0]==='list'&&parts[1])return listing('list',decodeURIComponent(parts[1]),page);
 if(parts[0]==='genre'&&parts[1])return listing('genre',decodeURIComponent(parts[1]),page);
 if(parts[0]==='country'&&parts[1])return listing('country',decodeURIComponent(parts[1]),page);
 if(parts[0]==='search'&&parts[1]){const k=decodeURIComponent(parts.slice(1).join('/'));$('#searchInput').value=k;return searchPage(k,page)}
 if(parts[0]==='phim'&&parts[1])return detailPage(decodeURIComponent(parts[1]));
 if(parts[0]==='watch'&&parts[1])return watchPage(decodeURIComponent(parts[1]),Number(params.get('s')||0),Number(params.get('e')||0));
 home();
}
window.addEventListener('popstate',route);window.addEventListener('load',route);
window.addEventListener('scroll',()=>$('#header').classList.toggle('scrolled',scrollY>30));
$('#searchForm').addEventListener('submit',e=>{e.preventDefault();const k=$('#searchInput').value.trim();if(k)navigate('/search/'+encodeURIComponent(k))});
document.addEventListener('click',e=>{
 const a=e.target.closest('a[href]');
 if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target==='_blank'||a.hasAttribute('download'))return;
 const url=new URL(a.href,location.href);
 if(url.origin!==location.origin)return;
 if(BASE_PATH && !(url.pathname===BASE_PATH || url.pathname.startsWith(BASE_PATH+'/')))return;
 e.preventDefault();
 history.pushState(null,'',url.pathname+url.search);
 route();
});
$('#menuBtn').onclick=()=>$('#nav').classList.toggle('show');
$$('.dropdown-btn').forEach(btn=>btn.addEventListener('click',e=>{
 e.stopPropagation();
 const menu=$('#'+btn.dataset.menu);
 $$('.dropdown-menu').forEach(x=>{if(x!==menu)x.classList.remove('show')});
 menu?.classList.toggle('show');
}));
document.addEventListener('click',e=>{
 if(!e.target.closest('.dropdown-menu')&&!e.target.closest('.dropdown-btn'))$$('.dropdown-menu').forEach(x=>x.classList.remove('show'));
});
