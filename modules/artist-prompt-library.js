/*
 * 移植自使用者提供的 NAI畫師串庫 V7.3｜修正懸浮球誤觸。
 * 保留原始功能與原 nai_saver IndexedDB 資料庫；僅增加個人酒館助手的啟動入口。
 */
(()=>{try{
const W=window.parent,D=W.document,ID='nai-saver-root';
D.getElementById(ID)?.remove();D.getElementById(ID+'-css')?.remove();
const CFG={},LS={getItem:k=>(k in CFG?CFG[k]:W.localStorage.getItem(k)),setItem:(k,v)=>{try{W.localStorage.setItem(k,v)}catch(e){}CFG[k]=String(v);clearTimeout(LS.t);LS.t=setTimeout(()=>dbPut({id:'meta-settings',kind:'meta',cfg:CFG}),400)}},g=s=>D.getElementById(s);
const S={layout:LS.getItem('nai_layout')||'2',filter:'all',q:'',sel:null,sopen:false,fs:false,tab:LS.getItem('nai_tab')||'a',notes:[],curN:null,tag:null,tagSel:[],mf:null,shown:0,page:1,pageSize:20,vl:[],qt:0,nc:new Map(),sort:LS.getItem('nai_sort')||'def',tagMode:LS.getItem('nai_tagmode')||'and',tagList:[],autoTag:LS.getItem('nai_autotag')!=='0',skipDup:LS.getItem('nai_dupskip')!=='0',items:[],cur:null,fmode:'add',b:[],sh:[]};
const F=['steps','cfg','sampler','seed','size'],FL=['步數','CFG','採樣器','Seed','尺寸'];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const blankN=()=>({id:uid(),kind:'note',name:'',text:'',fav:0,t:Date.now()});
const blank=()=>({id:uid(),tags:[],name:'',pos:'',neg:'',steps:'',cfg:'',sampler:'',seed:'',size:'',thumb:'',fav:0,t:Date.now()});
// ---------- storage (IndexedDB) ----------
const db=new Promise((res,rej)=>{const r=W.indexedDB.open('nai_saver',1);r.onupgradeneeded=()=>r.result.createObjectStore('i',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const tx=async(m,f)=>{const d=await db;return new Promise((res,rej)=>{const t=d.transaction('i',m);const o=f(t.objectStore('i'));t.oncomplete=()=>res(o&&o.result);t.onerror=()=>rej(t.error)})};
const dbAll=()=>tx('readonly',s=>s.getAll()),dbPut=it=>tx('readwrite',s=>s.put(it)),dbDel=id=>tx('readwrite',s=>s.delete(id));
// ---------- image / PNG ----------
const toThumb=f=>new Promise(res=>{const u=W.URL.createObjectURL(f),im=new W.Image();let done=false;const finish=v=>{if(done)return;done=true;try{W.URL.revokeObjectURL(u)}catch(e){}im.onload=im.onerror=null;res(v)};im.onload=()=>{try{const w=im.naturalWidth||im.width,h=im.naturalHeight||im.height,k=Math.min(1,480/Math.max(w,h)),c=D.createElement('canvas');c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(h*k));const x=c.getContext('2d');if(!x)throw Error('Canvas 不可用');x.drawImage(im,0,0,c.width,c.height);const out=c.toDataURL('image/jpeg',.8);c.width=c.height=0;finish({thumb:out,w,h})}catch(e){finish({thumb:'',w:0,h:0})}};im.onerror=()=>finish({thumb:'',w:0,h:0});im.src=u});
const inflate=async b=>new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate'))).text();
async function pngText(buf){const v=new DataView(buf),u=new Uint8Array(buf),o={};if(u.length<8||v.getUint32(0)!==0x89504e47)return null;let p=8;
while(p<u.length-8){const n=v.getUint32(p),t=String.fromCharCode(u[p+4],u[p+5],u[p+6],u[p+7]),d=u.subarray(p+8,p+8+n);
try{if(t==='tEXt'){const z=d.indexOf(0);o[new TextDecoder('latin1').decode(d.subarray(0,z))]=new TextDecoder().decode(d.subarray(z+1))}
else if(t==='zTXt'){const z=d.indexOf(0);o[new TextDecoder('latin1').decode(d.subarray(0,z))]=await inflate(d.subarray(z+2))}
else if(t==='iTXt'){const z=d.indexOf(0),k=new TextDecoder().decode(d.subarray(0,z)),cf=d[z+1];let q=d.indexOf(0,z+3)+1;q=d.indexOf(0,q)+1;const tx=d.subarray(q);o[k]=cf?await inflate(tx):new TextDecoder().decode(tx)}}catch(e){}
if(t==='IEND')break;p+=12+n}return o}
async function stealth(f){const bmp=await createImageBitmap(f),WD=bmp.width,HT=bmp.height;if(WD*HT>16e6){bmp.close();return null}
const c=D.createElement('canvas');c.width=WD;c.height=HT;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(bmp,0,0);bmp.close();
try{const by=[];let cur=0,nb=0,need=19;
for(let X=0;X<WD;X++){const col=x.getImageData(X,0,1,HT).data;for(let Y=0;Y<HT;Y++){cur=(cur<<1)|(col[Y*4+3]&1);
if(++nb===8){by.push(cur);cur=0;nb=0;
if(by.length===19){if(String.fromCharCode(...by.slice(0,15))!=='stealth_pngcomp')return null;
need=19+Math.ceil(((by[15]<<24|by[16]<<16|by[17]<<8|by[18])>>>0)/8)}
if(by.length>=need){const ds=new DecompressionStream('gzip');return await new Response(new Blob([new Uint8Array(by.slice(19,need))]).stream().pipeThrough(ds)).text()}}}}
return null}finally{c.width=c.height=0}}
const fromC=c=>({pos:c.prompt||c.v4_prompt?.caption?.base_caption||'',neg:c.uc||c.v4_negative_prompt?.caption?.base_caption||'',steps:c.steps||'',cfg:c.scale??'',sampler:c.sampler||'',seed:c.seed??'',size:(c.width&&c.height)?c.width+'x'+c.height:''});
function fromA(s){const i=s.lastIndexOf('\nSteps:'),head=i<0?s:s.slice(0,i),tail=i<0?'':s.slice(i+1),j=head.indexOf('\nNegative prompt:');
const k=n=>(tail.match(new RegExp(n+': ?([^,]+)'))||[])[1]||'';
return{pos:(j<0?head:head.slice(0,j)).trim(),neg:j<0?'':head.slice(j+17).trim(),steps:k('Steps'),cfg:k('CFG scale'),sampler:k('Sampler'),seed:k('Seed'),size:k('Size')}}
async function readMeta(f){const h=new Uint8Array(await f.slice(0,12).arrayBuffer()),isPng=h[0]===0x89&&h[1]===0x50,isJpg=h[0]===0xff&&h[1]===0xd8;
let c=null,a=null,desc='',srcTxt='';
if(isPng){try{const t=await pngText(await f.arrayBuffer());if(t){desc=t.Description||'';srcTxt=t.Source||'';if(t.Comment)c=JSON.parse(t.Comment);if(t.parameters)a=fromA(t.parameters)}}catch(e){}}
if(!c&&!a&&!isJpg){try{const s=await stealth(f);if(s){const o=JSON.parse(s);desc=o.Description||desc;srcTxt=o.Source||srcTxt;c=typeof o.Comment==='string'?JSON.parse(o.Comment):(o.Comment||o)}}catch(e){}}
let md={};if(c)md=fromC(c);else if(a)md=a;if(!md.pos&&desc)md.pos=desc;{const mm=srcModel(srcTxt);if(mm){md.models=[mm];md.mfrom='png'}}
const why=md.pos?'':isJpg?'JPG 不含生成資料':isPng?'PNG 裡沒找到 NAI/SD 資料（可能被轉檔、壓縮或傳輸時清掉）':'不是 PNG（WebP 等格式通常沒有資料）';
return{md,why}}
// ---------- helpers ----------
const root=D.createElement('div');root.id=ID;
function toast(s){const e=D.createElement('div');e.className='ns-toast';e.textContent=s;root.appendChild(e);setTimeout(()=>e.remove(),1600)}
async function copy(s){try{await W.navigator.clipboard.writeText(s)}catch(e){const a=D.createElement('textarea');a.value=s;D.body.appendChild(a);a.select();D.execCommand('copy');a.remove()}toast('已複製')}
function dl(n,o){const a=D.createElement('a');a.href=W.URL.createObjectURL(new W.Blob([JSON.stringify(o)],{type:'application/json'}));a.download=n;D.body.appendChild(a);a.click();a.remove()}
function lastMsg(){try{const m=getChatMessages(-1);if(m&&m[0])return m[0].message}catch(e){}const a=D.querySelectorAll('#chat .mes .mes_text');return a.length?a[a.length-1].innerText:''}
function parseBatch(t){t=t.replace(/<br\s*\/?>/gi,'\n').replace(/\*\*/g,'');const out=[];let cur=null;
for(const ln of t.split('\n')){const m=ln.match(/^\s*#*\s*\d+\s*[.、)）]\s*[【\[](.+?)[】\]]/);if(m){cur={name:m[1].trim(),l:[]};out.push(cur)}else if(cur)cur.l.push(ln)}
return out.map(o=>({name:o.name,pos:o.l.join('\n').trim().replace(/[,，]\s*$/,''),on:true})).filter(o=>o.pos)}
const normKey=s=>[...new Set(String(s||'').replace(/[，、；;]/g,',').replace(/\s+/g,' ').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean))].sort().join(',');
const keyMap=()=>{const m=new Map();S.items.forEach(i=>{const k=normKey(i.pos);if(k&&!m.has(k))m.set(k,i)});return m};
function markDup(l){const km=keyMap(),seen=new Map();l.forEach(o=>{const k=normKey(o.pos),ex=k&&(km.get(k)||seen.get(k));o.dup=ex?ex.name:'';o.on=!ex;if(k&&!ex)seen.set(k,o)})}
function dupGroups(){const nt=S.tab==='n',mp=new Map();(nt?S.notes:S.items).forEach(it=>{const k=normKey(nt?it.text:it.pos);if(!k)return;if(!mp.has(k))mp.set(k,[]);mp.get(k).push(it)});
return[...mp.values()].filter(a=>a.length>1).map(a=>a.sort((x,y)=>(y.fav|0)-(x.fav|0)||(!!y.thumb-!!x.thumb)||x.t-y.t))}
function dupModal(){const gs=dupGroups(),m=openM();S.dg=gs;
if(!gs.length){m.innerHTML=`<div class=ns-m><div class=ns-h><b>檢測重複</b><span class=ns-sp></span><button data-a=mclose>✕</button></div><div class=ns-e>沒有發現重複</div></div>`;return}
m.innerHTML=`<div class=ns-m><div class=ns-h><b>檢測重複：${gs.length} 組</b><span class=ns-sp></span><button data-a=mclose>✕</button></div><div class=ns-sum>標準是「標籤內容相同」，順序不同也算。每組預設保留第一筆（收藏優先、有圖優先、較早建立），其餘已勾選。</div>${gs.map(a=>`<div class=ns-dg>${a.map((it,j)=>`<label class=ns-bi><input type=checkbox data-dd="${it.id}" ${j?'checked':''}>${it.thumb?`<img class=ns-dt src="${it.thumb}">`:''}<span><b>${j?'':'保留・'}${esc(it.name||'未命名')}${it.fav?' ★':''}</b><small>${esc((it.pos||it.text||'').slice(0,60))}</small></span></label>`).join('')}</div>`).join('')}<button class=ns-w data-a=dd-del>刪除勾選的項目</button></div>`}
async function sendIp(p){let ctx,cfg;try{ctx=W.SillyTavern.getContext();cfg=ctx.extensionSettings.stTtsDialogue.draw}catch(e){}
const st=cfg&&cfg.styles;if(!Array.isArray(st))return toast('找不到 ST-iPhonie 的畫風預設');
const act=st.find(s=>s.id===cfg.activeStyle);let inh=false;
if(act&&(act.positive||act.negative))inh=W.confirm('固定正面／固定負面，要沿用 iPhonie 目前使用中畫風的內容嗎？\n確定＝沿用（負面以你自己的為優先）\n取消＝留空');
let add=0,sk=0;const have=new Set(st.map(s=>normKey(s.artist))),names=new Set(st.map(s=>s.name)),pg=g('ns-prog'),tok=S.ptok=uid(),N=p.length;
const draw=(d,fin)=>{if(S.ptok!==tok)return;const{w,h}=vp();pg.style.display='block';pg.style.left='10px';pg.style.width=(w-20)+'px';pg.style.top=(h-78)+'px';
pg.innerHTML=`<div class=ns-pt>${fin?'已送到 iPhonie':`送到 iPhonie ${d}/${N}`}　✓${add}${sk?`　＝略過 ${sk}`:''}${fin?'　請重新整理酒館頁面':''}</div><div class=ns-pb><i style="width:${N?d/N*100:0}%"></i></div>`};
draw(0);
for(let i=0;i<N;i++){const it=p[i],k=normKey(it.pos);
if(!k||have.has(k))sk++;else{const nm=it.name||'未命名';let n=nm,c=2;while(names.has(n))n=nm+' ('+(c++)+')';
st.push({id:W.crypto?.randomUUID?.()||uid()+uid()+uid(),name:n,artist:it.pos,positive:inh?(act.positive||''):'',negative:it.neg||(inh?(act.negative||''):'')});have.add(k);names.add(n);add++}
draw(i+1);await new Promise(r=>setTimeout(r,0))}
try{ctx.saveSettingsDebounced()}catch(e){}
draw(N,true);setTimeout(()=>{if(S.ptok===tok)pg.style.display='none'},7000)}
const HCSS='*{box-sizing:border-box}:root{--bg:#f6f3ea;--fg:#302d28;--bd:#c9c1b3;--sub:#81796e;--soft:#fffdf7}@media(prefers-color-scheme:dark){:root{--bg:#1e1f20;--fg:#e8e5dc;--bd:#48443f;--sub:#aaa397;--soft:#292827}}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 system-ui,sans-serif;background-image:repeating-linear-gradient(125deg,rgba(120,105,80,.025) 0px,rgba(120,105,80,.025) 1px,transparent 1px,transparent 5px)}header{position:sticky;top:0;background:var(--bg);padding:10px 12px;border-bottom:1px solid var(--bd);z-index:2;display:flex;flex-wrap:wrap;gap:8px;align-items:center}h1{font-size:18px;margin:0;flex:1 1 100%}.sec{padding:14px 12px 0;font-size:16px}header input{flex:1;min-width:140px;padding:8px;border:1px solid var(--bd);border-radius:8px;background:var(--soft);color:var(--fg);font-size:15px}button{border:1px solid var(--bd);background:var(--soft);color:var(--fg);border-radius:6px;padding:7px 11px;font-size:13px}button.on{background:var(--fg);color:var(--bg)}main{max-width:720px;margin:0 auto;padding:8px 12px 40px}.c{border:1px solid var(--bd);border-radius:12px;padding:10px;margin:12px 0}.c[hidden]{display:none}h2{font-size:16px;margin:0 0 8px}.b{border:1px solid var(--bd);border-radius:8px;background:var(--soft);margin:6px 0}.h{display:flex;justify-content:space-between;align-items:center;padding:4px 8px;color:var(--sub);font-size:12px}pre{margin:0;padding:6px 8px 8px;white-space:pre-wrap;word-break:break-all;font:13px/1.5 ui-monospace,monospace}details summary{color:var(--sub);font-size:13px;margin:6px 0}.m{color:var(--sub);font-size:12px;margin:6px 0}img{display:block;width:100%;max-width:480px;border-radius:10px;margin-top:8px}.tg{display:flex;gap:6px;overflow-x:auto;flex:1 1 100%}.tg button{white-space:nowrap;flex:none}';
const HJS=['var q=document.getElementById("q"),cs=[].slice.call(document.querySelectorAll(".c")),fav=false,tag="";',
'function ap(){var k=q.value.trim().toLowerCase();cs.forEach(function(c){c.hidden=(fav&&c.dataset.f!=="1")||(tag&&c.dataset.t.indexOf("|"+tag+"|")<0)||(k&&c.dataset.s.indexOf(k)<0)})}',
'q.oninput=ap;document.getElementById("fv").onclick=function(e){fav=!fav;e.target.classList.toggle("on",fav);ap()};',
'document.addEventListener("click",function(e){var g=e.target.closest(".tg button");if(g){tag=(tag===g.dataset.t)?"":g.dataset.t;[].forEach.call(document.querySelectorAll(".tg button"),function(x){x.classList.toggle("on",x.dataset.t===tag)});ap();return}',
'var b=e.target.closest(".h button");if(!b)return;var t=b.closest(".b").querySelector("pre").textContent;function fb(){var a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();document.execCommand("copy");a.remove()}',
'if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).catch(fb)}else fb();b.textContent="已複製";setTimeout(function(){b.textContent="複製"},1200)});'].join('\n');
function buildHtml(list,o,notes){const e=esc,d=new Date(),dt=`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`,SO='<scr'+'ipt>',SC='</scr'+'ipt>';
const meta=it=>{const a=[it.steps!==''&&it.steps!=null?'Steps '+it.steps:'',it.cfg!==''&&it.cfg!=null?'CFG '+it.cfg:'',it.sampler,it.seed!==''&&it.seed!=null?'Seed '+it.seed:'',it.size].filter(Boolean);return(a.length?`<p class=m>${e(a.join(' · '))}</p>`:'')+((it.tags||[]).length?`<p class=m>${e(it.tags.map(t=>'#'+t).join(' '))}</p>`:'')};
const mdlP=it=>{const r=modelOf(it);return r.m.length?`<p class=m>適用模型：${e(r.m.join('、'))}${r.from==='syntax'?'（推測）':''}</p>`:''};
const box=(lab,t)=>`<div class=b><div class=h><span>${lab}</span><button>複製</button></div><pre>${e(t)}</pre></div>`;
const tg=[...new Set(list.flatMap(i=>i.tags||[]))];
const P=[`<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NAI 畫師串筆記本</title><style>${HCSS}</style></head><body><header><h1>NAI 畫師串筆記本</h1><p class=m>${list.length} 筆 · ${dt}</p><input id=q placeholder="搜尋名稱或提示詞"><button id=fv>★ 只看收藏</button>${tg.length?`<div class=tg>${tg.map(t=>`<button data-t="${e(t)}">${e(t)}</button>`).join('')}</div>`:''}</header><main>`];
list.forEach(it=>P.push(`<section class=c data-s="${e(((it.name||'')+' '+(it.pos||'')+' '+(it.tags||[]).join(' ')).toLowerCase())}" data-t="${e('|'+(it.tags||[]).join('|')+'|')}" data-f="${it.fav?1:0}"><h2>${it.fav?'★ ':''}${e(it.name||'未命名')}</h2>${mdlP(it)}${box('正面',it.pos||'')}${o.neg&&it.neg?`<details><summary>負面</summary>${box('負面',it.neg)}</details>`:''}${meta(it)}${o.img&&it.thumb?`<img loading=lazy src="${it.thumb}" alt="">`:''}</section>`));
if(notes.length){P.push('<h1 class=sec>負面詞筆記</h1>');notes.forEach(n=>P.push(`<section class=c data-s="${e(((n.name||'')+' '+(n.text||'')).toLowerCase())}" data-f="${n.fav?1:0}" data-t=""><h2>${n.fav?'★ ':''}${e(n.name||'未命名')}</h2>${box('內容',n.text||'')}</section>`))}
P.push(`</main>${SO}${HJS}${SC}</body></html>`);return P}
function dlBlob(n,parts,type){const a=D.createElement('a'),u=W.URL.createObjectURL(new W.Blob(parts,{type:type+';charset=utf-8'}));a.href=u;a.download=n;D.body.appendChild(a);a.click();a.remove();setTimeout(()=>W.URL.revokeObjectURL(u),60000)}
function exList(){const b=S.ex.scope==='sel'&&S.sel?S.items.filter(x=>S.sel.has(x.id)):S.items;return b.slice().sort((x,y)=>(y.fav|0)-(x.fav|0)||y.t-x.t)}
function drawEx(){const m=g('ns-modal'),o=S.ex,l=exList(),wi=l.filter(x=>x.thumb).length,all=o.scope==='all';
let sz=l.reduce((a,x)=>a+(x.pos||'').length+(o.neg?(x.neg||'').length:0)+(o.img?(x.thumb||'').length:0),0);if(all&&o.notes)sz+=S.notes.reduce((a,n)=>a+(n.text||'').length,0);
const sw=(k,t)=>`<div class=ns-t><span>${t}</span><span class=ns-sp></span><button data-ex=${k} class="${o[k]?'on':''}">${o[k]?'含':'不含'}</button></div>`;
m.innerHTML=`<div class=ns-m><div class=ns-h><b>匯出 HTML 筆記本</b><span class=ns-sp></span><button data-a=mclose>✕</button></div><div class=ns-sum>${all?'全部':'已選取'} ${l.length} 筆，其中 ${wi} 筆有效果圖。預估檔案約 ${(sz/1048576).toFixed(1)} MB。</div>${sw('img','效果圖（每個串下方）')}${sw('neg','負面串')}${all&&S.notes.length?sw('notes','負面詞筆記（'+S.notes.length+' 則）'):''}<button class=ns-w data-a=ex-go>產生並下載</button><div class=ns-sum>單一 HTML 檔，手機瀏覽器直接開，不用解壓縮，離線也能看。效果圖是庫裡保存的縮圖，不是原圖。</div></div>`}
function exportModal(scope){S.ex=S.ex||{img:true,neg:true,notes:true};S.ex.scope=scope;openM();drawEx()}
const DICT=[['厚塗',/厚塗|impasto|thick ?paint/i],['水彩',/水彩|watercolor/i],['油畫',/油畫|油画|oil ?painting/i],['古風',/古風|古风|hanfu|chinese (?:clothes|style)/i],['韓系',/韓系|韩系|korean/i],['日系',/日系/],['二次元',/二次元/],['萌系',/萌/],['唯美',/唯美/],['清新',/清新/],['西歐',/西歐|西欧/],['賽博',/賽博|赛博|cyberpunk/i],['像素',/像素|pixel ?art/i],['寫實',/寫實|写实|photorealistic|realistic/i],['黑白',/黑白|monochrome|greyscale/i],['漫畫',/漫畫|漫画|manga|comic/i],['素描',/素描|sketch/i],['水墨',/水墨|ink wash|sumi-?e/i],['Q版',/q版|chibi/i],['氛圍',/氛圍|氛围/],['光影',/光影|rim light|backlight/i]];
const dictTags=it=>{const t=(it.name||'')+' '+(it.pos||'');return DICT.filter(d=>d[1].test(t)).map(d=>d[0])};
const extractArtists=s=>{const out=new Set(),re=/artist:\s*((?:[^,():\[\]{}|]|\([^()]*\))+)/gi;let m;while((m=re.exec(s||''))){const n=m[1].trim().toLowerCase().replace(/\s+/g,'_');if(n&&n.length<40&&!/^[\d.\-]+$/.test(n))out.add(n)}return[...out]};
const tagCounts=()=>{const c={};S.items.forEach(i=>(i.tags||[]).forEach(t=>c[t]=(c[t]||0)+1));return c};
const allTags=()=>{const c=tagCounts(),s=new Set([...S.tagList,...Object.keys(c)]);return[...s].sort((a,b)=>(c[b]||0)-(c[a]||0)||a.localeCompare(b))};
const addTagLib=t=>{if(t&&!S.tagList.includes(t)){S.tagList.push(t);return true}return false};
const saveTagList=()=>dbPut({id:'meta-tags',kind:'meta',list:S.tagList});
const addTagTo=(it,t)=>{t=(t||'').trim();if(!t)return;it.tags=it.tags||[];if(!it.tags.includes(t))it.tags.push(t)};
async function autoApply(it){if(!S.autoTag)return;it.tags=dictTags(it);let ch=false;it.tags.forEach(t=>{ch=addTagLib(t)||ch});if(ch)await saveTagList()}
const nFilters=()=>(S.filter==='fav'?1:0)+S.tagSel.length+(S.mf?1:0);
function drawFbar(){const b=g('ns-fbar'),n=nFilters(),mc=modelCounts(),c=tagCounts(),tags=allTags().slice(0,16);b.style.display='flex';
b.innerHTML=`<button data-a=flt class="${n?'on':''}">篩選${n?' '+n:''} ▾</button><button data-f="${S.filter==='fav'?'all':'fav'}" class="${S.filter==='fav'?'on':''}">★ 收藏</button>`+['4.5','5'].map(k=>`<button data-mf="${k}" class="${S.mf===k?'on':''}">${k}・${mc[k]}</button>`).join('')+(mc['?']?`<button data-mf="?" class="${S.mf==='?'?'on':''}">未判斷・${mc['?']}</button>`:'')+tags.map(t=>`<button data-tf="${esc(t)}" class="${S.tagSel.includes(t)?'on':''}">#${esc(t)}・${c[t]||0}</button>`).join('')}
function drawFbarN(){const b=g('ns-fbar');b.style.display='flex';b.innerHTML=`<button data-f="${S.filter==='fav'?'all':'fav'}" class="${S.filter==='fav'?'on':''}">★ 只看收藏</button><span class=ns-sp></span><small class=ns-cn>${S.notes.length} 則</small>`}
function drawFilter(){const m=g('ns-modal'),c=tagCounts(),mc=modelCounts();S.fs=true;
m.innerHTML=`<div class=ns-m><div class=ns-h><b>篩選與排序</b><span class=ns-sp></span><button data-a=mclose>✕</button></div><label>範圍</label><div class=ns-chips><button data-f=all class="${S.filter==='all'?'on':''}">全部</button><button data-f=fav class="${S.filter==='fav'?'on':''}">★ 收藏</button></div><label>適用模型</label><div class=ns-chips>${['4.5','5','?'].map(k=>`<button data-mf="${k}" class="${S.mf===k?'on':''}">${k==='?'?'未判斷':k}・${mc[k]}</button>`).join('')}</div><label>標籤${S.tagSel.length>1?`　<button data-a=tg-mode>${S.tagMode==='and'?'符合全部':'符合任一'}</button>`:''}</label><div class="ns-chips wrap">${allTags().map(t=>`<button data-tf="${esc(t)}" class="${S.tagSel.includes(t)?'on':''}">${esc(t)} ${c[t]||0}</button>`).join('')||'<small>還沒有標籤</small>'}<button data-a=tg-mng>＋管理</button></div><label>排序</label><button class=ns-w data-a=sort>${esc(SORTL[S.sort]||'預設')} ▾</button><div class=ns-t><button data-a=fclr>清除篩選</button><span class=ns-sp></span><button class=pri data-a=mclose>完成（${S.vl.length} 張）</button></div></div>`}
function openFilter(){openM();drawFilter()}
function drawDT(){drawM();const it=S.cur,cur=it.tags||[],sug=[...new Set([...dictTags(it),...allTags()])].filter(t=>!cur.includes(t)).slice(0,30);
g('d-tags').innerHTML=(cur.map(t=>`<button class=on data-dtr="${esc(t)}">${esc(t)} ✕</button>`).join('')||'<small>還沒有標籤</small>')+(sug.length?`<div class=ns-sug>${sug.map(t=>`<button data-dta="${esc(t)}">＋${esc(t)}</button>`).join('')}</div>`:'')}
function tagModal(){const m=openM(),c=tagCounts();
m.innerHTML=`<div class=ns-m><div class=ns-h><b>標籤管理</b><span class=ns-sp></span><button data-a=mclose>✕</button></div><div class=ns-t><input id=tg-new placeholder="新標籤名稱，可用逗號分開多個"><button data-a=tg-add>建立</button></div>${allTags().map(t=>`<div class=ns-r><span style="flex:1"><b>${esc(t)}</b><small>${c[t]||0} 筆</small></span><button data-trn="${esc(t)}">改名</button><button data-tdl="${esc(t)}">刪除</button></div>`).join('')||'<div class=ns-e>還沒有標籤</div>'}</div>`}
async function renameTag(t){const v=(W.prompt('改名為',t)||'').trim();if(!v||v===t)return;
for(const it of S.items)if((it.tags||[]).includes(t)){it.tags=[...new Set(it.tags.map(x=>x===t?v:x))];await dbPut(it)}
S.tagList=[...new Set(S.tagList.map(x=>x===t?v:x))];if(!S.tagList.includes(v))S.tagList.push(v);await saveTagList();S.tagSel=S.tagSel.map(x=>x===t?v:x);tagModal();render()}
async function deleteTag(t){if(!W.confirm(`刪除標籤「${t}」？只會移除標籤，不會刪除畫師串。`))return;
for(const it of S.items)if((it.tags||[]).includes(t)){it.tags=it.tags.filter(x=>x!==t);await dbPut(it)}
S.tagList=S.tagList.filter(x=>x!==t);await saveTagList();S.tagSel=S.tagSel.filter(x=>x!==t);tagModal();render()}
async function applyTag(p,t,on){for(const it of p){it.tags=it.tags||[];if(on)addTagTo(it,t);else it.tags=it.tags.filter(x=>x!==t);await dbPut(it)}if(on&&addTagLib(t))await saveTagList();render();toast(on?`已加上「${t}」`:`已移除「${t}」`)}
function autoSuggest(){const res=new Map(),add=(tag,src,it)=>{if(!res.has(tag))res.set(tag,{tag,src,ids:new Set()});res.get(tag).ids.add(it.id)};
S.items.forEach(it=>dictTags(it).forEach(t=>add(t,'關鍵字',it)));
const tm=new Map();S.items.forEach(it=>{new Set((it.name||'').split(/[\s　,，、._\-－—|｜\/（）()【】\[\]+＋·:：;；~～!！?？…]+/).filter(t=>t.length>=2&&t.length<=8&&!/^\d+$/.test(t))).forEach(t=>{if(!tm.has(t))tm.set(t,[]);tm.get(t).push(it)})});
tm.forEach((a,t)=>{if(a.length>=3)a.forEach(it=>add(t,'名稱共用詞',it))});
const am=new Map();S.items.forEach(it=>extractArtists(it.pos).forEach(n=>{if(!am.has(n))am.set(n,[]);am.get(n).push(it)}));
am.forEach((a,n)=>{if(a.length>=3)a.forEach(it=>add('畫師:'+n,'共用畫師',it))});
const od={'關鍵字':0,'名稱共用詞':1,'共用畫師':2};
return[...res.values()].map(r=>({tag:r.tag,src:r.src,newIds:[...r.ids].filter(id=>!((S.items.find(x=>x.id===id).tags)||[]).includes(r.tag))})).filter(r=>r.newIds.length).sort((x,y)=>od[x.src]-od[y.src]||y.newIds.length-x.newIds.length).slice(0,80)}
function autoModal(){const sg=autoSuggest(),m=openM();S.sg=sg;const nm=id=>(S.items.find(x=>x.id===id)||{}).name||'';
if(!sg.length){m.innerHTML=`<div class=ns-m><div class=ns-h><b>自動分組</b><span class=ns-sp></span><button data-a=mclose>✕</button></div><div class=ns-e>沒有新的建議</div></div>`;return}
m.innerHTML=`<div class=ns-m><div class=ns-h><b>自動分組建議：${sg.length} 個</b><span class=ns-sp></span><button data-a=mclose>✕</button></div><div class=ns-sum>依名稱／提示詞裡的風格關鍵字、名稱裡 3 筆以上共用的詞、3 筆以上共用的畫師整理出來。共用畫師預設不勾，避免標籤太多。</div>${sg.map((s,i)=>`<label class=ns-bi><input type=checkbox data-sg=${i} ${s.src==='共用畫師'?'':'checked'}><span><b>${esc(s.tag)}　<small>${s.newIds.length} 筆・${s.src}</small></b><small>${esc(s.newIds.slice(0,3).map(nm).join('、'))}</small></span></label>`).join('')}<button class=ns-w data-a=sg-go>套用勾選的標籤</button></div>`}
const MORD=['4.5','5'],MCOL={'4.5':'#e08a00','5':'#8e5bd6'},LAYL={'1':'大圖','2':'2欄','3':'3欄','0':'清單'};
const srcModel=s=>{s=String(s||'');if(!s)return'';if(/v\s*5/i.test(s))return'5';if(/4\.5/.test(s))return'4.5';return''};
const NM1=new RegExp('(?:只有|僅|仅|只能用|只能|只適合|只适合|only)\\s*v?(4\\.5|5)(?![\\d.])','ig'),NM2=new RegExp('(?<![\\d.])v?(4\\.5|5)\\s*(?:和|與|与|跟|及|/|、|&|,|，)\\s*v?(4\\.5|5)(?![\\d.])','ig'),NM3=new RegExp('(?:nai|v)\\s*(4\\.5|5)(?![\\d.])','ig'),NM4=/(?<![\d.])4\.5(?![\d])/;
function nameModels(nm){const s=String(nm||'').replace(/[Ｖｖ]/g,'v');if(!/5/.test(s))return[];const out=new Set();let m;
NM1.lastIndex=0;while((m=NM1.exec(s)))out.add(m[1]);
NM2.lastIndex=0;while((m=NM2.exec(s))){out.add(m[1]);out.add(m[2])}
NM3.lastIndex=0;while((m=NM3.exec(s)))out.add(m[1]);
if(NM4.test(s))out.add('4.5');
return[...out].sort((a,b)=>MORD.indexOf(a)-MORD.indexOf(b))}
const MMEMO=new WeakMap();
function modelOf(it){const sig=(it.mfrom||'')+'\u0001'+(it.models||[]).join(',')+'\u0001'+(it.name||'');const h=MMEMO.get(it);if(h&&h.sig===sig)return h.r;const r=_modelOf(it);MMEMO.set(it,{sig,r});return r}
function _modelOf(it){const st=(it.models||[]).filter(x=>MORD.includes(x));if((it.mfrom==='png'||it.mfrom==='manual')&&st.length)return{m:st,from:it.mfrom,why:''};const n=nameModels(it.name);if(n.length)return{m:n,from:'name',why:''};return{m:[],from:'',why:''}}
const modelHit=i=>{const r=modelOf(i);return S.mf==='?'?!r.m.length:r.m.includes(S.mf)};
function badge(it){const r=modelOf(it);if(!r.m.length)return'';const both=r.m.length>1;return `<span class="ns-mb"><i style="background:${both?'linear-gradient(90deg,#e08a00,#8e5bd6)':MCOL[r.m[0]]}">${both?'4.5·5':esc(r.m[0])}</i></span>`}
function modelCounts(){const c={'4.5':0,'5':0,'?':0};S.items.forEach(i=>{const r=modelOf(i);if(!r.m.length)c['?']++;else r.m.forEach(x=>c[x]++)});return c}
function drawM(){const box=g('d-mbox');if(!box||!S.cur)return;const it=S.cur,r=modelOf(it),FR={png:'來自圖片資料，可信',manual:'你手動設定的',name:'來自名稱裡寫的'};
box.innerHTML=`<div class=ns-sug>${['4.5','5'].map(k=>`<button data-dm="${k}" class="${r.m.includes(k)?'on':''}">${k}</button>`).join('')}<button data-dm="auto">自動</button></div><small>${r.m.length?'目前：'+esc(r.m.join('、'))+'（'+FR[r.from]+'）':'目前無法判斷，可以手動點選'}</small>`}
function modelHelp(){const m=openM();m.innerHTML=`<div class=ns-m><div class=ns-h><b>模型標示說明</b><span class=ns-sp></span><button data-a=mclose>✕</button></div><div class=ns-sum>卡片左上角的色塊是「適用模型」，目前只有 4.5（橘）和 5（紫），兩個都可以的是一顆漸層的「4.5·5」。判斷順序：<br>1. 你手動設定的，永遠優先<br>2. 圖片資料：NAI 原圖裡寫的模型（只有新匯入或重新匯入的 PNG 才有）<br>3. 名稱：你在名稱裡寫的，例如「只有5」「4.5和5皆可」<br>4. 都沒有 → 未判斷，可以用篩選找出來再批量設定<br>這是依資料判斷「標示給哪個模型用」，不是實際出圖測試的結果。<br>舊資料沒有保存圖片資料，把原圖再匯入一次（重複會略過），就會補上模型。</div></div>`}
const upsert=it=>{const i=S.items.findIndex(x=>x.id===it.id);i<0?S.items.push(it):S.items[i]=it};
const closeM=()=>{S.tok=0;S.fs=false;g('ns-modal').style.display='none';g('ns-modal').innerHTML=''};
// ---------- render ----------
const COL=new Intl.Collator('zh-Hant',{numeric:true}),nmc=(a,b)=>COL.compare(a.name||'',b.name||''),fvc=(x,y)=>(y.fav|0)-(x.fav|0),nwc=(x,y)=>y.t-x.t,hm=x=>modelOf(x).m.length>0?1:0;
const SORTS={def:(x,y)=>fvc(x,y)||nwc(x,y),new:nwc,old:(x,y)=>x.t-y.t,az:nmc,za:(x,y)=>nmc(y,x),fav:(x,y)=>fvc(x,y)||nmc(x,y),noimg:(x,y)=>(x.thumb?1:0)-(y.thumb?1:0)||fvc(x,y)||nwc(x,y),img:(x,y)=>(y.thumb?1:0)-(x.thumb?1:0)||fvc(x,y)||nwc(x,y),nomodel:(x,y)=>hm(x)-hm(y)||fvc(x,y)||nwc(x,y),notag:(x,y)=>((x.tags||[]).length?1:0)-((y.tags||[]).length?1:0)||fvc(x,y)||nwc(x,y)};
const SORTL={def:'預設（收藏優先）',new:'最新加入',old:'最舊加入',az:'名稱 A→Z',za:'名稱 Z→A',fav:'收藏優先＋名稱',noimg:'沒有預覽圖在前',img:'有預覽圖在前',nomodel:'未判斷模型在前',notag:'沒有標籤在前'};
const vis=()=>S.items.filter(i=>(S.filter==='all'||i.fav)&&(!S.tagSel.length||(S.tagMode==='and'?S.tagSel.every(t=>(i.tags||[]).includes(t)):S.tagSel.some(t=>(i.tags||[]).includes(t))))&&(!S.mf||modelHit(i))&&(!S.q||(i.name+' '+(i.tags||[]).join(' ')).toLowerCase().includes(S.q))).sort(SORTS[S.sort]||SORTS.def);
function renderN(){S.nc.clear();const l=g('ns-list');l.className='LN';
const a=S.notes.filter(n=>(S.filter==='all'||n.fav)&&(!S.q||(n.name+n.text).toLowerCase().includes(S.q))).sort((x,y)=>(y.fav|0)-(x.fav|0)||y.t-x.t);
l.innerHTML=a.map(n=>`<div class=ns-nc data-nid="${n.id}"><div class=ns-nh><b>${esc(n.name||'未命名')}</b><span class=ns-sp></span><span class=ns-star2 data-nstar="${n.id}">${n.fav?'★':'☆'}</span><button data-ncp="${n.id}">複製</button></div><div class=ns-p>${esc(n.text.slice(0,120))}</div></div>`).join('')||'<div class=ns-e>還沒有負面詞筆記，按＋新增</div>'}
function detailN(n){S.curN=n;const m=openM();m.innerHTML=`<div class=ns-m><div class=ns-h><b>負面詞筆記</b><span class=ns-sp></span><button data-a=mclose>✕</button></div><label>標題</label><input id=n-name value="${esc(n.name)}"><label>內容 <button data-a=n-cp>複製</button></label><textarea id=n-text rows=10>${esc(n.text)}</textarea><div class=ns-t><button data-a=n-save>儲存</button><button data-a=n-fav>${n.fav?'★':'☆'} 收藏</button><button data-a=n-del>刪除</button></div></div>`}
const PAGE=48,NCAP=160,TPL=D.createElement('template');
const sigOf=(i,L)=>{const r=modelOf(i);return[L,i.name,i.fav|0,(i.tags||[]).join('|'),r.m.join(',')+r.from,(i.thumb||'').length,L==='1'?(i.pos||'').slice(0,160):'',S.sel?(S.sel.has(i.id)?2:1):0].join('\u0001')};
function getCard(i,L){const sg=sigOf(i,L),h=S.nc.get(i.id);if(h&&h.sig===sg){S.nc.delete(i.id);S.nc.set(i.id,h);return h.el}
TPL.innerHTML=cardHtml(i,L);const el=TPL.content.firstElementChild;S.nc.set(i.id,{sig:sg,el});if(S.nc.size>NCAP)S.nc.delete(S.nc.keys().next().value);return el}
const touchCard=id=>{const h=S.nc.get(id),it=S.items.find(x=>x.id===id);if(h&&it)h.sig=sigOf(it,S.layout)};
const cardHtml=(i,L)=>{const on=S.sel&&S.sel.has(i.id);
return `<div class="ns-c${on?' sel':''}" data-id="${i.id}">${i.thumb?`<img loading=lazy decoding=async src="${i.thumb}">`:`<div class=ns-ph>${esc([...i.name][0]||'?')}</div>`}${S.sel?`<span class="ns-ck${on?' on':''}"></span>`:''}${S.sel?'':badge(i)}<span class=ns-star data-star="${i.id}">${i.fav?'★':'☆'}</span><div class=ns-n>${esc(i.name)}${L==='1'?`<div class=ns-p>${esc(i.pos.slice(0,160))}</div>${(i.tags||[]).length?`<div class=ns-tg>${esc(i.tags.map(t=>'#'+t).join(' '))}</div>`:''}`:''}</div></div>`};
async function compressThumbs(){
const list=S.items.filter(it=>typeof it.thumb==='string'&&it.thumb.startsWith('data:image/'));
if(!list.length){toast('沒有可壓縮的縮圖');return}
if(!W.confirm(`將逐張重新壓縮 ${list.length} 張已儲存的縮圖。只有新圖片比原圖更小時才會替換；失敗或變大時會保留原圖。建議先匯出 JSON 備份。\n\n繼續嗎？`))return;
const pg=g('ns-prog'),tok=S.ptok=uid();let done=0,changed=0,skipped=0,failed=0,before=0,after=0,cancelled=false;S.compCancel=()=>{cancelled=true};
const draw=fin=>{if(S.ptok!==tok)return;const {w,h}=vp();pg.style.display='block';pg.style.left='10px';pg.style.width=(w-20)+'px';pg.style.top=(h-78)+'px';pg.innerHTML=`<div class=ns-pt>${fin?(cancelled?'已取消壓縮':'縮圖壓縮完成'):`壓縮縮圖 ${done}/${list.length}`}　✓${changed}　略過 ${skipped}　失敗 ${failed}${fin?`　節省 ${(Math.max(0,before-after)/1024).toFixed(1)} KB`:''}${fin?'　<u data-a=pcomp>查看摘要</u>':'　<button data-a=pcomp-cancel>取消</button> '}</div><div class=ns-pb><i style="width:${list.length?done/list.length*100:0}%"></i></div>`};
S.compSummary=null;draw(false);
for(const it of list){
if(S.ptok!==tok||cancelled)break;
const src=it.thumb;before+=src.length;
try{
const result=await new Promise((resolve,reject)=>{const im=new W.Image();let settled=false;const finish=(v,err)=>{if(settled)return;settled=true;im.onload=im.onerror=null;err?reject(err):resolve(v)};im.onload=()=>{try{const w=im.naturalWidth||im.width,h=im.naturalHeight||im.height;if(!w||!h)throw Error('圖片尺寸無效');const k=Math.min(1,320/Math.max(w,h)),c=D.createElement('canvas');c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(h*k));const ctx=c.getContext('2d');if(!ctx)throw Error('Canvas 不可用');ctx.drawImage(im,0,0,c.width,c.height);const out=c.toDataURL('image/jpeg',.72);c.width=c.height=0;finish({out,w,h})}catch(e){finish(null,e)}};im.onerror=()=>finish(null,Error('圖片解碼失敗'));im.src=src});
if(result.out&&result.out.length<src.length){it.thumb=result.out;await dbPut(it);upsert(it);changed++;after+=result.out.length}else{skipped++;after+=src.length}
}catch(e){failed++;after+=src.length}
done++;draw(false);await new Promise(r=>setTimeout(r,0))
}
S.nc.clear();S.shown=1;render();S.compSummary={done,changed,skipped,failed,before,after,cancelled};draw(true);
setTimeout(()=>{if(S.ptok===tok)pg.style.display='none'},10000)
}
function clearImageTemp(){
S.nc.clear();
const l=g('ns-list');if(l)l.replaceChildren();
try{if(S.cur&&g('d-img')){} }catch(e){}
S.shown=1;render();
toast('已清理插件可控制的暫存與卡片快取；已儲存圖片未被刪除')
}
function render(){const nt=S.tab==='n';
root.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===S.tab));
g('ns-seg').style.display=nt?'none':'flex';
if(nt){drawFbarN();renderN();g('ns-bar').style.display='none';const pn=g('ns-pages');pn.style.display='flex';pn.innerHTML='<button class=pri data-a=add>＋ 新增筆記</button>';return}
const L=S.layout,l=g('ns-list');l.className='L'+L;
if(S.shown===0)S.page=1;
S.vl=vis();drawFbar();const pages=Math.max(1,Math.ceil(S.vl.length/S.pageSize));S.page=Math.max(1,Math.min(S.page,pages));
const from=(S.page-1)*S.pageSize,items=S.vl.slice(from,from+S.pageSize);
if(!items.length)l.innerHTML='<div class=ns-e>還沒有資料</div>';else{const fr=D.createDocumentFragment();items.forEach(i=>fr.appendChild(getCard(i,L)));l.replaceChildren(fr)}
const pg=g('ns-pages');pg.style.display=S.sel?'none':'flex';pg.innerHTML=`<button class=pri data-a=add>＋ 新增</button><span class=ns-sp></span><button class=ic data-page="prev" ${S.page<=1?'disabled':''}>‹</button><span class=ns-pn>${S.page} / ${pages}<small>${S.vl.length} 張</small></span><button class=ic data-page="next" ${S.page>=pages?'disabled':''}>›</button><select id=ns-pagesize aria-label="每頁顯示數量"><option value="10" ${S.pageSize===10?'selected':''}>10/頁</option><option value="20" ${S.pageSize===20?'selected':''}>20/頁</option><option value="30" ${S.pageSize===30?'selected':''}>30/頁</option></select><span class=ns-sp></span><button class=ic data-a=sel title="選取">☑</button>`;
S.shown=1;
root.querySelectorAll('[data-l]').forEach(b=>b.classList.toggle('on',b.dataset.l===S.layout));
root.querySelectorAll('[data-f]').forEach(b=>b.classList.toggle('on',b.dataset.f===S.filter));
g('ns-bar').style.display=S.sel?'flex':'none';
if(S.sel)g('ns-cnt').textContent='已選 '+S.sel.size}
function sheet(title,acts){const m=openM();S.sh=acts;
m.innerHTML=`<div class=ns-m><div class=ns-h><b>${title}</b><span class=ns-sp></span><button data-a=mclose>✕</button></div>${acts.map((a,i)=>`<button class=ns-w data-sh=${i}>${a[0]}</button>`).join('')}</div>`}
function detail(it){it.tags=it.tags||[];S.cur=it;const m=openM();
m.innerHTML=`<div class=ns-m><div class=ns-h><b>詳細</b><span class=ns-sp></span><button data-a=mclose>✕</button></div><div id=d-img>${it.thumb?`<img class=ns-big src="${it.thumb}">`:''}</div><label>名稱</label><input id=d-name value="${esc(it.name)}"><label>適用模型</label><div id=d-mbox></div><label>標籤</label><div id=d-tags></div><div class=ns-t><input id=d-tin placeholder="輸入新標籤，可用逗號分開"><button data-a=d-tadd>＋</button></div><label>正面 <button data-a=cp-pos>複製</button></label><textarea id=d-pos rows=6>${esc(it.pos)}</textarea><label>負面 <button data-a=cp-neg>複製</button></label><textarea id=d-neg rows=4>${esc(it.neg)}</textarea><div class=ns-g>${F.map((k,i)=>`<div><label>${FL[i]}</label><input id=d-${k} value="${esc(it[k])}"></div>`).join('')}</div><div class="ns-t ns-sticky"><button class=pri data-a=save>儲存</button><button data-a=dfav>${it.fav?'★':'☆'} 收藏</button><button data-a=dimg>換圖</button><button data-a=d2n>負面→筆記</button><button data-a=ddel>刪除</button></div></div>`;drawDT()}
function pull(){const it=S.cur;it.name=g('d-name').value.trim()||'未命名';it.pos=g('d-pos').value;it.neg=g('d-neg').value;F.forEach(k=>it[k]=g('d-'+k).value.trim());return it}
function batch(){S.b=[];const m=openM();
m.innerHTML=`<div class=ns-m><div class=ns-h><b>批量匯入</b><span class=ns-sp></span><button data-a=mclose>✕</button></div><textarea id=b-t rows=7 placeholder="貼上含「1. 【名稱】」的文字，或按抓最新訊息"></textarea><div class=ns-t><button data-a=b-last>抓最新訊息</button><button data-a=b-parse>解析</button></div><div id=b-list></div><button class=ns-w data-a=b-save>存入勾選項目</button></div>`}
function bRender(){g('b-list').innerHTML=S.b.map((o,i)=>`<label class=ns-bi><input type=checkbox data-bi=${i} ${o.on?'checked':''}><span><b>${esc(o.name)}</b><small>${o.dup?'⚠ 重複：'+esc(o.dup)+'　':''}${esc(o.pos.slice(0,50))}</small></span></label>`).join('')||'<div class=ns-e>沒解析到內容</div>'}
const rrow=r=>`<div class="ns-r ${r[0]}"><b>${{ok:'✓',warn:'！',err:'✕',dup:'＝'}[r[0]]}</b><span>${esc(r[1])}<small>${esc(r[2])}</small></span></div>`;
function resModal(){const m=openM();m.innerHTML=`<div class=ns-m><div class=ns-h><b>未完全成功的項目</b><span class=ns-sp></span><button data-a=mclose>✕</button></div>${(S.res||[]).filter(r=>r[0]!=='ok').map(rrow).join('')||'<div class=ns-e>沒有</div>'}</div>`}
async function addFiles(fs){const N=fs.length,res=[],pg=g('ns-prog'),tok=S.ptok=uid();let ok=0,warn=0,err=0,dup=0;S.res=res;const km=keyMap();
const draw=d=>{if(S.ptok!==tok)return;const fin=d>=N,{w,h}=vp();pg.style.display='block';pg.style.left='10px';pg.style.width=(w-20)+'px';pg.style.top=(h-78)+'px';
pg.innerHTML=`<div class=ns-pt>${fin?'匯入完成':`匯入中 ${d}/${N}`}　✓${ok}${warn?`　！${warn}`:''}${err?`　✕${err}`:''}${dup?`　＝${dup}`:''}${fin&&(warn||err||dup)?'　<u data-a=pdet>看詳情</u>':''}</div><div class=ns-pb><i style="width:${N?d/N*100:0}%"></i></div>`};
draw(0);
for(let i=0;i<N;i++){const f=fs[i],nm=(f.name||'').replace(/\.\w+$/,'')||'未命名';
try{const{md,why}=await readMeta(f);const k=normKey(md.pos),ex=k&&km.get(k);if(ex&&S.skipDup){dup++;let ex2='';if(md.models&&md.models.length&&ex.mfrom!=='png'&&ex.mfrom!=='manual'){ex.models=md.models;ex.mfrom='png';await dbPut(ex);ex2='（已補上模型 '+md.models.join('、')+'）'}res.push(['dup',nm,'重複略過：與「'+ex.name+'」相同'+ex2]);draw(i+1);continue}const th=await toThumb(f);
const it={...blank(),name:nm,...md,thumb:th.thumb};if(!it.size&&th.w)it.size=th.w+'x'+th.h;await autoApply(it);await dbPut(it);upsert(it);if(k)km.set(k,it);
const nt=th.thumb?'':'（縮圖產生失敗）';
if(md.pos){ok++;res.push(['ok',nm,'解析成功'+(md.steps?`・${md.steps} 步`:'')+nt])}else{warn++;res.push(['warn',nm,'已匯入，但沒有解析出內容：'+why+nt])}}
catch(e){err++;res.push(['err',nm,'失敗：'+(e&&e.message||e)])}
draw(i+1);if((i+1)%60===0)render();await new Promise(r=>setTimeout(r,40))}
render();setTimeout(()=>{if(S.ptok===tok)pg.style.display='none'},(warn||err||dup)?8000:2500)}
async function importJson(txt){let a,nn=[],tl=[];try{a=JSON.parse(txt);if(!Array.isArray(a)){nn=a.notes||[];tl=a.tags||[];a=a.items||[]}}catch(e){return toast('JSON 格式錯誤')}
const dup=a.filter(x=>S.items.some(y=>y.name===x.name)).length;let mode='2';
if(dup)mode=W.prompt(`有 ${dup} 筆同名。1=略過 2=覆蓋 3=都留`,'1')||'1';
let n=0,sk=0,done=0;const N=a.length+nn.length,pg=g('ns-prog'),tok=S.ptok=uid(),buf=[],km=keyMap();
const draw=fin=>{if(S.ptok!==tok)return;const{w,h}=vp();pg.style.display='block';pg.style.left='10px';pg.style.width=(w-20)+'px';pg.style.top=(h-78)+'px';pg.innerHTML=`<div class=ns-pt>${fin?'匯入完成':`匯入 JSON ${done}/${N}`}　✓${n}${sk?`　＝略過 ${sk}`:''}</div><div class=ns-pb><i style="width:${N?done/N*100:0}%"></i></div>`};
const flush=async()=>{if(buf.length){const b=buf.splice(0);await tx('readwrite',s=>{b.forEach(x=>s.put(x))})}};
const tick=async()=>{if(done%25===0){await flush();draw();await new Promise(r=>setTimeout(r,0))}};
draw();
for(const x of a){done++;const ex=S.items.find(y=>y.name===x.name);let it={...blank(),...x};
if(ex){if(mode==='1'){await tick();continue}if(mode==='2')it.id=ex.id;else it.id=uid()}else{const k=normKey(it.pos);if(S.skipDup&&k&&km.has(k)){sk++;await tick();continue}if(S.items.some(y=>y.id===it.id))it.id=uid()}
buf.push(it);upsert(it);{const k=normKey(it.pos);if(k)km.set(k,it)}n++;await tick()}
for(const x of nn){done++;if(S.notes.some(y=>y.name===x.name&&y.text===x.text)){await tick();continue}const it={...blankN(),...x,kind:'note'};if(S.notes.some(y=>y.id===it.id))it.id=uid();buf.push(it);S.notes.push(it);n++;await tick()}
await flush();
{let ch=false;[...tl,...a.flatMap(x=>x.tags||[])].forEach(t=>{ch=addTagLib(t)||ch});if(ch)await saveTagList()}
S.shown=0;render();draw(true);setTimeout(()=>{if(S.ptok===tok)pg.style.display='none'},2500)}
// ---------- UI ----------
const css=D.createElement('style');css.id=ID+'-css';css.textContent=`
#${ID}{position:fixed;left:0;top:0;width:0;height:0;z-index:2147483000;--bg:#f6f3ea;--fg:#302d28;--bd:#c9c1b3;--sub:#81796e;--soft:#fffdf7;--btn:#fffdf7;--inv:#302d28;--invt:#f6f3ea;--shade:#0006;--ac:#97604b;--acs:#97604b1a}
#${ID} *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
#ns-fab{position:fixed;left:0;top:0;width:46px;height:46px;touch-action:none;user-select:none;-webkit-user-select:none;opacity:.94;border-radius:50%;background:var(--bg);color:var(--fg);border:1px solid var(--bd);box-shadow:0 3px 10px #0005;display:flex;align-items:center;justify-content:center;font-size:20px;z-index:1;cursor:pointer}
#ns-panel{position:fixed;left:10px;top:10px;background:var(--bg);color:var(--fg);border:1px solid var(--bd);border-radius:18px;z-index:2;flex-direction:column;box-shadow:0 8px 32px #0007;font-size:14px;overflow:hidden}
#ns-modal{position:fixed;left:0;top:0;background:var(--shade);z-index:3;align-items:flex-end;justify-content:center}
#ns-prog{position:fixed;background:var(--bg);color:var(--fg);border:1px solid var(--bd);border-radius:14px;padding:8px 12px;z-index:5;box-shadow:0 2px 14px #0006;font-size:13px}
.ns-pt u{text-decoration:underline;cursor:pointer}
.ns-m{background:var(--bg);color:var(--fg);border:1px solid var(--bd);border-bottom:0;width:100%;max-height:88%;overflow:auto;border-radius:20px 20px 0 0;padding:6px 14px 14px;font-size:14px;box-shadow:0 -6px 24px #0006}
.ns-m::before{content:"";display:block;width:38px;height:4px;border-radius:2px;background:var(--bd);margin:4px auto 10px}
.ns-h,.ns-t{display:flex;gap:6px;align-items:center;padding:6px 10px;flex-wrap:wrap}
#ns-panel>.ns-h{padding:10px 12px 8px;flex-wrap:nowrap}
.ns-m .ns-h{padding:0 0 8px}.ns-m .ns-t{padding:8px 0}
.ns-sp{flex:1}
#${ID} button{border:1px solid var(--bd);background:var(--btn);border-radius:999px;padding:6px 12px;color:var(--fg);font-size:13px;min-height:32px;line-height:1.2;white-space:nowrap}
#${ID} button.on{background:var(--ac);color:var(--acf,#fff);border-color:var(--ac)}
#${ID} button.pri{background:var(--ac);color:var(--acf,#fff);border-color:var(--ac);font-weight:600}
#${ID} button.ic{width:34px;min-width:34px;height:34px;padding:0;display:inline-flex;align-items:center;justify-content:center;font-size:15px}
#${ID} #ns-lay{width:auto;padding:0 10px;font-size:12px}
#${ID} button:disabled{opacity:.35}
#ns-panel>.ns-h>button[data-tab]{border-color:transparent;background:transparent;font-size:16px;font-weight:600;color:var(--sub);padding:4px 12px}
#ns-panel>.ns-h>button[data-tab].on{background:var(--acs);color:var(--ac);border-color:transparent}
#${ID} input:not([type=checkbox]),#${ID} textarea{width:100%;border:1px solid var(--bd)!important;border-radius:12px;padding:8px 10px;font-size:14px;background:var(--soft)!important;color:var(--fg)!important}
#${ID} select{border:1px solid var(--bd)!important;border-radius:999px;padding:6px 12px;font-size:12px;background:var(--soft)!important;color:var(--fg)!important;width:auto;-webkit-appearance:none;appearance:none;text-align:center;min-height:32px}
.ns-t input{flex:1;min-width:90px}
.ns-m label{display:block;margin:10px 0 4px;color:var(--sub);font-size:12px}
.ns-w{display:block;width:100%;margin:6px 0;padding:10px!important;border-radius:12px!important}
#ns-srow{display:flex;gap:8px;align-items:center;padding:0 12px 8px}#ns-srow input{flex:1;min-width:0}
#${ID} .ns-seg{display:flex;border:1px solid var(--bd);border-radius:999px;overflow:hidden;flex:none;background:var(--btn)}#${ID} .ns-seg button{border:0;border-radius:0;min-height:34px;padding:0 12px;background:transparent;color:var(--sub);font-size:13px}#${ID} .ns-seg button.on{background:var(--ac);color:var(--acf,#fff)}
#ns-fbar{display:flex;gap:6px;align-items:center;padding:0 12px 8px;overflow-x:auto;flex:none;white-space:nowrap;scrollbar-width:none}#ns-fbar::-webkit-scrollbar{display:none}#ns-fbar button{flex:none;font-size:12px;padding:3px 10px;min-height:28px}.ns-cn{color:var(--sub);font-size:12px;flex:none}
#ns-list{flex:1;overflow:auto;padding:4px 12px 12px;display:grid;gap:10px;align-content:start;grid-auto-rows:max-content;overscroll-behavior:contain}
#ns-pages{display:flex;align-items:center;gap:6px;padding:8px 12px;border-top:1px solid var(--bd);background:var(--bg);flex:none}
.ns-pn{font-size:12px;color:var(--sub);min-width:48px;text-align:center;line-height:1.15}.ns-pn small{display:block;font-size:10px;opacity:.85}
#ns-bar{display:none;gap:6px;align-items:center;padding:8px 12px;border-top:1px solid var(--bd);flex-wrap:wrap;background:var(--bg);flex:none}#ns-bar #ns-cnt{font-size:12px;color:var(--sub);margin-right:auto}
.L1{grid-template-columns:1fr}.L2{grid-template-columns:1fr 1fr}.L3{grid-template-columns:1fr 1fr 1fr;gap:8px}.L0{grid-template-columns:1fr;gap:8px}
.ns-c{position:relative;border:1px solid var(--bd);border-radius:14px;overflow:hidden;background:var(--soft);min-height:56px;box-shadow:0 1px 4px #0002}
.ns-c.sel{outline:3px solid var(--ac);outline-offset:-3px}
.ns-c img,.ns-ph{display:block;width:100%;aspect-ratio:2/3;object-fit:cover}.L2 .ns-c img,.L2 .ns-ph{aspect-ratio:3/4}
.ns-ph{background:var(--acs);color:var(--ac);display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700}
.ns-n{position:absolute;left:0;right:0;bottom:0;padding:22px 9px 7px;background:linear-gradient(transparent,#000c);color:#fff;font-size:12px;line-height:1.3;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.L3 .ns-n{font-size:11px;padding:16px 6px 5px}
.L1 .ns-n{position:static;background:none;color:var(--fg);white-space:normal;font-size:14px;padding:8px 10px 10px;font-weight:600}
.L0 .ns-c{display:flex;align-items:center}.L0 .ns-c img,.L0 .ns-ph{width:60px;height:60px;aspect-ratio:auto;flex:none;font-size:20px}.L0 .ns-n{position:static;background:none;color:var(--fg);flex:1;font-size:14px;padding:6px 40px 6px 10px}
.ns-p{color:var(--sub);font-size:12px;margin-top:3px;word-break:break-all;font-weight:400}
.ns-tg{color:var(--ac);font-size:12px;margin-top:3px;word-break:break-all;white-space:normal;font-weight:400}
.ns-star{position:absolute;top:6px;right:6px;width:28px;height:28px;border-radius:50%;background:#0006;color:#ffd36b;display:flex;align-items:center;justify-content:center;font-size:15px;z-index:1}.L0 .ns-star{top:50%;transform:translateY(-50%);background:none;color:#e0a030;font-size:20px}
.ns-ck{position:absolute;top:8px;left:8px;width:22px;height:22px;border-radius:50%;border:2px solid #fff;background:#0005;z-index:1}.ns-ck.on{background:var(--ac)}
.ns-mb{position:absolute;left:6px;top:6px;display:flex;gap:2px;z-index:1}.ns-mb i{font-style:normal;font-size:11px;font-weight:700;color:#fff;padding:2px 7px;border-radius:9px;box-shadow:0 1px 4px #0008}.L3 .ns-mb i{font-size:10px;padding:1px 6px}
.ns-e{grid-column:1/-1;text-align:center;color:var(--sub);padding:30px}
.ns-big{display:block;max-width:100%;max-height:38vh;margin:0 auto;border-radius:12px}
.ns-g{display:grid;grid-template-columns:1fr 1fr;gap:6px}.ns-g label{margin:4px 0 2px}
.ns-bi{display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--bd)}.ns-bi span{display:flex;flex-direction:column;min-width:0}.ns-bi small{color:var(--sub);word-break:break-all}
.ns-toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:var(--inv);color:var(--invt);padding:8px 16px;border-radius:18px;z-index:4;font-size:13px}
.ns-pb{height:8px;background:var(--bd);border-radius:4px;overflow:hidden;margin:6px 0 2px}.ns-pb i{display:block;height:100%;background:var(--ac);transition:width .25s}
.ns-r{display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--bd)}.ns-r>b{width:18px;flex:none}.ns-r span{display:flex;flex-direction:column;min-width:0;word-break:break-all}.ns-r small{color:var(--sub)}
.ns-r.dup>b{color:#4a90e2}.ns-r.ok>b{color:#2e9d4f}.ns-r.warn>b{color:#e08a00}.ns-r.err>b{color:#d33}
.LN{grid-template-columns:1fr}.ns-nc{border:1px solid var(--bd);border-radius:14px;padding:10px 12px;background:var(--soft)}.ns-nh{display:flex;align-items:center;gap:8px}.ns-nh b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ns-star2{font-size:20px;color:#e0a030}
.ns-chips{display:flex;gap:6px;overflow-x:auto;padding:0 0 6px;flex:none}.ns-chips.wrap{flex-wrap:wrap;overflow:visible}.ns-chips button{white-space:nowrap;flex:none}
#d-tags{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.ns-sug{display:flex;flex-wrap:wrap;gap:6px;width:100%}.ns-m small{color:var(--sub)}
.ns-m .ns-sticky{position:sticky;bottom:-14px;background:var(--bg);padding:10px 0 4px;border-top:1px solid var(--bd);margin-top:10px}
.ns-dg{border:1px solid var(--bd);border-radius:12px;padding:2px 8px;margin:8px 0}.ns-dt{width:40px;height:40px;object-fit:cover;border-radius:6px;flex:none}

.ns-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;border:1px solid #0003;vertical-align:-1px}
/* ===== Windows XP ===== */
#${ID}.sk-xp{--t1:#0a5de4;--t2:#3a93ff;--d1:#5a8fd8;--d2:#4f9a2b;font-family:Tahoma,"Microsoft JhengHei","Noto Sans TC",sans-serif}
#${ID}.sk-xp #ns-panel{border:3px solid var(--t1);border-radius:10px 10px 4px 4px}
#${ID}.sk-xp #ns-panel>.ns-h{background:linear-gradient(var(--t2),var(--t1) 14%,var(--t1) 86%,var(--t2));padding:6px 8px;gap:4px}
#${ID}.sk-xp #ns-panel>.ns-h>button[data-tab]{color:#fff;font-weight:700;text-shadow:1px 1px #0006;border-radius:6px 6px 0 0;font-size:14px;padding:3px 10px;min-height:28px;background:transparent;border-color:transparent}
#${ID}.sk-xp #ns-panel>.ns-h>button[data-tab].on{background:var(--bg);color:var(--fg);text-shadow:none}
#${ID}.sk-xp button{border-radius:3px;background:linear-gradient(var(--soft),var(--btn) 85%,var(--bd));border:1px solid var(--bd);color:var(--fg)}
#${ID}.sk-xp button.on,#${ID}.sk-xp button.pri{background:linear-gradient(#fff3c4,#ffd266 60%,#f6b73c);color:#000;border-color:#b07b1a}
#${ID}.sk-xp button.ic{border-radius:4px;width:30px;min-width:30px;height:30px;background:linear-gradient(#5b9bff,#2362e0);border:1px solid #fff;color:#fff}
#${ID}.sk-xp button.ic[data-a=close]{background:linear-gradient(#f0a08a,#d0452a)}
#${ID}.sk-xp .ns-seg{border-radius:3px}#${ID}.sk-xp .ns-seg button{border-radius:0;background:var(--btn)}
#${ID}.sk-xp #ns-list{background:linear-gradient(var(--d1),var(--d1) 50%,var(--d2) 50%,var(--d2))}
#${ID}.sk-xp .ns-c{border:2px solid var(--t1);border-radius:8px 8px 3px 3px;background:var(--bg);padding:22px 3px 3px;box-shadow:2px 3px 6px #0006}
#${ID}.sk-xp .ns-c img,#${ID}.sk-xp .ns-ph{border:1px solid var(--bd)}
#${ID}.sk-xp .ns-n{top:0;bottom:auto;height:22px;padding:3px 52px 0 7px;background:linear-gradient(var(--t2),var(--t1) 14%,var(--t1) 86%,var(--t2));color:#fff;font-weight:700;font-size:11px;text-shadow:1px 1px #0006;white-space:nowrap}
#${ID}.sk-xp .ns-n .ns-p,#${ID}.sk-xp .ns-n .ns-tg{display:none}
#${ID}.sk-xp .ns-n::after{content:"▁ ▢";position:absolute;right:26px;top:3px;font-size:10px;letter-spacing:3px;opacity:.9}
#${ID}.sk-xp .ns-star{top:3px;right:4px;width:18px;height:18px;border-radius:3px;background:linear-gradient(#f0a08a,#d0452a);border:1px solid #fff;color:#fff;font-size:11px}
#${ID}.sk-xp .ns-mb,#${ID}.sk-xp .ns-ck{top:30px;left:9px}
#${ID}.sk-xp .L0 .ns-c img,#${ID}.sk-xp .L0 .ns-ph{width:56px;height:56px}
#${ID}.sk-xp .ns-m{border:3px solid var(--t1);border-bottom:0;border-radius:10px 10px 0 0}
#${ID}.sk-xp .ns-m::before{content:"NAI 畫師串庫";width:auto;height:auto;margin:-6px -14px 10px;padding:5px 10px;border-radius:7px 7px 0 0;background:linear-gradient(var(--t2),var(--t1) 14%,var(--t1) 86%,var(--t2));color:#fff;font-weight:700;font-size:13px;text-shadow:1px 1px #0006}
#${ID}.sk-xp input:not([type=checkbox]),#${ID}.sk-xp textarea{border-radius:2px!important;border:1px solid var(--bd)!important}
/* ===== Y2K ===== */
#${ID}.sk-y2k{--t1:#ff7ccd;--t2:#a98bff;--d1:#ffd1ee;--d2:#d4c2ff;font-family:"Baloo 2","Comic Sans MS","Noto Sans TC",system-ui,sans-serif}
#${ID}.sk-y2k #ns-panel{border:3px solid #fff;border-radius:26px;background:linear-gradient(160deg,var(--d1),var(--d2));box-shadow:0 0 0 2px var(--ac),0 10px 34px #0006}
#${ID}.sk-y2k #ns-panel::after{content:"✦ ✧ ✦";position:absolute;right:18px;top:56px;font-size:14px;color:#fff;letter-spacing:6px;text-shadow:0 0 6px var(--ac);pointer-events:none}
#${ID}.sk-y2k button{border-radius:999px;border:2px solid #fff;background:linear-gradient(#fff9,#fff0 55%),var(--btn);box-shadow:0 2px 6px #0003,inset 0 1px 0 #fffc;color:var(--fg);font-weight:700}
#${ID}.sk-y2k button.on,#${ID}.sk-y2k button.pri{background:linear-gradient(#fff7,#fff0 55%),linear-gradient(90deg,var(--t1),var(--t2));color:#fff;text-shadow:0 1px 2px #0005}
#${ID}.sk-y2k #ns-panel>.ns-h>button[data-tab]{background:transparent;border-color:transparent;box-shadow:none}
#${ID}.sk-y2k #ns-panel>.ns-h>button[data-tab].on{background:linear-gradient(90deg,var(--t1),var(--t2));border-color:#fff;color:#fff}
#${ID}.sk-y2k #ns-pages,#${ID}.sk-y2k #ns-bar{background:#ffffffa8;border-top:2px dashed #fff}
#${ID}.sk-y2k .ns-seg{border:2px solid #fff;box-shadow:0 2px 6px #0003}#${ID}.sk-y2k .ns-seg button{border:0;box-shadow:none;border-radius:0}
#${ID}.sk-y2k .ns-c{border:3px solid #fff;border-radius:22px;box-shadow:0 0 0 2px var(--ac),0 6px 14px #0003;background:#fff}
#${ID}.sk-y2k .ns-n{left:8px;right:8px;bottom:8px;padding:4px 10px;border-radius:999px;background:linear-gradient(90deg,var(--t1),var(--t2));color:#fff;font-weight:700;text-shadow:0 1px 2px #0005}
#${ID}.sk-y2k .L3 .ns-n{left:5px;right:5px;bottom:5px;padding:2px 6px;font-size:10px}
#${ID}.sk-y2k .L1 .ns-n{position:static;margin:8px;border-radius:14px;white-space:normal}
#${ID}.sk-y2k .L0 .ns-n{position:static;margin:0 40px 0 6px;flex:1;background:none;color:var(--fg);text-shadow:none}
#${ID}.sk-y2k .ns-star{background:#fff;color:#ff4fa8;border:2px solid #fff;box-shadow:0 0 8px #fff,0 2px 6px #0004}
#${ID}.sk-y2k .ns-mb i{border:2px solid #fff}
#${ID}.sk-y2k .ns-m{border:3px solid #fff;border-bottom:0;border-radius:26px 26px 0 0;background:linear-gradient(160deg,var(--d1),var(--d2))}
#${ID}.sk-y2k .ns-m::before{background:#fff;width:46px;height:6px;border-radius:3px}
/* ===== Minimal Ins ===== */
#${ID}.sk-ins{font-family:-apple-system,"SF Pro Text","Helvetica Neue","Noto Sans TC",system-ui,sans-serif}
#${ID}.sk-ins #ns-panel{border-radius:16px;box-shadow:0 10px 40px #0005}
#${ID}.sk-ins button{border-radius:8px;background:transparent;font-weight:600}
#${ID}.sk-ins #ns-panel>.ns-h>button[data-tab]{border:0;border-bottom:2px solid transparent;border-radius:0;background:transparent;color:var(--sub);font-size:15px;padding:4px 6px;margin-right:8px;min-height:30px}
#${ID}.sk-ins #ns-panel>.ns-h>button[data-tab].on{border-bottom-color:var(--fg);color:var(--fg);background:transparent}
#${ID}.sk-ins button.ic{border:0}
#${ID}.sk-ins #ns-list{gap:2px;padding:0 0 8px}
#${ID}.sk-ins #ns-list.L1{gap:16px}#${ID}.sk-ins #ns-list.L0{gap:6px;padding:0 12px 8px}
#${ID}.sk-ins .ns-c{border:0;border-radius:0;box-shadow:none;background:var(--soft)}
#${ID}.sk-ins .L0 .ns-c{border-radius:8px}
#${ID}.sk-ins .L2 .ns-c img,#${ID}.sk-ins .L2 .ns-ph,#${ID}.sk-ins .L3 .ns-c img,#${ID}.sk-ins .L3 .ns-ph{aspect-ratio:3/4}
#${ID}.sk-ins .L3 .ns-n{display:none}
#${ID}.sk-ins .ns-n{background:linear-gradient(transparent,#0007);padding:18px 8px 6px;font-weight:500}
#${ID}.sk-ins .L1 .ns-n{background:none;color:var(--fg);padding:8px 12px 12px}
#${ID}.sk-ins .ns-star{background:none;color:#fff;text-shadow:0 0 4px #000a}
#${ID}.sk-ins .L0 .ns-star{color:var(--sub);text-shadow:none}
#${ID}.sk-ins .ns-m{border-radius:16px 16px 0 0}
#${ID}.sk-ins .ns-pb i{background:var(--fg)}
`;
D.head.appendChild(css);
root.innerHTML=`<div id=ns-fab>🎨</div><div id=ns-panel style="display:none"><div class=ns-h><button data-tab=a>畫師串</button><button data-tab=n>負面詞</button><span class=ns-sp></span><button class=ic data-a=settings title="設定">⚙</button><button class=ic data-a=bak title="工具">⋯</button><button class=ic data-a=close title="關閉">✕</button></div>
<div id=ns-srow><input id=ns-q placeholder="搜尋名稱、標籤"><div id=ns-seg class=ns-seg><button data-l=1 title="大圖">大</button><button data-l=2 title="二欄">2</button><button data-l=3 title="三欄">3</button><button data-l=0 title="清單">列</button></div></div>
<div id=ns-fbar></div><div id=ns-list></div><div id=ns-pages></div>
<div id=ns-bar><span id=ns-cnt></span><button data-a=s-all>全選</button><button data-a=s-fav>收藏</button><button data-a=s-tag>標籤</button><button data-a=s-mdl>模型</button><button data-a=s-more>更多</button><button class=pri data-a=sel>完成</button></div>
<div id=ns-hid hidden><button data-a=s-untag></button><button data-a=s-exp></button><button data-a=s-ip></button><button data-a=s-del></button></div></div>
<div id=ns-modal style="display:none"></div><div id=ns-prog style="display:none"></div><input type=file id=ns-file accept="image/*" multiple hidden><input type=file id=ns-json accept=".json,application/json" hidden>`;
D.documentElement.appendChild(root);
// ---------- floating ball ----------
function parseC(s){s=(s||'').trim();if(!s)return null;const x=D.createElement('canvas').getContext('2d');x.fillStyle='#000';x.fillStyle=s;const v=x.fillStyle;if(v[0]==='#')return[1,3,5].map(k=>parseInt(v.slice(k,k+2),16));const m=v.match(/[\d.]+/g);return m?m.slice(0,3).map(Number):null}
const SK={
paper:{n:'紙感（預設）',d:'預設的米色紙感，配色可選日間、夜間或跟隨酒館。'},
xp:{n:'Windows XP',d:'每張畫師串縮圖都是一個 Windows XP 小視窗：標題列是名稱，右上角的紅色小按鈕是收藏星星。',p:[
{n:'Luna 藍',bg:'#ece9d8',fg:'#000000',ac:'#316ac5',soft:'#ffffff',btn:'#f4f2e8',bd:'#7f9db9',t1:'#0a5de4',t2:'#3a93ff',d1:'#5a8fd8',d2:'#4f9a2b'},
{n:'Olive 橄欖綠',bg:'#ecebd6',fg:'#1b1b0a',ac:'#7a9a3a',soft:'#ffffff',btn:'#f3f2e2',bd:'#8c9a60',t1:'#6d8a2e',t2:'#a8c25b',d1:'#c9d9a0',d2:'#7d9f3d'},
{n:'Silver 銀',bg:'#eeeef4',fg:'#16161f',ac:'#7a7aa8',soft:'#ffffff',btn:'#f6f6fa',bd:'#9a9ab8',t1:'#8a8ab4',t2:'#c4c4de',d1:'#d9dbe8',d2:'#a9adc8'},
{n:'Royale 深藍',bg:'#1f2a44',fg:'#e8eefc',ac:'#4f7be0',soft:'#2a3858',btn:'#33446a',bd:'#4a6098',t1:'#0b1f55',t2:'#2a4aa8',d1:'#101a3a',d2:'#1d2f66',dark:1}]},
y2k:{n:'Y2K',d:'糖果漸層、白色粗邊框和閃亮貼紙，名稱是貼在圖片上的標籤。',p:[
{n:'Bubblegum 泡泡糖',bg:'#ffe9f6',fg:'#4a2a6a',ac:'#ff5fb7',soft:'#fff7fc',btn:'#fff7fc',t1:'#ff7ccd',t2:'#a98bff',d1:'#ffd1ee',d2:'#d4c2ff'},
{n:'Cyber 銀藍',bg:'#eaf4ff',fg:'#0f2a4d',ac:'#2b8cff',soft:'#f7fbff',btn:'#f7fbff',t1:'#5fb8ff',t2:'#b9a8ff',d1:'#dff0ff',d2:'#cfd8ff'},
{n:'Lime 螢光',bg:'#f4ffe0',fg:'#1d3a00',ac:'#5fbf10',soft:'#fbfff2',btn:'#fbfff2',t1:'#9be31a',t2:'#2fd9a0',d1:'#eaffb8',d2:'#b9ffe0'},
{n:'Peach 蜜桃',bg:'#fff1e4',fg:'#5a2a12',ac:'#ff8a4c',soft:'#fffaf5',btn:'#fffaf5',t1:'#ffa95c',t2:'#ff7aa8',d1:'#ffe0c4',d2:'#ffc7d9'},
{n:'Cherry 櫻桃黑',bg:'#1a0f1d',fg:'#ffe3f1',ac:'#ff3d8b',soft:'#2a1730',btn:'#33203a',t1:'#ff3d8b',t2:'#b04dff',d1:'#2a1230',d2:'#3a1030',dark:1}]},
ins:{n:'極簡 Ins',d:'極簡的 Instagram 式相簿：細邊框、不加陰影，三欄時只看圖，點進去才看名稱。',p:[
{n:'Mono 白',bg:'#ffffff',fg:'#111111',ac:'#262626',soft:'#fafafa',bd:'#dbdbdb',sub:'#8e8e8e'},
{n:'Noir 黑',bg:'#000000',fg:'#f5f5f5',ac:'#f5f5f5',acf:'#000000',soft:'#121212',bd:'#262626',sub:'#a8a8a8',dark:1},
{n:'Sand 沙',bg:'#faf6ef',fg:'#2b2620',ac:'#b08968',soft:'#f3ece0',bd:'#e6dccb',sub:'#8c8173'},
{n:'Blush 玫瑰',bg:'#fff5f6',fg:'#3a2227',ac:'#e57a8a',soft:'#ffecef',bd:'#f3d5da',sub:'#9a7a80'},
{n:'Sage 灰綠',bg:'#f4f7f3',fg:'#1f2a22',ac:'#6b8f71',soft:'#e9f0e8',bd:'#d9e3d9',sub:'#738076'},
{n:'Sky 淺藍',bg:'#f4f9ff',fg:'#14243a',ac:'#3b82f6',soft:'#e8f1fd',bd:'#d6e4f5',sub:'#6b7f99'},
{n:'Lilac 紫霧',bg:'#f7f4ff',fg:'#261f3a',ac:'#8b6cf0',soft:'#eeeafc',bd:'#e0d9f5',sub:'#7d759a'}]}};
const skinNow=()=>{const k=LS.getItem('nai_skin')||'paper';return SK[k]?k:'paper'};
function applySkin(){const k=skinNow(),st=root.style;root.className=root.className.replace(/\bsk-\w+/g,'').trim();['--t1','--t2','--d1','--d2'].forEach(v=>st.removeProperty(v));
if(k==='paper')return;const list=SK[k].p,p=list[+(LS.getItem('nai_pal')||0)]||list[0];root.classList.add('sk-'+k);
const f=parseC(p.fg)||[0,0,0],rg=a=>`rgba(${a[0]},${a[1]},${a[2]},`,set=(n,v)=>st.setProperty(n,v);
set('--bg',p.bg);set('--fg',p.fg);set('--bd',p.bd||rg(f)+'.2)');set('--sub',p.sub||rg(f)+'.55)');set('--soft',p.soft||rg(f)+'.06)');set('--btn',p.btn||p.soft||rg(f)+'.08)');set('--inv',p.fg);set('--invt',p.bg);set('--shade',p.dark?'#000b':'#0006');set('--ac',p.ac);set('--acs',p.ac+'22');set('--acf',p.acf||'#fff');
['t1','t2','d1','d2'].forEach(x=>{if(p[x])set('--'+x,p[x])})}
function drawSkin(){const m=g('ns-modal'),k=skinNow(),cur=LS.getItem('nai_theme')||'day',pi=+(LS.getItem('nai_pal')||0);
const chips=k==='paper'?[['day','日間紙感','#97604b'],['night','夜間','#d6a38a'],['auto','跟隨酒館','#888888']].map(([v,n,col])=>`<button data-pl="${v}" class="${cur===v?'on':''}"><i class=ns-dot style="background:${col}"></i>${n}</button>`):SK[k].p.map((p,i)=>`<button data-pl="${i}" class="${pi===i?'on':''}"><i class=ns-dot style="background:${p.ac}"></i>${esc(p.n)}</button>`);
m.innerHTML=`<div class=ns-m><div class=ns-h><b>外觀風格</b><span class=ns-sp></span><button data-a=mclose>✕</button></div><label>風格</label><div class="ns-chips wrap">${Object.keys(SK).map(x=>`<button data-sk="${x}" class="${x===k?'on':''}">${esc(SK[x].n)}</button>`).join('')}</div><label>配色</label><div class="ns-chips wrap">${chips.join('')}</div><div class=ns-sum>${esc(SK[k].d)}</div><button class="pri ns-w" data-a=mclose>完成</button></div>`}
function skinModal(){openM();drawSkin()}
function applyTheme(){const mode=LS.getItem('nai_theme')||'day';let bg,fg;
if(mode==='day'){bg=[246,243,234];fg=[48,45,40]}else if(mode==='night'){bg=[30,31,34];fg=[230,230,230]}
else{const cs=W.getComputedStyle(D.documentElement);const b0=parseC(cs.getPropertyValue('--SmartThemeBlurTintColor'));bg=b0||[255,255,255];fg=parseC(cs.getPropertyValue('--SmartThemeBodyColor'))||[34,34,34];if(!b0&&W.matchMedia&&W.matchMedia('(prefers-color-scheme: dark)').matches){bg=[30,31,34];fg=[230,230,230]}}
const L=a=>.299*a[0]+.587*a[1]+.114*a[2];if(Math.abs(L(bg)-L(fg))<90)fg=L(bg)<128?[230,230,230]:[34,34,34];
const dark=L(bg)<128,k=(a,al)=>`rgba(${a[0]},${a[1]},${a[2]},${al})`,st=root.style;
st.setProperty('--bg',`rgb(${bg})`);st.setProperty('--fg',`rgb(${fg})`);st.setProperty('--bd',k(fg,.2));st.setProperty('--sub',k(fg,.55));st.setProperty('--soft',k(fg,.07));st.setProperty('--btn',k(fg,.09));st.setProperty('--inv',`rgb(${fg})`);st.setProperty('--invt',`rgb(${bg})`);st.setProperty('--shade',dark?'#000b':'#0006');st.setProperty('--ac',dark?'#d6a38a':'#97604b');st.setProperty('--acs',dark?'#d6a38a26':'#97604b1a');st.setProperty('--acf','#fff');applySkin()}
function cycleTheme(){const o=['day','night','auto'],n=o[(o.indexOf(LS.getItem('nai_theme')||'day')+1)%3];LS.setItem('nai_theme',n);applyTheme();toast({auto:'主題：跟隨酒館',day:'主題：日間',night:'主題：夜間'}[n])}
const fab=g('ns-fab'),vp=()=>({w:W.visualViewport?.width||W.innerWidth,h:W.visualViewport?.height||W.innerHeight});
function lay(){const{w,h}=vp(),p=g('ns-panel');p.style.left='10px';p.style.top='10px';p.style.width=(w-20)+'px';p.style.height=(h-20)+'px'}
function openM(){S.tok=uid();S.fs=false;const{w,h}=vp(),m=g('ns-modal');m.style.width=w+'px';m.style.height=h+'px';m.style.display='flex';return m}
async function wipe(kind){
if(kind==='thumbs'){if(!W.confirm('清除所有縮圖？名稱、正負面、標籤等文字都會保留。'))return;await tx('readwrite',s=>{S.items.forEach(it=>{it.thumb='';s.put(it)})});S.shown=0;S.nc.clear();render();toast('已清除所有縮圖');return}
if(!W.confirm('這會刪掉畫師串庫裡的全部資料：畫師串、縮圖、負面詞筆記、標籤和設定。\n建議先匯出備份。要繼續嗎？'))return;
if(!W.confirm('最後確認：刪除後無法復原。真的要全部清除嗎？'))return;
await tx('readwrite',s=>{s.clear()});clearTimeout(LS.t);Object.keys(CFG).forEach(k=>delete CFG[k]);
['nai_layout','nai_tab','nai_theme','nai_tagmode','nai_dupskip','nai_autotag','nai_ball','nai_fab','nai_calm','nai_sort'].forEach(k=>{try{W.localStorage.removeItem(k)}catch(e){}});
Object.assign(S,{items:[],notes:[],tagList:[],tagSel:[],mf:null,sel:null,shown:0,layout:'2',tab:'a',tag:null,q:''});S.nc.clear();g('ns-q').value='';closeM();applyTheme();render();toast('已全部清除')}
function pauseAnim(on){let s=D.getElementById('ns-pause');if(on&&LS.getItem('nai_calm')!=='0'){if(!s){s=D.createElement('style');s.id='ns-pause';s.textContent='*,*::before,*::after{animation-play-state:paused!important}';D.head.appendChild(s)}}else if(s)s.remove()}
function showPanel(on){const p=g('ns-panel');if(on){S.openAt=Date.now();try{const ae=D.activeElement;if(ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))ae.blur();}catch(e){}applyTheme();lay();p.style.display='flex';pauseAnim(true);render()}else{p.style.display='none';pauseAnim(false);g('ns-list').innerHTML='';S.shown=0;S.nc.clear()}}
function placeFab(x,y){const{w,h}=vp();x=Math.max(0,Math.min(w-46,x));y=Math.max(0,Math.min(h-46,y));fab.style.left=x+'px';fab.style.top=y+'px';return{x,y}}
let sp;try{sp=JSON.parse(LS.getItem('nai_fab'))}catch(e){}sp=sp||{x:6,y:vp().h*.42};
let fp=placeFab(sp.x,sp.y),dr=null;
fab.style.display=LS.getItem('nai_ball')==='0'?'none':'flex';
fab.addEventListener('pointerdown',e=>{dr={sx:e.clientX,sy:e.clientY,ox:fp.x,oy:fp.y,m:false};try{fab.setPointerCapture(e.pointerId)}catch(x){}});
fab.addEventListener('pointermove',e=>{if(!dr)return;const dx=e.clientX-dr.sx,dy=e.clientY-dr.sy;if(Math.abs(dx)+Math.abs(dy)>8)dr.m=true;if(dr.m)fp=placeFab(dr.ox+dx,dr.oy+dy)});
fab.addEventListener('pointerup',()=>{if(!dr)return;const m=dr.m;dr=null;if(m){LS.setItem('nai_fab',JSON.stringify(fp));fab._mv=Date.now()}});
fab.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(fab._mv&&Date.now()-fab._mv<600){fab._mv=0;return}showPanel(g('ns-panel').style.display==='none')});
fab.addEventListener('pointercancel',()=>{dr=null});
const onRz=()=>{fp=placeFab(fp.x,fp.y);if(g('ns-panel').style.display!=='none')lay();const m=g('ns-modal');if(m.style.display!=='none'){const{w,h}=vp();m.style.width=w+'px';m.style.height=h+'px'}};
W.addEventListener('resize',onRz);
function menu(){const on=fab.style.display!=='none';sheet('畫師串庫',[['開啟畫師串庫',()=>showPanel(true)],[on?'隱藏懸浮球':'顯示懸浮球',()=>{fab.style.display=on?'none':'flex';LS.setItem('nai_ball',on?'0':'1')}],['主題：日間／夜間／跟隨酒館',cycleTheme],['重置懸浮球位置',()=>{fp=placeFab(6,vp().h*.42);LS.setItem('nai_fab',JSON.stringify(fp));fab.style.display='flex';LS.setItem('nai_ball','1')}]])}
g('ns-q').addEventListener('input',e=>{const v=e.target.value.trim().toLowerCase();clearTimeout(S.qt);S.qt=setTimeout(()=>{S.q=v;S.shown=0;render()},250)});
g('ns-pages').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(!b||b.disabled)return;S.page+=b.dataset.page==='next'?1:-1;S.shown=1;render();g('ns-list').scrollTop=0});
g('ns-pages').addEventListener('change',e=>{if(e.target.id!=='ns-pagesize')return;S.pageSize=Math.max(10,Math.min(30,Number(e.target.value)||20));S.page=1;S.shown=1;render();g('ns-list').scrollTop=0});
g('ns-file').addEventListener('change',async e=>{const fs=[...e.target.files];e.target.value='';if(!fs.length)return;
if(S.fmode==='replace'){const f=fs[0],th=await toThumb(f),{md:m}=await readMeta(f);S.cur.thumb=th.thumb;g('d-img').innerHTML=th.thumb?`<img class=ns-big src="${th.thumb}">`:'';
if(m.pos&&!g('d-pos').value)g('d-pos').value=m.pos;if(m.neg&&!g('d-neg').value)g('d-neg').value=m.neg;F.forEach(k=>{if(m[k]&&!g('d-'+k).value)g('d-'+k).value=m[k]})}else await addFiles(fs)});
g('ns-json').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(f)await importJson(await f.text())});
root.addEventListener('change',e=>{const i=e.target.dataset.bi;if(i!=null)S.b[i].on=e.target.checked});

// ---------- multilingual positive-prompt review; suggest, never auto-edit ----------
const REVIEW_RULES={
 '人物／數量':['1girl','1boy','2girls','2boys','3girls','3boys','4girls','4boys','multiple girls','multiple boys','multiple people','group of people','girl','boy','girls','boys','woman','women','man','men','female','male','lady','ladies','gentleman','gentlemen','person','people','character','characters','少女','少年','女孩','男孩','女生','男生','女人','男人','女性','男性','女孩们','男孩们','女生們','男生們','多人','雙人','双人','人物','角色','人物設定','人物设定','角色設定','角色设定','原創角色','原创角色','原創人物','原创人物','一名女孩','一名男孩','一个女孩','一个男孩','一個女孩','一個男孩','一位少女','一位少年','女孩和男孩','男孩和女孩','女生和男生','男生和女生'],
 '外貌／髮型／五官':['long hair','short hair','black hair','blonde hair','white hair','silver hair','blue hair','pink hair','brown hair','red hair','green hair','purple hair','ponytail','twintails','braid','braided hair','curly hair','straight hair','messy hair','bangs','hair ornament','blue eyes','red eyes','green eyes','brown eyes','closed eyes','heterochromia','freckles','glasses','fangs','animal ears','cat ears','fox ears','tail','long eyelashes','makeup','長髮','短髮','黑髮','黑发','金髮','金发','白髮','白发','銀髮','银发','藍髮','蓝发','粉髮','粉发','棕髮','棕发','紅髮','红发','綠髮','绿发','紫髮','紫发','馬尾','马尾','雙馬尾','双马尾','辮子','辫子','捲髮','卷发','直髮','直发','瀏海','刘海','髮飾','发饰','藍眼睛','蓝眼睛','紅眼睛','红眼睛','綠眼睛','绿眼睛','異色瞳','异色瞳','雀斑','眼鏡','眼镜','尖牙','獸耳','兽耳','貓耳','猫耳','狐耳','尾巴','睫毛','化妝','化妆','外貌','長相','长相','髮色','发色','瞳色'],
 '服裝／配件':['school uniform','uniform','dress','black dress','white dress','shirt','blouse','skirt','shorts','pants','jeans','kimono','maid','armor','suit','coat','jacket','hoodie','swimsuit','bikini','lingerie','hat','ribbon','necklace','earrings','gloves','boots','stockings','high heels','制服','校服','連身裙','连衣裙','洋裝','洋装','裙子','襯衫','衬衫','短褲','短裤','長褲','长裤','牛仔褲','牛仔裤','和服','女僕','女仆','盔甲','西裝','西装','外套','帽子','蝴蝶結','蝴蝶结','項鍊','项链','耳環','耳环','手套','靴子','絲襪','丝袜','高跟鞋','泳裝','泳装','比基尼','服裝','服装','穿著','穿着','穿着一身','戴著','戴着'],
 '動作／姿勢':['sitting','standing','walking','running','lying','kneeling','crouching','looking at viewer','looking away','holding','reaching','waving','jumping','dancing','hugging','kissing','fighting','arms up','crossed arms','hand on hip','hand on face','leaning','turning around','sitting on','standing on','坐著','坐着','站立','站著','站着','行走','走路','奔跑','跑步','躺著','躺着','跪著','跪着','蹲著','蹲着','看向觀眾','看向观众','看著鏡頭','看着镜头','手持','拿著','拿着','揮手','挥手','跳躍','跳跃','跳舞','擁抱','拥抱','接吻','親吻','亲吻','戰鬥','战斗','雙手舉起','双手举起','抱著','抱着','靠著','靠着','回頭','回头','姿勢','姿势','動作','动作'],
 '表情／情緒':['smile','smiling','blush','crying','tears','angry','sad','happy','surprised','open mouth','closed mouth','wink','pouting','expression','微笑','笑容','臉紅','脸红','哭泣','流淚','流泪','生氣','生气','悲傷','悲伤','開心','开心','驚訝','惊讶','張嘴','张嘴','閉嘴','闭嘴','眨眼','嘟嘴','表情','情緒','情绪'],
 '場景／物件':['bedroom','classroom','school','forest','beach','city','street','room','indoors','outdoors','garden','park','river','mountain','sky','night sky','sunset','sunrise','rain','snow','bed','chair','sofa','window','table','car','train','weapon','sword','gun','flower','book','phone','umbrella','臥室','卧室','教室','學校','学校','森林','海灘','海滩','城市','街道','房間','房间','室內','室内','戶外','户外','花園','花园','公園','公园','河流','山','天空','夜空','日落','日出','下雨','雨天','下雪','床','椅子','沙發','沙发','窗戶','窗户','桌子','汽車','汽车','火車','火车','武器','劍','剑','槍','枪','花朵','書本','书本','手機','手机','雨傘','雨伞','背景','場景','场景'],
 '構圖／鏡頭':['portrait','full body','upper body','close-up','cowboy shot','from above','from below','wide shot','side view','back view','profile','looking at viewer','dynamic angle','構圖','特寫','特写','全身','半身','上半身','近景','遠景','远景','俯視','俯视','仰視','仰视','側面','侧面','背影','側身','侧身','視角','视角','鏡頭','镜头']
};
function reviewMatches(it){
 const pos=String(it.pos||''); if(!pos.trim())return [];
 const parts=pos.split(/[,，]+/).map(x=>x.trim()).filter(Boolean), found=[];
 const norm=x=>String(x).toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
 for(const part of parts){const p=norm(part);const cats=[];for(const [cat,terms] of Object.entries(REVIEW_RULES)){if(terms.some(term=>{const t=norm(term);if(/^[a-z0-9 ]+$/.test(t)){return new RegExp('(^|[^a-z0-9])'+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+')+'($|[^a-z0-9])','i').test(p)}return p.includes(t)}))cats.push(cat)}if(cats.length)found.push({part,cats})}
 return found;
}
function promptReviewModal(){
 const matches=S.items.map(it=>({it,hits:reviewMatches(it)})).filter(x=>x.hits.length).sort((a,b)=>b.hits.length-a.hits.length||(b.it.t||0)-(a.it.t||0));
 const m=openM();
 const row=({it,hits})=>{const suggestion=[...new Set(hits.map(x=>x.part))];return `<div class="ns-pairrow"><${it.thumb?'img':'div'} class="ns-pairthumb" ${it.thumb?`src="${it.thumb}"`:'style="display:none"'}></${it.thumb?'img':'div'}><div class="ns-pairbody"><b>${esc(it.name||'未命名')}</b><small>命中類別：${esc([...new Set(hits.flatMap(x=>x.cats))].join('、'))}</small><small>命中詞：${esc(suggestion.join('，'))}</small><small>正面預覽：${esc((it.pos||'').slice(0,240))}${(it.pos||'').length>240?'…':''}</small><small><b>建議檢查／可考慮刪除：</b>${esc(suggestion.join('，'))}</small><div class="ns-pairactions"><button data-pair-open="${esc(it.id)}">查看／編輯</button><button data-review-copy="${esc(it.id)}">複製建議詞</button><button data-pair-del="${esc(it.id)}">刪除整筆</button></div></div></div>`};
 m.innerHTML=`<div class="ns-m"><div class="ns-h"><b>正面提示詞檢查：${matches.length} 筆</b><span class="ns-sp"></span><button data-a="mclose">✕</button></div><div class="ns-sum">只掃描正面提示詞，支援英文標籤及簡體／繁體中文。這是寬鬆規則式檢查：外貌、服裝、動作、場景、表情與構圖詞都可能被列出，包含可能屬於畫風的詞。<b>不會自動修改或刪除提示詞。</b>「建議檢查／可考慮刪除」只是命中的片段，請逐筆確認；可進入編輯自行刪除，也可以刪除整筆收藏。</div><div class="ns-pairlist">${matches.map(row).join('')||'<div class="ns-e">沒有找到符合目前規則的正面提示詞。</div>'}</div></div>`;
}
async function copyReviewTerms(id){const it=S.items.find(x=>x.id===id);if(!it)return;const terms=[...new Set(reviewMatches(it).map(x=>x.part))];await copy(terms.join(', '));}
async function deleteGirlBoyMatch(id){
  const it=S.items.find(x=>x.id===id);
  if(!it){toast('這筆已不存在');return}
  if(!W.confirm(`確定刪除整筆畫師串收藏？\n\n${it.name||'未命名'}\n\n此操作無法從腳本內復原，建議先匯出 JSON 備份。`))return;
  const modal=g('ns-modal');
  const list=modal&&modal.querySelector('.ns-pairlist');
  const row=list?[...list.querySelectorAll('[data-pair-del]')].find(b=>b.dataset.pairDel===String(id))?.closest('.ns-pairrow'):null;
  const scrollTop=list?list.scrollTop:0;
  // Delete the stored item, then remove only its row. Do not call openM()/promptReviewModal(),
  // because rebuilding the modal can reset the current view on mobile browsers.
  await dbDel(id);
  S.items=S.items.filter(x=>x.id!==id);
  if(S.sel)S.sel.delete(id);
  if(S.nc)S.nc.delete(id);
  if(row)row.remove();
  const heading=modal&&modal.querySelector('.ns-h b');
  if(heading){const remaining=modal.querySelectorAll('.ns-pairrow').length;heading.textContent=`正面提示詞檢查：${remaining} 筆`}
  if(list)list.scrollTop=scrollTop;
  if(list&&!list.querySelector('.ns-pairrow'))list.innerHTML='<div class="ns-e">目前沒有其他符合條件的項目。</div>';
  toast('已刪除 1 筆；仍停留在檢查清單');
}
// ---------- settings + rule-based prompt cleanup ----------
function settingsModal(){
  sheet('設定',[
    ['外觀風格：'+SK[skinNow()].n+'（Y2K／XP／Ins，多種配色）',skinModal],
    ['主題模式：'+({'auto':'跟隨酒館','day':'日間紙感','night':'夜間'}[LS.getItem('nai_theme')||'day']||'跟隨酒館'),cycleTheme],
    ['開面板時暫停酒館動畫：'+(LS.getItem('nai_calm')!=='0'?'開':'關'),()=>{LS.setItem('nai_calm',LS.getItem('nai_calm')!=='0'?'0':'1');toast('已更新動畫設定')}],
    ['匯入時自動加標籤：'+(S.autoTag?'開':'關'),()=>{S.autoTag=!S.autoTag;LS.setItem('nai_autotag',S.autoTag?'1':'0');toast('已更新自動標籤設定')}],
    ['匯入時略過重複：'+(S.skipDup?'開':'關'),()=>{S.skipDup=!S.skipDup;LS.setItem('nai_dupskip',S.skipDup?'1':'0');toast('已更新重複項目設定')}],
    ['完成',closeM]
  ]);
}
const PROMPT_REMOVE_TAGS=new Set((
'1girl,1boy,2girls,2boys,3girls,3boys,4girls,5girls,multiple girls,multiple boys,solo,duo,group,solo focus,male focus,female focus,'
+'girl,boy,man,woman,child,teen,adult,young girl,young boy,'
+'standing,sitting,kneeling,lying,lying on side,lying on back,lying on stomach,crouching,squatting,walking,running,jumping,dancing,flying,'
+'looking at viewer,looking away,looking back,looking up,looking down,looking at another,smiling,grin,laughing,crying,blushing,open mouth,closed mouth,'
+'holding,holding weapon,holding sword,holding gun,holding book,holding phone,holding cup,carrying,pointing,peace sign,waving,arms up,arms crossed,'
+'portrait,upper body,full body,close-up, cowboy shot,from above,from below,side view,profile,front view,back view,three-quarter view,'
+'indoors,outdoors,bedroom,classroom,school,street,city,forest,beach,sea,ocean,mountain,river,park,garden,field,desert,night,day,night sky,sky,clouds,'
+'sunset,sunrise,starry sky,moon,water,underwater,ruins,castle,church,train station,library,cafe,restaurant,office,bed,window,door,'
+'looking at phone,phone,smartphone,computer,laptop,car,motorcycle,bicycle,train,airplane,weapon,sword,gun,flower bouquet,food'
).split(',').map(x=>x.trim().toLowerCase().replace(/\s+/g,'_')).filter(Boolean));
function cleanArtistPrompt(text){
  const parts=String(text||'').split(',');
  const keep=[],removed=[];
  for(const raw of parts){
    const t=raw.trim(), n=t.toLowerCase().replace(/\s+/g,'_');
    if(!t){continue}
    // Never touch artist/style/quality tags; only remove recognized subject, action, framing and scene tags.
    const isArtist=/^(artist|style|quality|masterpiece|best_quality|highres|absurdres|score_\d+|source_)/i.test(n);
    const isCharacter=/^(1girl|1boy|[2-9]girls?|[2-9]boys?|solo|duo|group|multiple_(girls|boys)|girl|boy|woman|man|female|male|child|teen|adult)(_|$)/i.test(n);
    const isAction=/^(standing|sitting|kneeling|lying|crouching|squatting|walking|running|jumping|dancing|flying|smiling|grin|laughing|crying|blushing|holding|carrying|pointing|waving|looking_at_|looking_away|looking_back|looking_up|looking_down|arms_up|arms_crossed|peace_sign|open_mouth|closed_mouth)(_|$)/i.test(n);
    const isScene=/^(indoors|outdoors|bedroom|classroom|school|street|city|forest|beach|sea|ocean|mountain|river|park|garden|field|desert|night|day|night_sky|sky|clouds|sunset|sunrise|starry_sky|moon|underwater|ruins|castle|church|train_station|library|cafe|restaurant|office|bed|window|door|scenery|background)(_|$)/i.test(n);
    if(!isArtist&&(PROMPT_REMOVE_TAGS.has(n)||isCharacter||isAction||isScene)){removed.push(t)}else keep.push(t);
  }
  return {text:keep.join(', '),removed};
}
async function cleanSelectedPrompts(){
  const pickedItems=S.items.filter(it=>S.sel&&S.sel.has(it.id));
  if(!pickedItems.length){toast('請先按「選取」並選擇要清理的卡片');return}
  const changes=[];
  for(const it of pickedItems){
    const r=cleanArtistPrompt(it.pos||'');
    if(r.removed.length)changes.push({it,old:it.pos||'',next:r.text,removed:r.removed});
  }
  if(!changes.length){toast('沒有找到可依規則清理的角色／場景／動作標籤');return}
  const sample=changes.slice(0,3).map(x=>`「${x.it.name}」移除：${x.removed.slice(0,12).join(', ')}${x.removed.length>12?'…':''}`).join('\n');
  if(!W.confirm(`規則式清理預覽：${changes.length} / ${pickedItems.length} 筆會有變更。\n只修改正面串（pos），不改負面詞、名稱、畫師標籤或其他欄位。\n\n${sample}\n\n規則判斷可能誤刪，建議先匯出 JSON 備份。要套用嗎？`))return;
  for(const x of changes){x.it.pos=x.next;await dbPut(x.it);upsert(x.it)}
  S.sel=new Set();render();toast(`已清理 ${changes.length} 筆正面串；負面詞與其他欄位未修改`);
}
root.addEventListener('click',async e=>{const T=e.target;
if(T.closest('#ns-fab'))return;
if(S.openAt&&Date.now()-S.openAt<500&&T.closest('#ns-panel'))return;
const pairDel=T.closest('[data-pair-del]');if(pairDel){await deleteGirlBoyMatch(pairDel.dataset.pairDel);return}
const reviewCopy=T.closest('[data-review-copy]');if(reviewCopy){await copyReviewTerms(reviewCopy.dataset.reviewCopy);return}
const pairOpen=T.closest('[data-pair-open]');if(pairOpen){const it=S.items.find(x=>x.id===pairOpen.dataset.pairOpen);if(it)detail(it);return}
const sh=T.closest('[data-sh]');if(sh){const f=S.sh[sh.dataset.sh][1];closeM();f();return}
const st=T.closest('[data-star]');if(st){e.stopPropagation();const it=S.items.find(x=>x.id===st.dataset.star);it.fav=it.fav?0:1;st.textContent=it.fav?'★':'☆';touchCard(it.id);await dbPut(it);if(S.filter==='fav')render();return}
const ly=T.closest('[data-l]');if(ly){S.layout=ly.dataset.l;LS.setItem('nai_layout',S.layout);S.shown=0;render();return}
const skb=T.closest('[data-sk]');if(skb){LS.setItem('nai_skin',skb.dataset.sk);LS.setItem('nai_pal','0');applyTheme();drawSkin();return}
const plb=T.closest('[data-pl]');if(plb){const v=plb.dataset.pl;if(skinNow()==='paper')LS.setItem('nai_theme',v);else LS.setItem('nai_pal',v);applyTheme();drawSkin();return}
const xb=T.closest('[data-x]');if(xb){const v=xb.dataset.x;if(v==='fav')S.filter='all';else if(v==='mf')S.mf=null;else if(v.startsWith('tag:'))S.tagSel=S.tagSel.filter(t=>t!==v.slice(4));S.shown=0;render();return}
const fl=T.closest('[data-f]');if(fl){S.filter=fl.dataset.f;S.shown=0;render();if(S.fs)drawFilter();return}
const mfb=T.closest('[data-mf]');if(mfb){S.mf=S.mf===mfb.dataset.mf?null:mfb.dataset.mf;S.shown=0;render();if(S.fs)drawFilter();return}
const dmb=T.closest('[data-dm]');if(dmb){const k=dmb.dataset.dm;if(k==='auto'){S.cur.models=[];S.cur.mfrom=''}else{let a=modelOf(S.cur).m.filter(x=>x!=='4+');a=a.includes(k)?a.filter(x=>x!==k):[...a,k];a.sort((x,y)=>MORD.indexOf(x)-MORD.indexOf(y));S.cur.models=a;S.cur.mfrom=a.length?'manual':''}drawM();return}
const tf=T.closest('[data-tf]');if(tf){const v=tf.dataset.tf;if(!v)S.tagSel=[];else S.tagSel=S.tagSel.includes(v)?S.tagSel.filter(x=>x!==v):[...S.tagSel,v];S.shown=0;render();if(S.fs)drawFilter();return}
const dtr=T.closest('[data-dtr]');if(dtr){S.cur.tags=S.cur.tags.filter(x=>x!==dtr.dataset.dtr);drawDT();return}
const dta=T.closest('[data-dta]');if(dta){addTagTo(S.cur,dta.dataset.dta);drawDT();return}
const trn=T.closest('[data-trn]');if(trn){await renameTag(trn.dataset.trn);return}
const tdl=T.closest('[data-tdl]');if(tdl){await deleteTag(tdl.dataset.tdl);return}
const xx=T.closest('[data-ex]');if(xx){S.ex[xx.dataset.ex]=!S.ex[xx.dataset.ex];drawEx();return}
const tb=T.closest('[data-tab]');if(tb){S.tab=tb.dataset.tab;LS.setItem('nai_tab',S.tab);S.sel=null;S.shown=0;render();return}
const ns=T.closest('[data-nstar]');if(ns){const n=S.notes.find(x=>x.id===ns.dataset.nstar);n.fav=n.fav?0:1;await dbPut(n);render();return}
const nc=T.closest('[data-ncp]');if(nc){copy(S.notes.find(x=>x.id===nc.dataset.ncp).text);return}
const nd=T.closest('[data-nid]');if(nd){detailN(S.notes.find(x=>x.id===nd.dataset.nid));return}
const cd=T.closest('.ns-c');if(cd){const it=S.items.find(x=>x.id===cd.dataset.id);if(S.sel){const was=S.sel.has(it.id);was?S.sel.delete(it.id):S.sel.add(it.id);cd.classList.toggle('sel',!was);const ck=cd.querySelector('.ns-ck');if(ck)ck.classList.toggle('on',!was);touchCard(it.id);g('ns-cnt').textContent='已選 '+S.sel.size}else detail(it);return}
const a=T.closest('[data-a]')?.dataset.a;if(!a)return;
const picked=()=>S.items.filter(x=>S.sel&&S.sel.has(x.id));
switch(a){
case'ex-go':{const l=exList();if(!l.length){toast('沒有資料');break}const o=S.ex,d=new Date(),ds=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
dlBlob(`NAI畫師串筆記本-${ds}.html`,buildHtml(l,o,o.scope==='all'&&o.notes?S.notes:[]),'text/html');closeM();toast('已產生筆記本，請看下載項目');break}
case'srch':{S.sopen=!S.sopen;const r=g('ns-srow');r.style.display=S.sopen?'flex':'none';if(S.sopen)g('ns-q').focus();else{g('ns-q').value='';S.q='';S.shown=0;render()}break}
case'lay':{const o=['1','2','3','0'];S.layout=o[(o.indexOf(S.layout)+1)%4];LS.setItem('nai_layout',S.layout);S.shown=0;render();break}
case'flt':openFilter();break;
case'fclr':S.filter='all';S.mf=null;S.tagSel=[];S.shown=0;render();drawFilter();break;
case's-more':{const n=S.sel?S.sel.size:0;if(!n){toast('還沒選');break}const h=a=>()=>root.querySelector('#ns-hid [data-a='+a+']').click();sheet(`更多操作（已選 ${n} 張）`,[['匯出…',h('s-exp')],['送到 iPhonie',h('s-ip')],['移除標籤…',h('s-untag')],['刪除',h('s-del')]]);break}
case'sort':sheet('排序方式',Object.keys(SORTL).map(k=>[(S.sort===k?'✓ ':'')+SORTL[k],()=>{S.sort=k;LS.setItem('nai_sort',k);S.shown=0;render()}]));break;
case'tg-mode':S.tagMode=S.tagMode==='and'?'or':'and';LS.setItem('nai_tagmode',S.tagMode);S.shown=0;render();if(S.fs)drawFilter();break;
case'tg-mng':tagModal();break;
case'tg-add':{let ch=false;g('tg-new').value.split(/[,，、]/).map(x=>x.trim()).filter(Boolean).forEach(t=>{ch=addTagLib(t)||ch});if(ch)await saveTagList();tagModal();render();break}
case'd-tadd':{g('d-tin').value.split(/[,，、]/).map(x=>x.trim()).filter(Boolean).forEach(t=>addTagTo(S.cur,t));g('d-tin').value='';drawDT();break}
case'sg-go':{const on=[...root.querySelectorAll('[data-sg]:checked')].map(x=>S.sg[x.dataset.sg]);if(!on.length)break;let cnt=0,ch=false;
for(const s of on){ch=addTagLib(s.tag)||ch;for(const id of s.newIds){const it=S.items.find(x=>x.id===id);if(it){addTagTo(it,s.tag);await dbPut(it);cnt++}}}
if(ch)await saveTagList();closeM();render();toast(`已建立 ${on.length} 個標籤，套用 ${cnt} 次`);break}
case's-tag':{const p=picked();if(!p.length){toast('還沒選');break}sheet(`加標籤到 ${p.length} 筆`,[...allTags().map(t=>[esc(t),()=>applyTag(p,t,true)]),['＋新建標籤…',()=>{const v=W.prompt('新標籤名稱（可用逗號分開多個）');if(v)v.split(/[,，、]/).map(x=>x.trim()).filter(Boolean).forEach(t=>applyTag(p,t,true))}]]);break}
case's-untag':{const p=picked();if(!p.length){toast('還沒選');break}const ts=[...new Set(p.flatMap(i=>i.tags||[]))];if(!ts.length){toast('選到的筆都沒有標籤');break}sheet('移除標籤',ts.map(t=>[esc(t),()=>applyTag(p,t,false)]));break}
case's-mdl':{const p=picked();if(!p.length){toast('還沒選');break}const set=a=>async()=>{for(const it of p){it.models=a;it.mfrom=a.length?'manual':'';await dbPut(it)}render();toast(a.length?'已設定模型：'+a.join('、'):'已改回自動判斷')};
sheet(`設定適用模型（${p.length} 筆）`,[['只有 4.5',set(['4.5'])],['只有 5',set(['5'])],['4.5 和 5 皆可',set(['4.5','5'])],['改回自動判斷',set([])]]);break}
case's-ip':{const p=picked();if(!p.length){toast('還沒選');break}await sendIp(p);break}
case'dd-del':{const ids=[...root.querySelectorAll('[data-dd]:checked')].map(x=>x.dataset.dd);if(!ids.length)break;if(!W.confirm(`刪除 ${ids.length} 筆？`))break;
for(const gr of S.dg){const keep=gr.filter(x=>!ids.includes(x.id));if(keep.length&&gr.some(x=>ids.includes(x.id)&&x.fav)&&!keep[0].fav){keep[0].fav=1;await dbPut(keep[0])}}
for(const id of ids)await dbDel(id);
if(S.tab==='n')S.notes=S.notes.filter(x=>!ids.includes(x.id));else S.items=S.items.filter(x=>!ids.includes(x.id));
closeM();render();toast(`已刪除 ${ids.length} 筆`);break}
case'n-cp':copy(g('n-text').value);break;
case'n-fav':S.curN.fav=S.curN.fav?0:1;T.textContent=(S.curN.fav?'★':'☆')+' 收藏';break;
case'n-save':{const n=S.curN;n.name=g('n-name').value.trim()||'未命名';n.text=g('n-text').value;await dbPut(n);const i=S.notes.findIndex(x=>x.id===n.id);i<0?S.notes.push(n):S.notes[i]=n;closeM();render();toast('已儲存');break}
case'n-del':if(W.confirm('刪除這筆？')){const n=S.curN;if(S.notes.some(x=>x.id===n.id)){await dbDel(n.id);S.notes=S.notes.filter(x=>x.id!==n.id)}closeM();render()}break;
case'd2n':{const t=g('d-neg').value.trim();if(!t){toast('負面是空的');break}const n={...blankN(),name:(g('d-name').value.trim()||'未命名')+' 負面',text:t};await dbPut(n);S.notes.push(n);toast('已存到負面詞筆記');break}
case'theme':cycleTheme();break;
case'pdet':resModal();break;
case'pcomp-cancel':{if(S.compCancel)S.compCancel();toast('正在安全停止：目前處理中的圖片完成後會停止');break;}
case'pcomp':{const z=S.compSummary;if(z)W.alert(`${z.cancelled?'已取消':'壓縮完成'}：${z.done} 張\\n成功替換：${z.changed} 張\\n未變小而保留原圖：${z.skipped} 張\\n失敗：${z.failed} 張\\n估算節省：${(Math.max(0,z.before-z.after)/1024).toFixed(1)} KB`);break;}
case'close':showPanel(false);break;
case'mclose':closeM();break;
case'add':if(S.tab==='n'){detailN(blankN());break}sheet('新增',[['上傳圖片（可多選）',()=>{S.fmode='add';g('ns-file').click()}],['手動新增',()=>detail(blank())],['批量匯入文字',batch]]);break;
case'settings':settingsModal();break;
case'bak':sheet('工具',[['批量檢查疑似角色／場景提示詞（逐筆檢查）',promptReviewModal],['圖片效能：批次壓縮已儲存縮圖',compressThumbs],['清理圖片暫存／卡片快取',clearImageTemp],['清理選取項目的角色／場景／動作標籤',cleanSelectedPrompts],['標籤管理',tagModal],['模型標示說明',modelHelp],['自動分組（依名稱／提示詞）',autoModal],['匯出 HTML 筆記本（含效果圖）',()=>exportModal('all')],['匯出全部 JSON',()=>dl('nai-saver-all.json',{items:S.items,notes:S.notes,tags:S.tagList})],['匯入 JSON',()=>g('ns-json').click()],['清除資料…',()=>sheet('清除資料',[['先匯出備份（JSON）',()=>dl('nai-saver-all.json',{items:S.items,notes:S.notes,tags:S.tagList})],['只清除縮圖（文字、標籤保留）',()=>wipe('thumbs')],['清除全部資料…',()=>wipe('all')]])],['檢測重複（目前這一頁）',dupModal]]);break;
case'sel':S.sel=S.sel?null:new Set();render();break;
case'cp-pos':copy(g('d-pos').value);break;
case'cp-neg':copy(g('d-neg').value);break;
case'dfav':S.cur.fav=S.cur.fav?0:1;T.textContent=(S.cur.fav?'★':'☆')+' 收藏';break;
case'dimg':S.fmode='replace';g('ns-file').click();break;
case'save':{const it=pull(),k=normKey(it.pos),ex=k&&S.items.find(y=>y.id!==it.id&&normKey(y.pos)===k);let ch=false;(it.tags||[]).forEach(t=>{ch=addTagLib(t)||ch});if(ch)await saveTagList();await dbPut(it);upsert(it);closeM();render();toast('已儲存'+(ex?`（注意：與「${ex.name}」的正面相同）`:''));break}
case'ddel':if(W.confirm('刪除這筆？')){if(S.items.some(x=>x.id===S.cur.id)){await dbDel(S.cur.id);S.items=S.items.filter(x=>x.id!==S.cur.id)}closeM();render()}break;
case'b-last':g('b-t').value=lastMsg();case'b-parse':S.b=parseBatch(g('b-t').value);markDup(S.b);bRender();break;
case'b-save':{const a=S.b.filter(o=>o.on);for(const o of a){const it={...blank(),name:o.name,pos:o.pos};await autoApply(it);await dbPut(it);upsert(it)}closeM();render();toast(`已存入 ${a.length} 筆`);break}
case's-all':{const v=vis();S.sel=S.sel.size===v.length?new Set():new Set(v.map(x=>x.id));render();break}
case's-fav':{const p=picked();if(!p.length)break;const v=p.every(x=>x.fav)?0:1;for(const it of p){it.fav=v;await dbPut(it)}render();break}
case's-exp':{const p=picked();if(!p.length)return toast('還沒選');sheet('匯出已選取',[['JSON（可重新匯入）',()=>dl('nai-saver-selected.json',p)],['HTML 筆記本（含效果圖）',()=>exportModal('sel')]]);break}
case's-del':{const p=picked();if(!p.length)break;if(W.confirm(`刪除 ${p.length} 筆？`)){for(const it of p)await dbDel(it.id);S.items=S.items.filter(x=>!S.sel.has(x.id));S.sel=new Set();render()}break}
}});
root.addEventListener('keydown',e=>{if(e.key!=='Enter')return;const id=e.target.id;if(id==='d-tin'||id==='tg-new'){e.preventDefault();root.querySelector(id==='d-tin'?'[data-a=d-tadd]':'[data-a=tg-add]').click()}});
window.addEventListener('pagehide',()=>{D.getElementById('ns-pause')?.remove();root.remove();css.remove();W.removeEventListener('resize',onRz)});
applyTheme();
dbAll().then(a=>{a=a||[];S.items=a.filter(x=>x.kind!=='note'&&x.kind!=='meta');S.notes=a.filter(x=>x.kind==='note');const mt=a.find(x=>x.id==='meta-tags');S.tagList=mt&&Array.isArray(mt.list)?mt.list:[];
const ms=a.find(x=>x.id==='meta-settings');
if(ms&&ms.cfg){Object.assign(CFG,ms.cfg);S.layout=CFG.nai_layout||S.layout;S.sort=CFG.nai_sort||S.sort;S.tab=CFG.nai_tab||S.tab;S.tagMode=CFG.nai_tagmode||S.tagMode;if(CFG.nai_dupskip!=null)S.skipDup=CFG.nai_dupskip!=='0';if(CFG.nai_autotag!=null)S.autoTag=CFG.nai_autotag!=='0';
if(CFG.nai_fab){try{const p=JSON.parse(CFG.nai_fab);fp=placeFab(p.x,p.y)}catch(e){}}if(CFG.nai_ball!=null)fab.style.display=CFG.nai_ball==='0'?'none':'flex'}
else{['nai_layout','nai_tab','nai_theme','nai_tagmode','nai_dupskip','nai_autotag','nai_ball','nai_fab','nai_sort'].forEach(k=>{const v=W.localStorage.getItem(k);if(v!=null)CFG[k]=v});if(Object.keys(CFG).length)dbPut({id:'meta-settings',kind:'meta',cfg:CFG})}
applyTheme();render();if(W===window)showPanel(true)}).catch(e=>W.alert('畫師串庫資料庫錯誤：'+(e&&e.message||e)));
window.PTAOpenArtistLibrary=()=>showPanel(true);\ntry{eventOn(getButtonEvent('畫師串庫'),menu)}catch(e){}
toast('畫師串庫已載入');
}catch(e){window.parent.alert('畫師串庫載入失敗：'+(e&&e.message||e))}})();

