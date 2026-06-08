// Variant A — Classic table. Reuses window.PORTS/SAILINGS/CARRIER_META,
// Ico + helpers from hifi-d-parts.jsx, and the same CSV loader + Excel export.
const { useState: uS, useEffect: uE, useRef: uR, useMemo: uM } = React;
const S = window.SAILINGS;
const CM = window.CARRIER_META;

// ───────── shared bits ─────────
function PortSelect({ label, value, onChange, options, allLabel }) {
  const REG = window.PORT_REGIONS || {};
  const groups = []; const seen = {};
  options.forEach(c => {
    const cc = (window.PORTS[c]||{}).country || '—';
    if (seen[cc]===undefined){ seen[cc]=groups.length; groups.push({ region: REG[cc]||cc, codes:[c] }); }
    else groups[seen[cc]].codes.push(c);
  });
  return (
    <div className="field port">
      <label>{label}</label>
      <div className="ctrl">
        <span className="pin">{Ico.pin()}</span>
        <select value={value} onChange={e=>onChange(e.target.value)}>
          {allLabel && <option value="all">{allLabel}</option>}
          {groups.map(g => (
            <optgroup key={g.region} label={g.region}>
              {g.codes.map(c => <option key={c} value={c}>{pname(c)} ({c})</option>)}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );
}

function SearchBar({ q, setQ, onSearch, onExport }) {
  const weeks = [...new Set((window.SAILINGS||[]).map(s=>s.week).filter(Boolean))].sort((a,b)=>a-b);
  return (
    <div className="searchbar">
      <PortSelect label="Port of loading" value={q.pol} onChange={v=>setQ(s=>({...s,pol:v}))} options={window.LANES_POL} allLabel="All origins"/>
      <span className="leg-sep">{Ico.arrowS()}</span>
      <PortSelect label="Port of discharge" value={q.pod} onChange={v=>setQ(s=>({...s,pod:v}))} options={window.LANES_POD} allLabel="All destinations"/>
      <div className="field week">
        <label>ETD week</label>
        <div className="ctrl">
          {Ico.clock({ style:{ color:'var(--sea)' }})}
          <select value={q.weekRange} onChange={e=>setQ(s=>({...s,weekRange:e.target.value}))}>
            <option value="all">All weeks</option>
            {weeks.map(w => <option key={w} value={String(w)}>Week {w}</option>)}
          </select>
        </div>
      </div>
      <div className="field carrier">
        <label>Carrier</label>
        <div className="ctrl">
          <select value={q.carrierSel} onChange={e=>setQ(s=>({...s,carrierSel:e.target.value}))}>
            <option value="all">All carriers</option>
            {window.CARRIER_LIST.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="field search-text">
        <label>Find</label>
        <div className="ctrl">
          <select style={{ display:'none' }}></select>
          <input value={q.text} placeholder="vessel, service, port…" onChange={e=>setQ(s=>({...s,text:e.target.value}))}/>
        </div>
      </div>
      <button className="btn btn-primary" onClick={onSearch}>{Ico.arrowS({ stroke:'#fff' })} Search</button>
      <div className="field export">
        <label>&nbsp;</label>
        <button className="btn btn-ghost" onClick={onExport}>{Ico.pdf()} Export results</button>
      </div>
    </div>
  );
}

function Filters({ filter, setFilter, counts }) {
  const set = (k,v) => setFilter(f => ({ ...f, [k]: v }));
  return (
    <div className="filters">
      <span className="lbl">Routing</span>
      <button className={'chip'+(filter.routing==='all'?' active':'')} onClick={()=>set('routing','all')}>All <span className="count">{counts.all}</span></button>
      <button className={'chip'+(filter.routing==='direct'?' active':'')} onClick={()=>set('routing','direct')}>
        <span className="dot" style={{ background:'var(--green)' }}></span> Direct <span className="count">{counts.direct}</span>
      </button>
      <button className={'chip'+(filter.routing==='ts'?' active':'')} onClick={()=>set('routing','ts')}>
        <span className="dot" style={{ background:'var(--sea)' }}></span> 1 transshipment <span className="count">{counts.ts}</span>
      </button>
      <div style={{ width:1, height:20, background:'var(--line)', margin:'0 4px' }}></div>
      <button className={'chip'+(filter.space?' active':'')} onClick={()=>set('space',!filter.space)}>Space open only</button>
      <button className={'chip'+(filter.starred?' active':'')} onClick={()=>set('starred',!filter.starred)}>{Ico.star({ width:13, height:13, fill: filter.starred?'currentColor':'none' })} Shortlisted</button>
      <span className="results"><b>{counts.shown}</b> sailings</span>
    </div>
  );
}

// ───────── table cells ─────────
function CarrierCell({ s }) {
  const m = CM[s.carrier] || { short:'?', color:'#888' };
  return (
    <span className="ccell">
      <span className="mk" style={{ background:m.color }}>{m.short}</span>
      <span>
        <span className="nm" style={{ display:'block' }}>{s.carrier}</span>
        <span className="sv">{s.service}{s.serviceName?` · ${s.serviceName}`:''}</span>
      </span>
    </span>
  );
}
function PortCell({ code }) {
  return (
    <span className="port-cell" style={{ display:'inline-block' }}>
      <span className="pcode">{pname(code)}</span><br/>
      <span className="pname-sm mono">{code}</span>
    </span>
  );
}
function DateCell({ iso }) {
  return (
    <span className="datecell" style={{ display:'inline-block' }}>
      <span className="d">{fmtDate(iso)}</span><br/>
      <span className="y mono">{(iso||'').slice(0,4)}</span>
    </span>
  );
}
function VesselCell({ v }) {
  if (!v || v.vessel==='—') return <span className="muted">—</span>;
  return (
    <span className="vessel-cell">
      <span className="vn">{v.vessel}</span>
      <span className="vv mono">{v.voyage!=='—'?v.voyage:''}{v.imo&&v.imo!=='—'?` · IMO ${v.imo}`:''}</span>
    </span>
  );
}

// expanded detail row content
function DetailRow({ s, colSpan, onCopy, onExport }) {
  const cut = s.cutoffs || {};
  const cutItems = [['Gate-in',cut.gateIn],['VGM',cut.vgm],['Doc / SI',cut.doc]].filter(x=>x[1]);
  const rot = (s.rotation && s.rotation.length) ? s.rotation : [s.pol, s.ts, s.pod].filter(Boolean);
  return (
    <tr className="detail">
      <td colSpan={colSpan}>
        <div className="detail-inner">
          <div className="detail-block">
            <h4>Routing</h4>
            <div className="route-flow">
              <div className="route-node"><span className="rc">{pname(s.pol)}</span><span className="rn mono">{s.pol} · ETD {fmtDate(s.etd)}</span></div>
              {s.ts && <><span className="route-arrow">{Ico.arrowS()}</span><div className="route-node"><span className="rc" style={{ fontSize:13 }}>{pname(s.ts)}</span><span className="rn mono">{s.ts} · transship</span></div></>}
              <span className="route-arrow">{Ico.arrow()}</span>
              <div className="route-node"><span className="rc">{pname(s.pod)}</span><span className="rn mono">{s.pod} · ETA {fmtDate(s.eta)}</span></div>
            </div>
            <div style={{ marginTop:12 }}>
              <div className="kv"><span className="k">Service rotation</span><span className="v mono">{rot.map(c=>pname(c)).join('  ›  ')}</span></div>
              <div className="kv"><span className="k">Transit time</span><span className="v">{s.transit} days · ETD week {s.week}</span></div>
              {s.co2 && s.co2!=='—' && <div className="kv"><span className="k">Est. CO₂</span><span className="v">{s.co2}</span></div>}
            </div>
          </div>
          <div className="detail-block">
            <h4>Vessels</h4>
            <div className="kv"><span className="k">Mother</span><span className="v">{s.mother.vessel} <span className="mono" style={{ color:'var(--mute)' }}>{s.mother.voyage!=='—'?s.mother.voyage:''}{s.mother.imo&&s.mother.imo!=='—'?` · IMO ${s.mother.imo}`:''}</span></span></div>
            <div className="kv"><span className="k">Feeder</span><span className="v">{s.feeder ? <>{s.feeder.vessel} <span className="mono" style={{ color:'var(--mute)' }}>{s.feeder.voyage!=='—'?s.feeder.voyage:''}</span></> : <span className="muted">— direct</span>}</span></div>
            <div className="kv"><span className="k">Space</span><span className="v">{s.space==='tight' ? <span className="pill tight">{Ico.warn({width:12,height:12})} tight</span> : <span className="pill direct">open</span>}</span></div>
          </div>
          <div className="detail-block">
            <h4>Cut-offs</h4>
            {cutItems.length ? (
              <div className="cutoffs">
                {cutItems.map(([k,v],i)=>(
                  <div className={'cutoff'+(i===0?' soon':'')} key={k}>
                    <div className="cl">{k}</div>
                    <div className="cv mono">{fmtDate(v)} · {fmtTime(v)}</div>
                  </div>
                ))}
              </div>
            ) : <span className="muted" style={{ fontSize:13 }}>Not provided by carrier feed.</span>}
          </div>
          <div className="detail-actions">
            <button className="btn btn-soft btn-sm" onClick={()=>onCopy(s)}>{Ico.copy()} Copy details</button>
            <button className="btn btn-ghost btn-sm" onClick={()=>onExport([s], `sailing_${s.carrier}_${s.pol}-${s.pod}`)}>{Ico.pdf()} Export row</button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// sortable header
function Th({ id, label, sort, setSort, align, w }) {
  const active = sort.key===id;
  const arrow = active ? (sort.dir==='asc'?'▲':'▼') : '';
  const cls = 'sortable'+(align==='num'?' num':align==='center'?' center':'');
  return (
    <th className={cls} style={ w?{ width:w }:null } onClick={()=>setSort(p=> p.key===id ? { key:id, dir:p.dir==='asc'?'desc':'asc' } : { key:id, dir:'asc' })}>
      {label}<span className="arr">{arrow}</span>
    </th>
  );
}

window.SailA = { SearchBar, Filters, CarrierCell, PortCell, DateCell, VesselCell, DetailRow, Th };

// ───────────────────────── tweaks ─────────────────────────
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": ["#1d6fa5", "#2b8cc4"],
  "density": "regular",
  "zebra": true
}/*EDITMODE-END*/;
const ACCENTS = [
  ["#1d6fa5", "#2b8cc4"],  // sea blue (default)
  ["#0f766e", "#14b8a6"],  // teal
  ["#3949ab", "#5c6bc0"],  // indigo
  ["#b45309", "#d97706"],  // amber/rust
];
const DENS = { compact:5, regular:9, comfy:14 };

function TopBar({ shortlistCount }) {
  return (
    <div className="topbar">
      <div className="brand">
        <span className="logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="9.2" stroke="#9cc3e0" strokeWidth="1.4" strokeDasharray="2.5 2.5"/>
            <circle cx="14" cy="14" r="3.4" fill="#2b8cc4"/>
            <g stroke="#fff" strokeWidth="1.4" strokeLinecap="round"><path d="M14 4v3.4M14 20.6V24M4 14h3.4M20.6 14H24M7 7l2.4 2.4M18.6 18.6 21 21M7 21l2.4-2.4M18.6 9.4 21 7"/></g>
          </svg>
        </span>
        <span className="name">Sailingi</span>
        <span className="tag">Classic table</span>
      </div>
      <div className="spacer"></div>
      <nav className="topnav">
        <a href="Sailings — Variant D (hi-fi).html">Cards view</a>
        <a href="#" className="active">Table</a>
        <a href="Sailing editor.html">Edit data</a>
      </nav>
      <div className="user">JK</div>
    </div>
  );
}

function DataEmpty({ mode, onReset, onReload }) {
  const nodata = mode === 'nodata';
  return (
    <div className="dataempty">
      <div className="de-card">
        <div className={'de-ico'+(nodata?' err':'')}>{nodata ? Ico.warn({ width:34, height:34 }) : Ico.anchor({ width:34, height:34 })}</div>
        <div className="de-head">BRAK DANYCH</div>
        {nodata ? (
          <><p className="de-sub">Nie udało się wczytać sailingów z pliku <span className="mono">sailings.csv</span>. Sprawdź plik i odśwież.</p>
          <button className="btn btn-primary btn-sm" onClick={onReload}>Reload page</button></>
        ) : (
          <><p className="de-sub">Żaden sailing nie pasuje do wybranych filtrów. Poszerz zakres lub wyczyść filtry.</p>
          <button className="btn btn-primary btn-sm" onClick={onReset}>Reset filters</button></>
        )}
      </div>
    </div>
  );
}

const COLUMNS = [
  { id:'carrier', label:'Carrier', w:'200px' },
  { id:'pol', label:'POL', w:'130px' },
  { id:'ts', label:'TS', align:'center', w:'80px' },
  { id:'pod', label:'POD', w:'130px' },
  { id:'feeder', label:'Feeder vessel' },
  { id:'mother', label:'Mother vessel' },
  { id:'etd', label:'ETD', w:'92px' },
  { id:'week', label:'Wk', align:'center', w:'56px' },
  { id:'eta', label:'ETA', w:'92px' },
  { id:'transit', label:'TT', align:'num', w:'62px' },
];

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [q, setQ] = uS({ pol:'all', pod:'all', weekRange:'all', carrierSel:'all', text:'' });
  const [applied, setApplied] = uS({ pol:'all', pod:'all', weekRange:'all', carrierSel:'all', text:'' });
  const [filter, setFilter] = uS({ routing:'all', space:false, starred:false });
  const [sort, setSort] = uS({ key:'etd', dir:'asc' });
  const [openId, setOpenId] = uS(null);
  const [stars, setStars] = uS(()=> new Set());
  const [toast, setToast] = uS(null);
  const toastTimer = uR(null);
  const showToast = (m)=>{ setToast(m); clearTimeout(toastTimer.current); toastTimer.current=setTimeout(()=>setToast(null),2200); };

  const passBase = (s) => {
    if (applied.pol!=='all' && s.pol!==applied.pol) return false;
    if (applied.pod!=='all' && s.pod!==applied.pod) return false;
    if (applied.carrierSel!=='all' && s.carrier!==applied.carrierSel) return false;
    if (applied.weekRange!=='all' && String(s.week)!==applied.weekRange) return false;
    if (applied.text){
      const q = applied.text.toLowerCase();
      const hay = [s.carrier,s.service,s.serviceName,s.pol,s.pod,s.ts,pname(s.pol),pname(s.pod),s.ts&&pname(s.ts),s.mother&&s.mother.vessel,s.feeder&&s.feeder.vessel].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filter.space && s.space!=='open') return false;
    if (filter.starred && !stars.has(s.id)) return false;
    return true;
  };

  const sortVal = (s, key) => {
    switch(key){
      case 'carrier': return s.carrier;
      case 'pol': return pname(s.pol);
      case 'pod': return pname(s.pod);
      case 'ts': return s.ts?pname(s.ts):'';
      case 'feeder': return s.feeder?s.feeder.vessel:'';
      case 'mother': return s.mother?s.mother.vessel:'';
      case 'week': return s.week||0;
      case 'transit': return s.transit||0;
      case 'eta': return new Date(s.eta).getTime()||0;
      case 'etd':
      default: return new Date(s.etd).getTime()||0;
    }
  };

  const items = uM(()=>{
    let r = S.filter(s => {
      if (!passBase(s)) return false;
      if (filter.routing==='direct' && s.ts) return false;
      if (filter.routing==='ts' && !s.ts) return false;
      return true;
    });
    const dir = sort.dir==='asc'?1:-1;
    return [...r].sort((a,b)=>{
      const va=sortVal(a,sort.key), vb=sortVal(b,sort.key);
      if (va<vb) return -1*dir; if (va>vb) return 1*dir;
      return (new Date(a.etd)-new Date(b.etd));
    });
  }, [applied, filter, sort, stars]);

  const counts = uM(()=>{
    const base = S.filter(s=>{
      if (applied.pol!=='all' && s.pol!==applied.pol) return false;
      if (applied.pod!=='all' && s.pod!==applied.pod) return false;
      if (applied.carrierSel!=='all' && s.carrier!==applied.carrierSel) return false;
      if (applied.weekRange!=='all' && String(s.week)!==applied.weekRange) return false;
      if (filter.space && s.space!=='open') return false;
      if (filter.starred && !stars.has(s.id)) return false;
      return true;
    });
    return { all: base.length, direct: base.filter(s=>!s.ts).length, ts: base.filter(s=>s.ts).length, shown: items.length };
  }, [applied, filter, stars, items]);

  const onStar = (id) => setStars(prev=>{ const n=new Set(prev); if(n.has(id)){n.delete(id);showToast('Removed from shortlist');}else{n.add(id);showToast('Added to shortlist');} return n; });
  const onSearch = () => { setApplied({ ...q }); showToast('Filters applied'); };
  const onResetFilters = () => { setFilter({ routing:'all', space:false, starred:false }); const c={ pol:'all',pod:'all',weekRange:'all',carrierSel:'all',text:'' }; setApplied(c); setQ(c); showToast('Filters cleared'); };
  const onReload = () => { try{ location.reload(); }catch(e){} };

  const onCopy = (s) => {
    const txt = `${s.carrier} · ${s.service} · ${s.pol}${s.ts?` → ${s.ts}`:''} → ${s.pod} · ETD ${fmtDateY(s.etd)} · ETA ${fmtDateY(s.eta)} · ${s.transit}d · Mother: ${s.mother.vessel} ${s.mother.voyage}`;
    try { navigator.clipboard.writeText(txt); } catch(e){}
    showToast('Voyage details copied');
  };

  // ── Excel export (identical format to Variant D) ──
  const XLS_COLS = [
    ['Carrier', s=>s.carrier],['Service', s=>s.service||''],['Service name', s=>s.serviceName||''],
    ['POL', s=>pname(s.pol)],['POL code', s=>s.pol],['Transshipment', s=>s.ts?pname(s.ts):''],['TS code', s=>s.ts||''],
    ['POD', s=>pname(s.pod)],['POD code', s=>s.pod],['Routing', s=>s.ts?'1 transshipment':'Direct'],
    ['Feeder vessel', s=>s.feeder?s.feeder.vessel:''],['Feeder voyage', s=>s.feeder?s.feeder.voyage:''],
    ['Mother vessel', s=>s.mother?s.mother.vessel:''],['Mother voyage', s=>s.mother?s.mother.voyage:''],['Mother IMO', s=>s.mother?s.mother.imo:''],
    ['ETD', s=>fmtDateY(s.etd)],['ETA', s=>fmtDateY(s.eta)],['Transit (days)', s=>s.transit],['ETD week', s=>s.week],
  ];
  const xlsEsc = (v)=> String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  function exportRows(rows, filename){
    if (!rows || rows.length===0){ showToast('Nothing to export'); return; }
    const head = '<tr>'+XLS_COLS.map(c=>`<th>${xlsEsc(c[0])}</th>`).join('')+'</tr>';
    const body = rows.map(s=>'<tr>'+XLS_COLS.map(c=>`<td>${xlsEsc(c[1](s))}</td>`).join('')+'</tr>').join('');
    const html = `\uFEFF<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Sailings</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--><style>table{border-collapse:collapse}th,td{border:1px solid #b6c2d0;padding:4px 8px;font-family:Calibri,Arial,sans-serif;font-size:11pt;mso-number-format:"\\@";white-space:nowrap}th{background:#0b2f54;color:#fff;font-weight:700}</style></head><body><table>${head}${body}</table></body></html>`;
    const blob = new Blob([html], { type:'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download = `${filename||'sailings'}_${new Date().toISOString().slice(0,10)}.xls`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
    showToast(`Exported ${rows.length} sailing${rows.length>1?'s':''} to Excel`);
  }
  const onExportResults = () => exportRows(items, `sailings_${applied.pol==='all'?'ALL':applied.pol}-${applied.pod==='all'?'EU':applied.pod}`);
  const onExportShortlist = () => exportRows(S.filter(x=>stars.has(x.id)), 'shortlist');

  // keyboard: arrows move highlighted/open row
  uE(()=>{
    const onKey = (e)=>{
      if (['SELECT','INPUT','TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key!=='ArrowDown' && e.key!=='ArrowUp') return;
      e.preventDefault();
      const idx = items.findIndex(s=>s.id===openId);
      const ni = e.key==='ArrowDown' ? Math.min(items.length-1, idx+1) : Math.max(0, idx-1);
      if (items[ni]) setOpenId(items[ni].id);
    };
    window.addEventListener('keydown', onKey);
    return ()=>window.removeEventListener('keydown', onKey);
  }, [items, openId]);

  uE(()=>{
    const r = document.documentElement.style;
    const acc = t.accent || ACCENTS[0];
    r.setProperty('--sea', acc[0]); r.setProperty('--sea-2', acc[1]);
    r.setProperty('--row-pad', (DENS[t.density] ?? 9)+'px');
  }, [t.accent, t.density]);

  const { SearchBar, Filters, CarrierCell, PortCell, DateCell, VesselCell, DetailRow, Th } = window.SailA;
  const colSpan = COLUMNS.length + 2; // star + chevron

  return (
    <div className="app">
      <TopBar shortlistCount={stars.size}/>
      <SearchBar q={q} setQ={setQ} onSearch={onSearch} onExport={onExportResults}/>
      <Filters filter={filter} setFilter={setFilter} counts={counts}/>
      <div className="stale-banner">{Ico.clock({ style:{ color:'var(--amber)' }})} Schedule snapshot — verify time-critical bookings directly with the carrier.</div>

      {items.length===0 ? (
        <DataEmpty mode={S.length===0?'nodata':'nofilter'} onReset={onResetFilters} onReload={onReload}/>
      ) : (
        <div className="tablewrap scroll">
          <table className="grid">
            <thead>
              <tr>
                <th className="center" style={{ width:'38px' }}></th>
                {COLUMNS.map(c => <Th key={c.id} id={c.id} label={c.label} align={c.align} w={c.w} sort={sort} setSort={setSort}/>)}
                <th className="center" style={{ width:'44px' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((s,i) => {
                const open = s.id===openId;
                const zebra = t.zebra && (i%2===1);
                return (
                  <React.Fragment key={s.id}>
                    <tr className={'row'+(open?' open':'')+(zebra?' zebra':'')} onClick={()=>setOpenId(open?null:s.id)}>
                      <td className="center"><button className="star"  style={ stars.has(s.id)?null:{} } onClick={e=>{ e.stopPropagation(); onStar(s.id); }}>
                        <span className={stars.has(s.id)?'star on':'star'} style={{ width:'auto',height:'auto',background:'none' }}>{Ico.star({ fill: stars.has(s.id)?'currentColor':'none' })}</span>
                      </button></td>
                      <td><CarrierCell s={s}/></td>
                      <td><PortCell code={s.pol}/></td>
                      <td className="center">{s.ts ? <span className="pill ts">{s.ts}</span> : <span className="pill direct">{Ico.check({width:12,height:12})}</span>}</td>
                      <td><PortCell code={s.pod}/></td>
                      <td><VesselCell v={s.feeder}/></td>
                      <td><VesselCell v={s.mother}/></td>
                      <td><DateCell iso={s.etd}/></td>
                      <td className="center"><span className="pill wk">{s.week||'—'}</span></td>
                      <td><DateCell iso={s.eta}/></td>
                      <td className="num tnum">{s.transit}d</td>
                      <td className="center"><span className={'chev'+(open?' open':'')}>{Ico.arrowS({ width:13, height:13 })}</span></td>
                    </tr>
                    {open && <DetailRow s={s} colSpan={colSpan} onCopy={onCopy} onExport={exportRows}/>}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={'tray'+(stars.size>0?' show':'')}>
        <div className="ct">{Ico.star({ fill:'#fff', width:16, height:16 })} <span><b>{stars.size}</b></span> in shortlist</div>
        <button className="btn btn-sm" style={{ background:'rgba(255,255,255,.14)', color:'#fff' }} onClick={()=>setFilter(f=>({...f,starred:!f.starred}))}>{filter.starred?'Show all':'View only'}</button>
        <button className="btn btn-sm btn-primary" onClick={onExportShortlist}>{Ico.pdf({ stroke:'#fff' })} Export all</button>
      </div>

      <div className={'toast'+(toast?' show':'')}>{toast && <>{Ico.check({ stroke:'#7ee0a6' })} {toast}</>}</div>

      <TweaksPanel>
        <TweakSection label="Appearance" />
        <TweakColor label="Accent" value={t.accent} options={ACCENTS} onChange={(v)=>setTweak('accent', v)} />
        <TweakRadio label="Row density" value={t.density} options={['compact','regular','comfy']} onChange={(v)=>setTweak('density', v)} />
        <TweakToggle label="Zebra striping" value={t.zebra} onChange={(v)=>setTweak('zebra', v)} />
      </TweaksPanel>
    </div>
  );
}

// ── CSV loader (same contract as Variant D) ──
function parseCsv(text){
  const rows=[];let i=0,field='',row=[],inQ=false;
  text=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  while(i<text.length){const c=text[i];
    if(inQ){ if(c==='"'){ if(text[i+1]==='"'){field+='"';i+=2;continue;} inQ=false;i++;continue;} field+=c;i++;continue; }
    if(c==='"'){inQ=true;i++;continue;}
    if(c===','){row.push(field);field='';i++;continue;}
    if(c==='\n'){row.push(field);rows.push(row);field='';row=[];i++;continue;}
    field+=c;i++; }
  if(field.length||row.length){row.push(field);rows.push(row);}
  return rows.filter(r=>r.length>1||(r.length===1&&r[0].trim()!==''));
}
function isoWeek(dt){
  const d=new Date(Date.UTC(dt.getFullYear(),dt.getMonth(),dt.getDate()));
  const day=(d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-day+3);
  const f=new Date(Date.UTC(d.getUTCFullYear(),0,4));
  const fd=(f.getUTCDay()+6)%7; f.setUTCDate(f.getUTCDate()-fd+3);
  return 1+Math.round((d-f)/(7*864e5));
}
function csvToSailings(text){
  const rows=parseCsv(text); if(rows.length<2) return [];
  const head=rows[0].map(h=>h.trim().toLowerCase()); const idx=(n)=>head.indexOf(n);
  const out=[];
  for(let r=1;r<rows.length;r++){
    const c=rows[r]; const g=(n)=>{ const k=idx(n); return k>=0?(c[k]||'').trim():''; };
    if(!g('carrier')||!g('pol')||!g('pod')) continue;
    const etd=g('etd').replace(' ','T'), eta=g('eta').replace(' ','T');
    const ts=g('transshipment')||null;
    const transit=g('transit_days')?+g('transit_days'):(etd&&eta?Math.round((new Date(eta)-new Date(etd))/864e5):null);
    const week=g('etd_week')?+g('etd_week'):(etd&&!isNaN(new Date(etd))?isoWeek(new Date(etd)):null);
    const norm=(x)=>x?x.replace(' ','T'):'';
    const cutoffs={};
    if(g('cutoff_gatein')) cutoffs.gateIn=norm(g('cutoff_gatein'));
    if(g('cutoff_vgm')) cutoffs.vgm=norm(g('cutoff_vgm'));
    if(g('cutoff_doc')) cutoffs.doc=norm(g('cutoff_doc'));
    const rotation=g('rotation')?g('rotation').split(/[|>;]/).map(s=>s.trim()).filter(Boolean):[g('pol'),ts,g('pod')].filter(Boolean);
    out.push({
      id:'r'+r, carrier:g('carrier').toUpperCase(), service:g('service')||'—', serviceName:g('service_name')||'',
      pol:g('pol').toUpperCase(), pod:g('pod').toUpperCase(), ts:ts?ts.toUpperCase():null,
      mother:{ vessel:g('mother_vessel')||'—', voyage:g('mother_voyage')||'—', imo:g('mother_imo')||'—' },
      feeder:ts?{ vessel:g('feeder_vessel')||'Feeder TBA', voyage:g('feeder_voyage')||'—', imo:g('feeder_imo')||'—' }:null,
      etd, eta, transit, week, cutoffs, tsArrive:norm(g('ts_arrive')), tsDepart:norm(g('ts_depart')),
      rotation, space:(g('space')||'open').toLowerCase(), co2:g('co2')||'—',
    });
  }
  return out;
}

async function boot(){
  try {
    const res = await fetch('sailings.csv', { cache:'no-store' });
    if (res.ok){
      const rows = csvToSailings(await res.text());
      if (rows.length){ window.SAILINGS.length=0; rows.forEach(x=>window.SAILINGS.push(x)); }
    }
  } catch(e){ /* keep embedded fallback */ }
  ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
}
boot();
