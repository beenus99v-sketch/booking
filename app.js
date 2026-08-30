(()=>{
'use strict';

const app=document.querySelector('#app');
const KEY='bookingDiaryBookingsV3';
const OLD_KEY='bookingDiaryBookingsV2';
const SETTINGS_KEY='bookingDiarySettingsV3';
const OLD_SETTINGS='bookingDiarySettingsV2';
const SESSION_KEY='bookingDiaryCloudSessionV3';
const DELETED_KEY='bookingDiaryDeletedV3';

// Public client configuration only. This publishable key is safe to ship in a browser/PWA.
// Never place a Supabase secret/service-role key in this file.
const PRESET_SUPABASE_URL='https://cugwgxocdbmiicrlokjt.supabase.co';
const PRESET_SUPABASE_KEY='sb_publishable_XAB0hRoIFpv99KPhwkK4CQ_L09nhjE1';

const defaultSettings={
  defaultReminderDays:2,
  defaultReminderTime:'09:00',
  supabaseUrl:PRESET_SUPABASE_URL,
  supabaseAnonKey:PRESET_SUPABASE_KEY,
  cloudEmail:'',
  autoSync:true,
  driveBackupEnabled:false,
  driveBackupOnSave:true,
  driveBackupUrl:'',
  driveBackupToken:'',
  driveBackupFolder:'Booking Diary Backups',
  lastDriveBackupAt:'',
  lastDriveBackupStatus:'Never'
};

function readJSON(key,fallback){
  try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}
  catch{return fallback;}
}

let bookings=readJSON(KEY,[]);
if(!bookings.length){
  const old=readJSON(OLD_KEY,[]);
  if(old.length){bookings=old;localStorage.setItem(KEY,JSON.stringify(bookings));}
}
let settings={...defaultSettings,...readJSON(OLD_SETTINGS,{}),...readJSON(SETTINGS_KEY,{})};
settings.supabaseUrl=PRESET_SUPABASE_URL;
settings.supabaseAnonKey=PRESET_SUPABASE_KEY;
let cloudSession=readJSON(SESSION_KEY,null);
let deletedIds=readJSON(DELETED_KEY,[]);

let tab='home';
let selectedId=null;
let editingId=null;
let homeFilter='all';
let reminderMode='2';
let bookingFilter='all';
let query='';
let bookingQuery='';
let selectedMonth='all';
let bookingSort='dateAsc';
let paymentMonth=`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
let paymentFilter='all';
let calDate=new Date();
let calSelected=null;
let installPrompt=null;
let syncing=false;
let driveBackupTimer=null;
let importRows=[];
let importErrors=[];
let importFileName='';

const eventTypes=['Bridal','Engagement','Wedding','Reception','Party','Pre-Wedding','Other'];
const paymentStatuses=['Advance Paid','Part Paid','Fully Paid','Pending'];
const bookingStatuses=['Confirmed','Tentative','Completed','Cancelled'];
const paymentModes=['Cash','UPI','Bank Transfer','Card','Other'];

const todayISO=()=>{
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const money=n=>'₹'+Number(n||0).toLocaleString('en-IN');
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const phone=p=>{let x=String(p||'').replace(/\D/g,'');if(x.length===10)x='91'+x;return x;};
const label=date=>date?new Date(date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'—';
const monthKey=date=>String(date||'').slice(0,7);
const monthLabel=key=>{
  if(!key||key==='all')return 'All Months';
  const [y,m]=key.split('-').map(Number);
  return new Date(y,m-1,1).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
};
const diff=date=>{
  if(!date)return 99999;
  const [y,m,d]=date.split('-').map(Number);
  const a=new Date(y,m-1,d),t=new Date();
  t.setHours(0,0,0,0);
  return Math.round((a-t)/86400000);
};
const when=date=>{
  const n=diff(date);
  if(n===0)return 'Today';
  if(n===1)return 'Tomorrow';
  if(n===2)return 'In 2 days';
  if(n>2)return `In ${n} days`;
  return `${Math.abs(n)} days ago`;
};
const isActive=b=>b.bookingStatus!=='Cancelled';
function save(){
  localStorage.setItem(KEY,JSON.stringify(bookings));
  if(settings?.driveBackupEnabled&&settings?.driveBackupOnSave)scheduleDriveBackup();
}
const saveSettings=()=>localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));
const saveSession=()=>cloudSession?localStorage.setItem(SESSION_KEY,JSON.stringify(cloudSession)):localStorage.removeItem(SESSION_KEY);
const saveDeleted=()=>localStorage.setItem(DELETED_KEY,JSON.stringify(deletedIds));
const nowISO=()=>new Date().toISOString();

function toast(text){
  const x=document.createElement('div');x.className='toast';x.textContent=text;document.body.appendChild(x);setTimeout(()=>x.remove(),2600);
}

function shell(content){
  return `<div class="shell"><main>${content}</main>${!['form','detail','settings','import'].includes(tab)?nav():''}</div>`;
}
function iconSvg(name){
  const common='viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const paths={
    home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/><path d="M9 20v-6h6v6"/>',
    bookings:'<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    reminders:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    settings:'<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.36a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.08A1.7 1.7 0 0 0 4.64 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1.03-1.56V3h4v.08A1.7 1.7 0 0 0 15 4.64a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.56 1.03H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/>',
    money:'<circle cx="12" cy="12" r="9"/><path d="M8 8h8M9 12h6M12 8c0 4-1.5 6-4 8M12 8c0 4 1.5 6 4 8"/>'
  };
  return `<svg class="nav-svg" ${common}>${paths[name]||''}</svg>`;
}
function nav(){
  return `<nav class="bottom">
    <button data-tab="home" class="${tab==='home'?'active':''}"><span class="nav-icon">${iconSvg('home')}</span><span>Home</span></button>
    <button data-tab="bookings" class="${['bookings','payments'].includes(tab)?'active':''}"><span class="nav-icon">${iconSvg('bookings')}</span><span>Bookings</span></button>
    <button id="add" class="add" aria-label="Add booking"><span>＋</span></button>
    <button data-tab="calendar" class="${tab==='calendar'?'active':''}"><span class="nav-icon">${iconSvg('calendar')}</span><span>Calendar</span></button>
    <button data-tab="reminders" class="${tab==='reminders'?'active':''}"><span class="nav-icon">${iconSvg('reminders')}</span><span>Reminders</span></button>
  </nav>`;
}
function row(name,value,accent=false,warn=false){
  return `<div class="row"><span>${esc(name)}</span><b class="${accent?'accent':''} ${warn?'warn':''}">${esc(value??'—')}</b></div>`;
}
function statusPill(b){
  const cls=b.bookingStatus==='Cancelled'?'cancelled':b.bookingStatus==='Completed'?'completed':'';
  return `<span class="pill ${cls}">${esc(b.eventType||'Booking')}</span>`;
}
function card(b){
  const urgent=diff(b.eventDate)===2?'urgent':'';
  const past=diff(b.eventDate)<0?'past':'';
  return `<button class="card ${urgent} ${past}" data-open="${esc(b.id)}">
    <div class="cardhead">
      <div>${statusPill(b)}<h3>${esc(b.clientName||'Unnamed Client')}</h3></div>
      <div class="date"><b>${label(b.eventDate)}</b><em>${when(b.eventDate)}${b.eventTime?` · ${esc(b.eventTime)}`:''}</em></div>
    </div>
    <div class="meta">☎ ${esc(b.mobile||'—')}</div>
    <div class="meta">⌖ ${esc([b.location,b.city].filter(Boolean).join(', ')||'—')}</div>
    ${b.servicePackage?`<div class="meta">✦ ${esc(b.servicePackage)}</div>`:''}
    <div class="money"><span>Advance ${money(b.advance)}</span><span>Total ${money(b.total)}</span><span class="${Number(b.balance)>0?'due':''}">Balance ${money(b.balance)}</span></div>
    <div class="status">${esc(b.bookingStatus||'Confirmed')} · ${esc(b.paymentStatus||'Pending')}</div>
  </button>`;
}

function topHeader(eyebrow,title,subtitle=''){
  return `<div class="simple"><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div>`;
}
function settingsButton(){return `<button id="openSettings" class="icon settings-icon" title="Settings" aria-label="Settings">${iconSvg('settings')}</button>`;}

function paymentStats(month='all') {
  const data=bookings.filter(b=>b.bookingStatus!=='Cancelled'&&(month==='all'||monthKey(b.eventDate)===month));
  const total=data.reduce((s,b)=>s+Number(b.total||0),0);
  const pending=data.reduce((s,b)=>s+Math.max(0,Number(b.balance||0)),0);
  const received=Math.max(0,total-pending);
  const pendingBookings=data.filter(b=>Number(b.balance||0)>0);
  const paidBookings=data.filter(b=>Number(b.total||0)>0&&Number(b.balance||0)<=0);
  return {data,total,pending,received,pendingBookings,paidBookings};
}
function paymentMonthOptions(){
  const keys=[...new Set(bookings.map(b=>monthKey(b.eventDate)).filter(Boolean))].sort().reverse();
  if(paymentMonth!=='all'&&!keys.includes(paymentMonth))keys.unshift(paymentMonth);
  return ['all',...keys.filter(k=>k!=='all')];
}
function monthlyPaymentRows(){
  const keys=[...new Set(bookings.map(b=>monthKey(b.eventDate)).filter(Boolean))].sort().reverse();
  return keys.map(k=>({key:k,...paymentStats(k)}));
}

function home(){
  const active=bookings.filter(b=>isActive(b));
  const upcoming=active.filter(b=>diff(b.eventDate)>=0).sort((a,b)=>a.eventDate.localeCompare(b.eventDate)||(a.eventTime||'').localeCompare(b.eventTime||''));
  const thisMonth=todayISO().slice(0,7);
  const counts={
    today:upcoming.filter(b=>diff(b.eventDate)===0).length,
    tomorrow:upcoming.filter(b=>diff(b.eventDate)===1).length,
    two:upcoming.filter(b=>diff(b.eventDate)===2).length,
    week:upcoming.filter(b=>diff(b.eventDate)>=0&&diff(b.eventDate)<=7).length,
    month:active.filter(b=>monthKey(b.eventDate)===thisMonth).length,
    due:active.reduce((s,b)=>s+Number(b.balance||0),0)
  };
  let data=upcoming.filter(searchMatch(query));
  if(homeFilter==='2days')data=data.filter(b=>diff(b.eventDate)===2);
  if(homeFilter==='pending')data=data.filter(b=>Number(b.balance)>0);
  if(homeFilter==='Confirmed')data=data.filter(b=>b.bookingStatus==='Confirmed');
  data=data.slice(0,30);
  return `<div class="page">
    <header class="hero">
      <div><div class="eyebrow">Private Booking Manager</div><h1>Booking Diary</h1><p>Every booking, payment and reminder in one place.</p></div>
      <div class="top-actions"><button id="quickAdd" class="btn primary">＋ Add Booking</button>${settingsButton()}</div>
    </header>
    ${cloudSession?`<div class="cloud-status"><div><span class="dot ok"></span><b>Cloud Sync On</b><div class="mini">${esc(settings.cloudEmail||cloudSession.user?.email||'')}</div></div><button id="quickSync" class="btn secondary small">↻ Sync</button></div>`:''}
    <div class="stats">
      <div class="stat"><strong>${counts.today}</strong><span>Today</span></div>
      <div class="stat"><strong>${counts.tomorrow}</strong><span>Tomorrow</span></div>
      <div class="stat ${counts.two?'hot':''}"><strong>${counts.two}</strong><span>In 2 Days</span></div>
      <div class="stat"><strong>${counts.week}</strong><span>This Week</span></div>
      <div class="stat"><strong>${counts.month}</strong><span>This Month</span></div>
      <div class="stat money-stat"><strong>${money(counts.due)}</strong><span>Balance Due</span></div>
    </div>
    ${(()=>{const p=paymentStats(paymentMonth);return `<section class="finance-card">
      <div class="finance-head"><div><div class="eyebrow">Payment Overview</div><h2>${monthLabel(paymentMonth)}</h2></div><select id="homePaymentMonth">${paymentMonthOptions().map(k=>`<option value="${k}" ${paymentMonth===k?'selected':''}>${monthLabel(k)}</option>`).join('')}</select></div>
      <div class="finance-grid"><div><span>Received</span><strong class="goodmoney">${money(p.received)}</strong></div><div><span>Pending</span><strong class="duemoney">${money(p.pending)}</strong></div><div><span>Booking Value</span><strong>${money(p.total)}</strong></div><div><span>Pending Clients</span><strong>${p.pendingBookings.length}</strong></div></div>
      <button id="paymentCenter" class="btn secondary payment-center-btn">${iconSvg('money')}<span>Open Payment Center</span></button>
    </section>`;})()}
    <div class="search">⌕ <input id="search" placeholder="Search name, phone, location..." value="${esc(query)}"></div>
    <div class="chips">${[['all','Upcoming'],['2days','In 2 Days'],['pending','Payment Pending'],['Confirmed','Confirmed']].map(([v,l])=>`<button class="chip ${homeFilter===v?'active':''}" data-home-filter="${v}">${l}</button>`).join('')}</div>
    <div class="listhead"><h2>Upcoming Bookings</h2><div class="right"><span class="badge">${data.length}</span><button id="viewAll" class="btn ghost small">All Bookings</button></div></div>
    <div class="list">${data.length?data.map(card).join(''):'<div class="empty"><h3>No upcoming bookings</h3><p>Tap Add Booking to save your first booking.</p></div>'}</div>
  </div>`;
}

function searchMatch(q){
  const s=String(q||'').trim().toLowerCase();
  return b=>!s||`${b.clientName||''} ${b.mobile||''} ${b.alternateMobile||''} ${b.location||''} ${b.city||''} ${b.eventType||''} ${b.servicePackage||''} ${b.assignedTo||''}`.toLowerCase().includes(s);
}
function getMonthOptions(){
  const keys=[...new Set(bookings.map(b=>monthKey(b.eventDate)).filter(Boolean))].sort().reverse();
  return ['all',...keys];
}
function filteredBookings(){
  let data=[...bookings].filter(searchMatch(bookingQuery));
  if(selectedMonth!=='all')data=data.filter(b=>monthKey(b.eventDate)===selectedMonth);
  if(bookingFilter==='upcoming')data=data.filter(b=>diff(b.eventDate)>=0&&b.bookingStatus!=='Cancelled');
  if(bookingFilter==='past')data=data.filter(b=>diff(b.eventDate)<0);
  if(['Confirmed','Tentative','Completed','Cancelled'].includes(bookingFilter))data=data.filter(b=>b.bookingStatus===bookingFilter);
  if(bookingFilter==='pending')data=data.filter(b=>Number(b.balance)>0&&b.bookingStatus!=='Cancelled');
  const sorter={
    dateAsc:(a,b)=>a.eventDate.localeCompare(b.eventDate)||(a.eventTime||'').localeCompare(b.eventTime||''),
    dateDesc:(a,b)=>b.eventDate.localeCompare(a.eventDate)||(b.eventTime||'').localeCompare(a.eventTime||''),
    name:(a,b)=>(a.clientName||'').localeCompare(b.clientName||''),
    balance:(a,b)=>Number(b.balance||0)-Number(a.balance||0)
  }[bookingSort]||((a,b)=>a.eventDate.localeCompare(b.eventDate));
  return data.sort(sorter);
}
function groupedCards(data){
  if(!data.length)return '<div class="empty"><h3>No bookings found</h3><p>Change the month/filter or add a booking.</p></div>';
  if(selectedMonth!=='all')return data.map(card).join('');
  const groups={};
  data.forEach(b=>{const k=monthKey(b.eventDate)||'unknown';(groups[k]??=[]).push(b);});
  const keys=Object.keys(groups).sort((a,b)=>bookingSort==='dateAsc'?a.localeCompare(b):b.localeCompare(a));
  return keys.map(k=>`<div class="monthgroup"><div class="monthtitle">${monthLabel(k)} · ${groups[k].length}</div>${groups[k].map(card).join('')}</div>`).join('');
}
function bookingsPage(){
  const data=filteredBookings();
  const totalDue=data.reduce((s,b)=>s+Number(b.balance||0),0);
  return `<div class="page">
    <div class="topbar"><div></div><div>${topHeader('Booking Register','All Bookings','Search, filter and view month-wise bookings.')}</div>${settingsButton()}</div>
    <div class="search">⌕ <input id="bookingSearch" placeholder="Search client, phone, venue..." value="${esc(bookingQuery)}"></div>
    <div class="toolbar">
      <select id="monthSelect" class="month-select">${getMonthOptions().map(k=>`<option value="${k}" ${selectedMonth===k?'selected':''}>${monthLabel(k)}</option>`).join('')}</select>
      <select id="sortSelect"><option value="dateAsc" ${bookingSort==='dateAsc'?'selected':''}>Date ↑</option><option value="dateDesc" ${bookingSort==='dateDesc'?'selected':''}>Date ↓</option><option value="name" ${bookingSort==='name'?'selected':''}>Client A-Z</option><option value="balance" ${bookingSort==='balance'?'selected':''}>Balance Due</option></select>
      <button id="thisMonth" class="btn secondary small">This Month</button>
    </div>
    <div class="chips">${[['all','All'],['upcoming','Upcoming'],['past','Past'],['Confirmed','Confirmed'],['Tentative','Tentative'],['Completed','Completed'],['Cancelled','Cancelled'],['pending','Payment Pending']].map(([v,l])=>`<button class="chip ${bookingFilter===v?'active':''}" data-book-filter="${v}">${l}</button>`).join('')}</div>
    <div class="listhead"><h2>${selectedMonth==='all'?'All Bookings':monthLabel(selectedMonth)}</h2><div class="right"><span>${data.length} bookings</span><span class="badge">Due ${money(totalDue)}</span></div></div>
    <div class="list">${groupedCards(data)}</div>
  </div>`;
}

function paymentsPage(){
  const stats=paymentStats(paymentMonth);
  let data=[...stats.data];
  if(paymentFilter==='pending')data=data.filter(b=>Number(b.balance||0)>0);
  if(paymentFilter==='paid')data=data.filter(b=>Number(b.total||0)>0&&Number(b.balance||0)<=0);
  data.sort((a,b)=>a.eventDate.localeCompare(b.eventDate));
  const rows=monthlyPaymentRows();
  return `<div class="page">
    <div class="topbar"><button id="backPayments" class="icon">‹</button><div>${topHeader('Money Tracker','Payment Center','Month-wise received amount, booking value and pending payments.')}</div>${settingsButton()}</div>
    <div class="payment-toolbar"><label>Month<select id="paymentMonth">${paymentMonthOptions().map(k=>`<option value="${k}" ${paymentMonth===k?'selected':''}>${monthLabel(k)}</option>`).join('')}</select></label></div>
    <div class="payment-summary">
      <div class="payment-kpi received"><span>Received</span><strong>${money(stats.received)}</strong><small>${stats.paidBookings.length} fully paid</small></div>
      <div class="payment-kpi pending"><span>Pending</span><strong>${money(stats.pending)}</strong><small>${stats.pendingBookings.length} clients pending</small></div>
      <div class="payment-kpi"><span>Total Booking Value</span><strong>${money(stats.total)}</strong><small>${stats.data.length} bookings</small></div>
    </div>
    <div class="chips">${[['all','All'],['pending','Pending'],['paid','Fully Paid']].map(([v,l])=>`<button class="chip ${paymentFilter===v?'active':''}" data-payment-filter="${v}">${l}</button>`).join('')}</div>
    <div class="listhead"><h2>${paymentFilter==='pending'?'Pending Payments':paymentFilter==='paid'?'Fully Paid Bookings':'Bookings & Payments'}</h2><span class="badge">${data.length}</span></div>
    <div class="list">${data.length?data.map(card).join(''):'<div class="empty">No records in this filter.</div>'}</div>
    <div class="listhead payment-month-head"><h2>Month-wise Summary</h2><span class="mini">Tap a month to open</span></div>
    <div class="payment-month-list">${rows.length?rows.map(r=>`<button class="payment-month-row" data-payment-month="${r.key}"><div><b>${monthLabel(r.key)}</b><small>${r.data.length} bookings</small></div><div><span>Received <b class="goodmoney">${money(r.received)}</b></span><span>Pending <b class="duemoney">${money(r.pending)}</b></span><span>Total <b>${money(r.total)}</b></span></div></button>`).join(''):'<div class="empty">No booking months yet.</div>'}</div>
  </div>`;
}

function form(){
  const b=bookings.find(x=>x.id===editingId)||{};
  const v=(k,d='')=>esc(b[k]??d);
  return `<div class="page">
    <div class="topbar"><button id="back" class="icon">‹</button><div><div class="eyebrow">${editingId?'Edit':'New'} Booking</div><h1>${editingId?'Update Booking':'Add Booking'}</h1></div><div></div></div>
    <form id="bookingForm" class="form">
      <div class="history-switch"><div><b>Old / Historical Booking</b><span>Use this for bookings from your old diary. Reminder will stay off.</span></div><input type="checkbox" name="historical" ${b.historical?'checked':''}></div>
      <div class="sectiontitle">Essential Details</div>
      <div class="grid">
        <label class="label">Event Date<input required type="date" name="eventDate" value="${v('eventDate',todayISO())}"></label>
        <label class="label">Event Time<input type="time" name="eventTime" value="${v('eventTime')}"></label>
        <label class="label">Event Type<select name="eventType">${eventTypes.map(x=>`<option ${v('eventType','Bridal')===x?'selected':''}>${x}</option>`).join('')}</select></label>
        <label class="label">Client Name<input required name="clientName" autocomplete="name" value="${v('clientName')}"></label>
        <label class="label">Mobile Number<input required inputmode="tel" autocomplete="tel" name="mobile" value="${v('mobile')}"></label>
        <label class="label">Alternate Mobile<input inputmode="tel" name="alternateMobile" value="${v('alternateMobile')}"></label>
        <label class="label wide">Location / Venue<input name="location" value="${v('location')}"></label>
        <label class="label">City<input name="city" value="${v('city')}"></label>
      </div>
      <div class="sectiontitle">Payment</div>
      <div class="grid">
        <label class="label">Advance<input type="number" min="0" step="1" name="advance" value="${v('advance',0)}"></label>
        <label class="label">Final Amount<input type="number" min="0" step="1" name="total" value="${v('total',0)}"></label>
        <label class="label">Balance<input readonly name="balance" value="${v('balance',0)}"></label>
        <label class="label">Payment Status<select name="paymentStatus">${paymentStatuses.map(x=>`<option ${v('paymentStatus','Advance Paid')===x?'selected':''}>${x}</option>`).join('')}</select></label>
        <label class="label">Payment Mode<select name="paymentMode">${paymentModes.map(x=>`<option ${v('paymentMode','UPI')===x?'selected':''}>${x}</option>`).join('')}</select></label>
        <label class="label">Booking Status<select name="bookingStatus">${bookingStatuses.map(x=>`<option ${v('bookingStatus','Confirmed')===x?'selected':''}>${x}</option>`).join('')}</select></label>
      </div>
      <div class="sectiontitle">Reminder</div>
      <div class="switch"><span>🔔 Reminder enabled</span><input type="checkbox" name="reminderEnabled" ${b.reminderEnabled===false?'':'checked'}></div>
      <div class="grid">
        <label class="label">Remind Before<select name="reminderDays">${[1,2,3,7,14].map(x=>`<option value="${x}" ${Number(b.reminderDays??settings.defaultReminderDays)===x?'selected':''}>${x} day${x===1?'':'s'}</option>`).join('')}</select></label>
        <label class="label">Reminder Time<input type="time" name="reminderTime" value="${v('reminderTime',settings.defaultReminderTime)}"></label>
      </div>
      <details class="detailsbox" ${b.servicePackage||b.assignedTo||b.source?'open':''}>
        <summary>More details (optional)</summary>
        <div class="grid">
          <label class="label wide">Service / Package<input name="servicePackage" placeholder="e.g. Bridal Makeup + Hair" value="${v('servicePackage')}"></label>
          <label class="label">Assigned Artist / Staff<input name="assignedTo" value="${v('assignedTo')}"></label>
          <label class="label">Booking Source<input name="source" placeholder="Instagram, Referral..." value="${v('source')}"></label>
          <label class="label wide">Notes / Special Instructions<textarea name="notes" rows="4">${v('notes')}</textarea></label>
        </div>
      </details>
      <div id="duplicateWarn"></div>
      <button class="btn primary" type="submit">Save Booking</button>
    </form>
  </div>`;
}

function bookingSummary(b){
  const place=[b.location,b.city].filter(Boolean).join(', ');
  return `${b.eventType||'Booking'} - ${b.clientName}\nDate: ${label(b.eventDate)}${b.eventTime?` at ${b.eventTime}`:''}\nMobile: ${b.mobile||'—'}\nLocation: ${place||'—'}\nAdvance: ${money(b.advance)}\nTotal: ${money(b.total)}\nBalance: ${money(b.balance)}\nStatus: ${b.bookingStatus} / ${b.paymentStatus}${b.notes?`\nNotes: ${b.notes}`:''}`;
}
function whatsappText(b,type='confirm'){
  const place=[b.location,b.city].filter(Boolean).join(', ');
  if(type==='payment')return `Hello ${b.clientName}, reminder for your ${b.eventType} booking on ${label(b.eventDate)}. Pending balance: ${money(b.balance)}. Thank you.`;
  return `Hello ${b.clientName}, your ${b.eventType} booking is confirmed for ${label(b.eventDate)}${b.eventTime?` at ${b.eventTime}`:''}. Venue: ${place||'To be confirmed'}. Advance: ${money(b.advance)}. Balance: ${money(b.balance)}. Thank you.`;
}
function detail(){
  const b=bookings.find(x=>x.id===selectedId);
  if(!b){tab='home';return home();}
  const place=[b.location,b.city].filter(Boolean).join(', ');
  const encodedConfirm=encodeURIComponent(whatsappText(b,'confirm'));
  const encodedPayment=encodeURIComponent(whatsappText(b,'payment'));
  return `<div class="page">
    <div class="topbar"><button id="back" class="icon">‹</button><div><div class="eyebrow">${esc(b.eventType)}</div><h1>${esc(b.clientName)}</h1></div><div class="top-actions"><button id="edit" class="icon">✎</button></div></div>
    <div class="detaildate"><strong>${label(b.eventDate)}${b.eventTime?` · ${esc(b.eventTime)}`:''}</strong><span>${esc(b.bookingStatus)}</span></div>
    <div class="actions">
      <a href="tel:${esc(b.mobile)}">☎ Call</a>
      <a target="_blank" rel="noreferrer" href="https://wa.me/${phone(b.mobile)}?text=${encodedConfirm}">◉ WhatsApp</a>
      <button id="copyPlace">⌖ Location</button>
      <button id="shareBooking">↗ Share</button>
    </div>
    <div class="panel"><h3>Booking</h3>${row('Event',b.eventType)}${row('Date',label(b.eventDate))}${row('Time',b.eventTime||'—')}${row('Mobile',b.mobile)}${row('Alternate',b.alternateMobile||'—')}${row('Location',place||'—')}${row('Service / Package',b.servicePackage||'—')}${row('Assigned To',b.assignedTo||'—')}${row('Source',b.source||'—')}${row('Record Type',b.historical?'Old / Historical':'Current')}</div>
    <div class="panel"><h3>Payment</h3>${row('Advance',money(b.advance))}${row('Total',money(b.total))}${row('Balance',money(b.balance),Number(b.balance)===0,Number(b.balance)>0)}${row('Payment Status',b.paymentStatus)}${row('Payment Mode',b.paymentMode||'—')}</div>
    <div class="panel"><h3>Reminder & Notes</h3>${row('Reminder',b.reminderEnabled===false?'Off':`${b.reminderDays??2} days before · ${b.reminderTime||settings.defaultReminderTime}`)}<div class="notes">${esc(b.notes||'No notes')}</div></div>
    <div class="panel"><h3>Quick Actions</h3><div class="quickrow">
      <button id="calendarReminder" class="btn secondary small">＋ Phone Calendar Reminder</button>
      ${Number(b.balance)>0?`<a target="_blank" class="btn secondary small" href="https://wa.me/${phone(b.mobile)}?text=${encodedPayment}">WhatsApp Payment Reminder</a>`:''}
      ${b.bookingStatus!=='Completed'?'<button id="complete" class="btn secondary small">✓ Mark Completed</button>':''}
      ${Number(b.balance)>0?'<button id="paid" class="btn secondary small">₹ Mark Fully Paid</button>':''}
    </div></div>
    <div class="panel"><h3>Record</h3>${row('Created',new Date(b.createdAt||Date.now()).toLocaleString('en-IN'))}${row('Last Updated',new Date(b.updatedAt||Date.now()).toLocaleString('en-IN'))}</div>
    <button id="delete" class="btn danger">Delete Booking</button>
  </div>`;
}

function reminders(){
  let data=bookings.filter(b=>!['Cancelled','Completed'].includes(b.bookingStatus));
  if(reminderMode==='2')data=data.filter(b=>diff(b.eventDate)===2);
  if(reminderMode==='today')data=data.filter(b=>diff(b.eventDate)===0);
  if(reminderMode==='pending')data=data.filter(b=>Number(b.balance)>0);
  if(reminderMode==='up')data=data.filter(b=>diff(b.eventDate)>=0&&diff(b.eventDate)<=30);
  data.sort((a,b)=>a.eventDate.localeCompare(b.eventDate));
  return `<div class="page"><div class="topbar"><div></div><div>${topHeader('Reminder Center','Reminders','Bookings and payments that need attention.')}</div>${settingsButton()}</div>
    <div class="chips">${[['2','In 2 Days'],['today','Today'],['pending','Payment Pending'],['up','Next 30 Days']].map(([v,l])=>`<button class="chip ${reminderMode===v?'active':''}" data-rmode="${v}">${l}</button>`).join('')}</div>
    <div class="list">${data.length?data.map(card).join(''):'<div class="empty">Nothing pending here.</div>'}</div>
  </div>`;
}

function calendar(){
  const y=calDate.getFullYear(),m=calDate.getMonth();
  const first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),start=first.getDay();
  let cells='';
  for(let i=0;i<start;i++)cells+='<div></div>';
  for(let d=1;d<=days;d++){
    const iso=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const count=bookings.filter(b=>b.eventDate===iso&&b.bookingStatus!=='Cancelled').length;
    cells+=`<button data-day="${iso}" class="${count?'has-booking':''} ${calSelected===iso?'selected':''} ${todayISO()===iso?'today':''}">${d}${count?`<i>${count}</i>`:''}</button>`;
  }
  const dayBookings=calSelected?bookings.filter(b=>b.eventDate===calSelected).sort((a,b)=>(a.eventTime||'').localeCompare(b.eventTime||'')):[];
  return `<div class="page"><div class="topbar"><div></div><div>${topHeader('Monthly View','Calendar','Tap any date to see its bookings.')}</div>${settingsButton()}</div>
    <div class="calendarhead"><button id="prev" class="icon">‹</button><b>${calDate.toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</b><button id="next" class="icon">›</button></div>
    <div class="calendar-legend"><span><i class="legend-dot booked"></i> Booking date</span><span><i class="legend-dot today-dot"></i> Today</span></div>
    <div class="week">${['S','M','T','W','T','F','S'].map(x=>`<span>${x}</span>`).join('')}</div>
    <div class="cal">${cells}</div>
    ${calSelected?`<div class="listhead"><h2>${label(calSelected)}</h2><span class="badge">${dayBookings.length}</span></div><div class="list">${dayBookings.map(card).join('')||'<div class="empty">No bookings</div>'}</div>`:''}
  </div>`;
}

function cloudConfigured(){return /^https:\/\//.test(settings.supabaseUrl||'')&&String(settings.supabaseAnonKey||'').length>20;}
function driveConfigured(){return /^https:\/\/script\.google\.com\/macros\/s\//.test(settings.driveBackupUrl||'')&&String(settings.driveBackupToken||'').length>=12;}
function settingsPage(){
  const perm=('Notification' in window)?Notification.permission:'unsupported';
  const signed=!!cloudSession;
  const driveReady=driveConfigured();
  const oldCount=bookings.filter(b=>b.historical||diff(b.eventDate)<0).length;
  return `<div class="page">
    <div class="topbar"><button id="backSettings" class="icon">‹</button><div>${topHeader('App Settings','Settings','Install, sync, automatic backup and old-booking import.')}</div><div></div></div>
    <div class="installbox"><h3>Install on this phone</h3><p class="muted">Android: Chrome → Install App / Add to Home Screen. iPhone: Safari → Share → Add to Home Screen.</p>${installPrompt?'<button id="install" class="btn primary small">Install App</button>':''}</div>
    <div class="panel"><h3>Cloud Sync — Same Data on Android & iPhone</h3>
      <div class="cloud-status"><div><span class="dot ${signed?'ok':cloudConfigured()?'warn':''}"></span><b>${signed?'Signed in & ready':cloudConfigured()?'Configured — sign in':'Not configured'}</b><div class="mini">${signed?esc(settings.cloudEmail||cloudSession.user?.email||''): 'Supabase keeps the live database outside GitHub and outside the phone.'}</div></div>${signed?'<button id="syncNow" class="btn primary small">↻ Sync Now</button>':''}</div>
      <div class="preset-cloud"><span class="dot ok"></span><div><b>Cloud server pre-configured</b><div class="mini">No Supabase URL or key is required on Android, iPhone or laptop.</div></div></div>
      <div class="grid">
        <label class="label">Email<input id="cloudEmail" type="email" autocomplete="username" value="${esc(settings.cloudEmail)}" placeholder="Same email on every device"></label>
        <label class="label">Password<input id="cloudPassword" type="password" autocomplete="current-password" placeholder="Password"></label>
      </div>
      <div class="quickrow" style="margin-top:10px">${signed?'<button id="signOut" class="btn secondary small">Sign Out</button>':'<button id="signIn" class="btn primary small">Sign In</button><button id="signUp" class="btn secondary small">Create Account</button>'}</div>
      <p class="syncnote">On every phone, only sign in with the <b>same email and password</b>. The public Supabase connection is already built into this app. Never use a service-role/secret key in a browser app.</p>
    </div>

    <div class="panel drive-panel"><h3>Google Drive Automatic Safety Backup</h3>
      <div class="cloud-status"><div><span class="dot ${driveReady&&settings.driveBackupEnabled?'ok':driveReady?'warn':''}"></span><b>${driveReady?(settings.driveBackupEnabled?'Automatic backup ON':'Configured — backup OFF'):'Not configured'}</b><div class="mini">${settings.lastDriveBackupAt?`Last sent: ${new Date(settings.lastDriveBackupAt).toLocaleString('en-IN')}`:'No Drive backup sent yet.'}</div></div><button id="backupNow" class="btn primary small" ${driveReady?'':'disabled'}>☁ Backup Now</button></div>
      <div class="grid">
        <label class="label wide">Google Apps Script Web App URL<input id="driveBackupUrl" placeholder="https://script.google.com/macros/s/.../exec" value="${esc(settings.driveBackupUrl)}"></label>
        <label class="label wide">Private Backup Token<input id="driveBackupToken" type="password" placeholder="Same token used in the Apps Script" value="${esc(settings.driveBackupToken)}"></label>
        <label class="label wide">Drive Folder Name<input id="driveBackupFolder" value="${esc(settings.driveBackupFolder||'Booking Diary Backups')}"></label>
      </div>
      <div class="switch"><span>☁ Automatic Drive backup after every data change</span><input id="driveBackupEnabled" type="checkbox" ${settings.driveBackupEnabled?'checked':''}></div>
      <div class="quickrow"><button id="generateDriveToken" class="btn secondary small">Generate Private Token</button><button id="copyDriveToken" class="btn secondary small">Copy Token</button><button id="saveDriveConfig" class="btn ghost small">Save Drive Settings</button></div>
      <p class="syncnote">The token and Apps Script URL are saved only in this browser, not inside the public GitHub source. The Drive script keeps <b>latest JSON + CSV</b> and one dated JSON + CSV backup per day.</p>
    </div>

    <div class="panel"><h3>Old Diary / Historical Bookings</h3><p class="muted">Add old entries one-by-one using “Old / Historical Booking”, or import many rows from CSV / Excel. Existing bookings are never replaced; imports are merged and likely duplicates are skipped.</p><div class="quickrow"><button id="downloadTemplate" class="btn secondary small">⇩ Download Import Template</button><button id="importOld" class="btn primary small">⇧ Import CSV / Excel</button><input id="oldImportFile" class="hidden" type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"></div><div class="mini" style="margin-top:8px">Historical records currently detected: ${oldCount}</div></div>

    <div class="panel"><h3>Notifications</h3><p class="muted">Permission: <b>${perm}</b>. In-app reminders appear whenever the app opens. For the most reliable closed-app reminder, also use “Phone Calendar Reminder” inside each booking.</p><button id="notify" class="btn secondary small">Enable Notifications</button></div>
    <div class="panel"><h3>Default Reminder</h3><div class="grid"><label class="label">Days Before<select id="defaultDays">${[1,2,3,7,14].map(x=>`<option value="${x}" ${Number(settings.defaultReminderDays)===x?'selected':''}>${x}</option>`).join('')}</select></label><label class="label">Time<input id="defaultTime" type="time" value="${esc(settings.defaultReminderTime)}"></label></div></div>
    <div class="panel"><h3>Manual Backup & Restore</h3><p class="muted">CSV opens in Excel. JSON is a complete app backup. Keep at least one manual backup occasionally even when cloud backup is enabled.</p><div class="quickrow"><button id="exportCSV" class="btn secondary small">⇩ Export CSV</button><button id="exportJSON" class="btn secondary small">⇩ Export JSON</button><button id="importJSON" class="btn secondary small">⇧ Restore JSON</button><input id="importFile" class="hidden" type="file" accept="application/json,.json"></div></div>
    <div class="panel"><h3>Data Safety Summary</h3>${row('Bookings on this device',String(bookings.length))}${row('Old / Historical',String(oldCount))}${row('Pending Balance',money(bookings.filter(isActive).reduce((s,b)=>s+Number(b.balance||0),0)))}${row('Supabase Live Copy',signed?'Connected':'Not connected')}${row('Google Drive Backup',driveReady?(settings.driveBackupEnabled?'Automatic':'Configured'):'Not configured')}</div>
  </div>`;
}
function render(){
  const content=tab==='home'?home():tab==='bookings'?bookingsPage():tab==='payments'?paymentsPage():tab==='form'?form():tab==='detail'?detail():tab==='reminders'?reminders():tab==='calendar'?calendar():tab==='import'?importPage():settingsPage();
  app.innerHTML=shell(content);
  bind();
}

function goForm(id=null){editingId=id;selectedId=id||selectedId;tab='form';render();}
function openBooking(id){selectedId=id;tab='detail';render();}
function backFromDetail(){tab='bookings';render();}

function bind(){
  document.querySelectorAll('[data-tab]').forEach(x=>x.onclick=()=>{tab=x.dataset.tab;render();});
  const add=document.querySelector('#add');if(add)add.onclick=()=>goForm(null);
  const qa=document.querySelector('#quickAdd');if(qa)qa.onclick=()=>goForm(null);
  const os=document.querySelector('#openSettings');if(os)os.onclick=()=>{tab='settings';render();};
  const va=document.querySelector('#viewAll');if(va)va.onclick=()=>{tab='bookings';render();};
  const pc=document.querySelector('#paymentCenter');if(pc)pc.onclick=()=>{tab='payments';render();};
  const hpm=document.querySelector('#homePaymentMonth');if(hpm)hpm.onchange=e=>{paymentMonth=e.target.value;render();};
  const pm=document.querySelector('#paymentMonth');if(pm)pm.onchange=e=>{paymentMonth=e.target.value;render();};
  const bp=document.querySelector('#backPayments');if(bp)bp.onclick=()=>{tab='home';render();};
  document.querySelectorAll('[data-payment-filter]').forEach(x=>x.onclick=()=>{paymentFilter=x.dataset.paymentFilter;render();});
  document.querySelectorAll('[data-payment-month]').forEach(x=>x.onclick=()=>{paymentMonth=x.dataset.paymentMonth;paymentFilter='all';tab='payments';render();});
  document.querySelectorAll('[data-open]').forEach(x=>x.onclick=()=>openBooking(x.dataset.open));

  const s=document.querySelector('#search');if(s)s.oninput=e=>preserveInput(e,'query');
  const bs=document.querySelector('#bookingSearch');if(bs)bs.oninput=e=>preserveInput(e,'bookingQuery');
  document.querySelectorAll('[data-home-filter]').forEach(x=>x.onclick=()=>{homeFilter=x.dataset.homeFilter;render();});
  document.querySelectorAll('[data-book-filter]').forEach(x=>x.onclick=()=>{bookingFilter=x.dataset.bookFilter;render();});
  document.querySelectorAll('[data-rmode]').forEach(x=>x.onclick=()=>{reminderMode=x.dataset.rmode;render();});

  const ms=document.querySelector('#monthSelect');if(ms)ms.onchange=e=>{selectedMonth=e.target.value;render();};
  const ss=document.querySelector('#sortSelect');if(ss)ss.onchange=e=>{bookingSort=e.target.value;render();};
  const tm=document.querySelector('#thisMonth');if(tm)tm.onclick=()=>{selectedMonth=todayISO().slice(0,7);render();};

  const f=document.querySelector('#bookingForm');
  if(f){
    const calc=()=>{const a=Number(f.advance.value||0),t=Number(f.total.value||0);f.balance.value=Math.max(0,t-a);};
    const duplicateCheck=()=>{
      const mobile=phone(f.mobile.value),date=f.eventDate.value;
      const dup=bookings.find(b=>b.id!==editingId&&phone(b.mobile)===mobile&&b.eventDate===date&&mobile);
      const box=document.querySelector('#duplicateWarn');
      if(box)box.innerHTML=dup?`<div class="banner">Possible duplicate: ${esc(dup.clientName)} already has a booking on ${label(dup.eventDate)} with this mobile number.</div>`:'';
    };
    const historicalToggle=()=>{
      if(!f.historical)return;
      if(f.historical.checked){f.reminderEnabled.checked=false;if(!editingId&&f.bookingStatus.value==='Confirmed')f.bookingStatus.value='Completed';}
    };
    f.advance.oninput=calc;f.total.oninput=calc;f.mobile.oninput=duplicateCheck;
    f.eventDate.onchange=()=>{duplicateCheck();if(!editingId&&f.eventDate.value&&f.eventDate.value<todayISO()){f.historical.checked=true;historicalToggle();}};
    f.historical.onchange=historicalToggle;duplicateCheck();
    f.onsubmit=async e=>{
      e.preventDefault();
      const fd=new FormData(f),obj=Object.fromEntries(fd.entries());
      obj.advance=Number(obj.advance||0);obj.total=Number(obj.total||0);obj.balance=Math.max(0,obj.total-obj.advance);obj.reminderDays=Number(obj.reminderDays||2);obj.historical=f.historical.checked;obj.reminderEnabled=obj.historical?false:f.reminderEnabled.checked;
      if(obj.historical&&!editingId&&obj.bookingStatus==='Confirmed')obj.bookingStatus='Completed';
      if(obj.balance===0&&obj.total>0)obj.paymentStatus='Fully Paid';
      const now=nowISO();
      if(editingId){
        const i=bookings.findIndex(x=>x.id===editingId);obj.id=editingId;obj.createdAt=bookings[i]?.createdAt||now;obj.updatedAt=now;bookings[i]=obj;
      }else{
        obj.id=(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));obj.createdAt=now;obj.updatedAt=now;bookings.push(obj);
      }
      save();selectedId=obj.id;editingId=null;tab='detail';render();toast('Booking saved');notifyDue();
      if(cloudSession&&settings.autoSync)pushOne(obj).catch(()=>{});
    };
  }

  const back=document.querySelector('#back');if(back)back.onclick=()=>editingId?backFromDetail():backFromDetail();
  const edit=document.querySelector('#edit');if(edit)edit.onclick=()=>goForm(selectedId);
  const del=document.querySelector('#delete');if(del)del.onclick=deleteSelected;
  const complete=document.querySelector('#complete');if(complete)complete.onclick=()=>updateSelected({bookingStatus:'Completed'});
  const paid=document.querySelector('#paid');if(paid)paid.onclick=()=>{const b=bookings.find(x=>x.id===selectedId);updateSelected({paymentStatus:'Fully Paid',advance:b.total,balance:0});};
  const cp=document.querySelector('#copyPlace');if(cp)cp.onclick=async()=>{const b=bookings.find(x=>x.id===selectedId);const t=[b.location,b.city].filter(Boolean).join(', ');await navigator.clipboard?.writeText(t);toast('Location copied');};
  const sh=document.querySelector('#shareBooking');if(sh)sh.onclick=async()=>{const b=bookings.find(x=>x.id===selectedId),text=bookingSummary(b);if(navigator.share){try{await navigator.share({title:`${b.clientName} - ${b.eventType}`,text});}catch{}}else{await navigator.clipboard?.writeText(text);toast('Booking summary copied');}};
  const cr=document.querySelector('#calendarReminder');if(cr)cr.onclick=()=>downloadICS(bookings.find(x=>x.id===selectedId));

  const prev=document.querySelector('#prev');if(prev)prev.onclick=()=>{calDate=new Date(calDate.getFullYear(),calDate.getMonth()-1,1);render();};
  const next=document.querySelector('#next');if(next)next.onclick=()=>{calDate=new Date(calDate.getFullYear(),calDate.getMonth()+1,1);render();};
  document.querySelectorAll('[data-day]').forEach(x=>x.onclick=()=>{calSelected=x.dataset.day;render();});
  const ci=document.querySelector('#cancelImport');if(ci)ci.onclick=()=>{tab='settings';render();};
  const ci2=document.querySelector('#cancelImport2');if(ci2)ci2.onclick=()=>{tab='settings';render();};
  const confirmImp=document.querySelector('#confirmImport');if(confirmImp)confirmImp.onclick=confirmOldImport;

  bindSettings();
  const qs=document.querySelector('#quickSync');if(qs)qs.onclick=()=>syncAll(true);
}

function preserveInput(e,varName){
  const value=e.target.value,pos=e.target.selectionStart;
  if(varName==='query')query=value;else bookingQuery=value;
  render();
  setTimeout(()=>{const el=document.querySelector(varName==='query'?'#search':'#bookingSearch');if(el){el.focus();try{el.setSelectionRange(pos,pos);}catch{}}},0);
}

async function deleteSelected(){
  const b=bookings.find(x=>x.id===selectedId);if(!b)return;
  if(confirm(`Delete ${b.clientName}'s booking?`)){
    const id=b.id;bookings=bookings.filter(x=>x.id!==id);save();deletedIds=[...new Set([...deletedIds,id])];saveDeleted();selectedId=null;tab='bookings';render();toast('Booking deleted');
    if(cloudSession)deleteRemote(id).then(()=>{deletedIds=deletedIds.filter(x=>x!==id);saveDeleted();}).catch(()=>{});
  }
}
function updateSelected(ch){
  const i=bookings.findIndex(x=>x.id===selectedId);if(i<0)return;
  bookings[i]={...bookings[i],...ch,updatedAt:nowISO()};save();const b=bookings[i];render();toast('Updated');if(cloudSession)pushOne(b).catch(()=>{});
}

function notifyDue(){
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  const seen=readJSON('bookingDiaryNotifiedV3',{});let changed=false;
  bookings.filter(b=>b.reminderEnabled!==false&&!['Cancelled','Completed'].includes(b.bookingStatus)).forEach(b=>{
    const d=diff(b.eventDate),r=Number(b.reminderDays??2),key=`${b.id}-${b.eventDate}-${r}`;
    if(d===r&&!seen[key]){
      new Notification('Booking Reminder',{body:`${b.clientName}'s ${b.eventType} booking is in ${r} day${r===1?'':'s'} — ${label(b.eventDate)}, ${b.location||b.city||''}`,icon:'icon-192.png'});
      seen[key]=Date.now();changed=true;
    }
  });
  if(changed)localStorage.setItem('bookingDiaryNotifiedV3',JSON.stringify(seen));
}

function bindSettings(){
  const back=document.querySelector('#backSettings');if(back)back.onclick=()=>{tab='home';render();};
  const notify=document.querySelector('#notify');if(notify)notify.onclick=async()=>{if(!('Notification' in window))return toast('Notifications not supported here');const p=await Notification.requestPermission();toast(`Notifications: ${p}`);render();notifyDue();};
  const install=document.querySelector('#install');if(install)install.onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;render();}};
  const dd=document.querySelector('#defaultDays');if(dd)dd.onchange=e=>{settings.defaultReminderDays=Number(e.target.value);saveSettings();};
  const dt=document.querySelector('#defaultTime');if(dt)dt.onchange=e=>{settings.defaultReminderTime=e.target.value;saveSettings();};
  const signIn=document.querySelector('#signIn');if(signIn)signIn.onclick=()=>cloudAuth('login');
  const signUp=document.querySelector('#signUp');if(signUp)signUp.onclick=()=>cloudAuth('signup');
  const signOut=document.querySelector('#signOut');if(signOut)signOut.onclick=()=>{cloudSession=null;saveSession();toast('Signed out');render();};
  const syncNow=document.querySelector('#syncNow');if(syncNow)syncNow.onclick=()=>syncAll(true);
  const eCSV=document.querySelector('#exportCSV');if(eCSV)eCSV.onclick=exportCSV;
  const eJSON=document.querySelector('#exportJSON');if(eJSON)eJSON.onclick=exportJSON;
  const iJSON=document.querySelector('#importJSON');if(iJSON)iJSON.onclick=()=>document.querySelector('#importFile')?.click();
  const file=document.querySelector('#importFile');if(file)file.onchange=importJSON;
  const saveDrive=document.querySelector('#saveDriveConfig');if(saveDrive)saveDrive.onclick=()=>{readDriveFields();saveSettings();toast('Drive settings saved');render();};
  const backupNow=document.querySelector('#backupNow');if(backupNow)backupNow.onclick=()=>driveBackup(true);
  const genToken=document.querySelector('#generateDriveToken');if(genToken)genToken.onclick=()=>{const bytes=new Uint8Array(24);crypto.getRandomValues(bytes);settings.driveBackupToken=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');saveSettings();render();setTimeout(()=>document.querySelector('#driveBackupToken')?.focus(),0);toast('Private token generated');};
  const copyToken=document.querySelector('#copyDriveToken');if(copyToken)copyToken.onclick=async()=>{readDriveFields();if(!settings.driveBackupToken)return toast('Generate a token first');await navigator.clipboard?.writeText(settings.driveBackupToken);toast('Token copied');};
  const driveEnabled=document.querySelector('#driveBackupEnabled');if(driveEnabled)driveEnabled.onchange=e=>{readDriveFields();settings.driveBackupEnabled=e.target.checked;saveSettings();toast(e.target.checked?'Automatic Drive backup enabled':'Automatic Drive backup disabled');render();if(e.target.checked&&driveConfigured())driveBackup(false);};
  const dlTemplate=document.querySelector('#downloadTemplate');if(dlTemplate)dlTemplate.onclick=downloadImportTemplate;
  const importOld=document.querySelector('#importOld');if(importOld)importOld.onclick=()=>document.querySelector('#oldImportFile')?.click();
  const oldFile=document.querySelector('#oldImportFile');if(oldFile)oldFile.onchange=prepareOldImport;
}
function readCloudFields(){
  const email=document.querySelector('#cloudEmail');
  settings.supabaseUrl=PRESET_SUPABASE_URL;
  settings.supabaseAnonKey=PRESET_SUPABASE_KEY;
  if(email)settings.cloudEmail=email.value.trim();
}
function readDriveFields(){
  const url=document.querySelector('#driveBackupUrl'),token=document.querySelector('#driveBackupToken'),folder=document.querySelector('#driveBackupFolder');
  if(url)settings.driveBackupUrl=url.value.trim();
  if(token)settings.driveBackupToken=token.value.trim();
  if(folder)settings.driveBackupFolder=folder.value.trim()||'Booking Diary Backups';
}

function cloudHeaders(token=null,extra={}){
  return {'apikey':settings.supabaseAnonKey,'Content-Type':'application/json',...(token?{'Authorization':`Bearer ${token}`}:{ }),...extra};
}
async function parseResponse(r){
  const text=await r.text();let data={};try{data=text?JSON.parse(text):{};}catch{data={message:text};}
  if(!r.ok)throw new Error(data.msg||data.message||data.error_description||data.error||`HTTP ${r.status}`);
  return data;
}
async function cloudAuth(mode){
  readCloudFields();saveSettings();
  const password=document.querySelector('#cloudPassword')?.value||'';
  if(!cloudConfigured())return toast('Cloud server configuration is unavailable');
  if(!settings.cloudEmail||password.length<6)return toast('Enter email and password (6+ characters)');
  try{
    const endpoint=mode==='signup'?'/auth/v1/signup':'/auth/v1/token?grant_type=password';
    const r=await fetch(settings.supabaseUrl+endpoint,{method:'POST',headers:cloudHeaders(),body:JSON.stringify({email:settings.cloudEmail,password})});
    const data=await parseResponse(r);
    if(mode==='signup'&&!data.access_token){toast('Account created. Check email if confirmation is required, then Sign In.');return;}
    cloudSession=normalizeSession(data);saveSession();toast(mode==='signup'?'Account created & signed in':'Signed in');render();await syncAll(true);
  }catch(e){toast(`Cloud: ${e.message}`);}
}
function normalizeSession(data){
  return {access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Math.floor(Date.now()/1000)+(Number(data.expires_in)||3600),user:data.user||cloudSession?.user||null};
}
async function ensureSession(){
  if(!cloudSession)throw new Error('Not signed in');
  if(cloudSession.expires_at>Date.now()/1000+90)return cloudSession;
  if(!cloudSession.refresh_token)throw new Error('Session expired. Sign in again.');
  const r=await fetch(settings.supabaseUrl+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({refresh_token:cloudSession.refresh_token})});
  const data=await parseResponse(r);cloudSession=normalizeSession(data);saveSession();return cloudSession;
}
async function rest(path,options={}){
  const s=await ensureSession();
  const r=await fetch(settings.supabaseUrl+'/rest/v1/'+path,{...options,headers:cloudHeaders(s.access_token,options.headers||{})});
  return parseResponse(r);
}
async function fetchRemote(){
  return rest('bookings?select=id,data,updated_at&order=updated_at.asc',{method:'GET'});
}
async function pushOne(b){
  if(!cloudSession||!cloudConfigured())return;
  const s=await ensureSession();
  const payload=[{id:b.id,user_id:s.user.id,data:b,updated_at:b.updatedAt||nowISO()}];
  await rest('bookings?on_conflict=id',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(payload)});
}
async function deleteRemote(id){
  if(!cloudSession||!cloudConfigured())return;
  await rest(`bookings?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{'Prefer':'return=minimal'}});
}
async function syncAll(showToast=false){
  if(syncing)return;
  if(!cloudSession||!cloudConfigured()){if(showToast)toast('Cloud Sync is not connected');return;}
  syncing=true;if(showToast)toast('Syncing...');
  try{
    for(const id of [...deletedIds]){await deleteRemote(id);deletedIds=deletedIds.filter(x=>x!==id);saveDeleted();}
    const remote=await fetchRemote();
    const map=new Map();
    bookings.forEach(b=>map.set(b.id,b));
    remote.forEach(r=>{
      const rb=r.data||{};if(!rb.id)rb.id=r.id;
      const lb=map.get(r.id);
      const rt=new Date(rb.updatedAt||r.updated_at||0).getTime(),lt=new Date(lb?.updatedAt||0).getTime();
      if(!lb||rt>lt)map.set(r.id,rb);
    });
    bookings=[...map.values()];save();
    if(bookings.length){
      const s=await ensureSession();
      const payload=bookings.map(b=>({id:b.id,user_id:s.user.id,data:b,updated_at:b.updatedAt||nowISO()}));
      await rest('bookings?on_conflict=id',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(payload)});
    }
    if(showToast)toast('Cloud sync complete');render();
  }catch(e){if(showToast)toast(`Sync failed: ${e.message}`);}finally{syncing=false;}
}


function scheduleDriveBackup(delay=2500){
  clearTimeout(driveBackupTimer);
  driveBackupTimer=setTimeout(()=>driveBackup(false),delay);
}
function csvText(data=bookings){
  const cols=['Event Date','Event Time','Event Type','Client Name','Mobile','Alternate Mobile','Location','City','Service Package','Assigned To','Source','Advance','Total','Balance','Payment Status','Payment Mode','Booking Status','Historical','Reminder Days','Reminder Time','Notes'];
  const map={'Event Date':'eventDate','Event Time':'eventTime','Event Type':'eventType','Client Name':'clientName','Mobile':'mobile','Alternate Mobile':'alternateMobile','Location':'location','City':'city','Service Package':'servicePackage','Assigned To':'assignedTo','Source':'source','Advance':'advance','Total':'total','Balance':'balance','Payment Status':'paymentStatus','Payment Mode':'paymentMode','Booking Status':'bookingStatus','Historical':'historical','Reminder Days':'reminderDays','Reminder Time':'reminderTime','Notes':'notes'};
  return [cols.join(','),...data.map(b=>cols.map(k=>'"'+String(b[map[k]]??'').replace(/"/g,'""')+'"').join(','))].join('\n');
}
function backupPayload(){
  return {version:'3.2',exportedAt:nowISO(),source:'Booking Diary PWA',bookings,settings:{defaultReminderDays:settings.defaultReminderDays,defaultReminderTime:settings.defaultReminderTime}};
}
async function driveBackup(showToast=false){
  if(!settings.driveBackupEnabled&& !showToast)return;
  if(!driveConfigured()){if(showToast)toast('Add Drive Web App URL + private token first');return;}
  if(!navigator.onLine){if(showToast)toast('Offline — Drive backup will retry after next change');return;}
  try{
    const payload={token:settings.driveBackupToken,action:'backup',folderName:settings.driveBackupFolder||'Booking Diary Backups',json:backupPayload(),csv:csvText(),clientTime:nowISO()};
    await fetch(settings.driveBackupUrl,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
    settings.lastDriveBackupAt=nowISO();settings.lastDriveBackupStatus='Sent';saveSettings();
    if(showToast)toast('Backup sent to Google Drive');
  }catch(e){settings.lastDriveBackupStatus='Failed';saveSettings();if(showToast)toast(`Drive backup failed: ${e.message}`);}
}

function downloadImportTemplate(){
  const header='Event Date,Event Time,Event Type,Client Name,Mobile,Alternate Mobile,Location,City,Advance,Total,Balance,Payment Status,Payment Mode,Booking Status,Service Package,Assigned To,Source,Notes\n';
  download(new Blob([header],{type:'text/csv;charset=utf-8'}),'booking-diary-old-bookings-template.csv');
}
function parseCSV(text){
  const rows=[];let row=[],field='',q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];
    if(c==='"'){if(q&&n==='"'){field+='"';i++;}else q=!q;}
    else if(c===','&&!q){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i++;row.push(field);field='';if(row.some(x=>String(x).trim()!==''))rows.push(row);row=[];}
    else field+=c;
  }
  row.push(field);if(row.some(x=>String(x).trim()!==''))rows.push(row);
  if(!rows.length)return [];
  const headers=rows.shift().map(h=>String(h).trim());
  return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
}
function normKey(k){return String(k||'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function aliasValue(row,aliases){
  const m={};Object.entries(row||{}).forEach(([k,v])=>m[normKey(k)]=v);
  for(const a of aliases){const k=normKey(a);if(m[k]!==undefined&&String(m[k]).trim()!=='')return m[k];}
  return '';
}
function normalizeDateValue(v){
  if(v instanceof Date&&!isNaN(v))return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
  let s=String(v??'').trim();if(!s)return '';
  if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);
  let m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);if(m)return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
  const d=new Date(s);if(!isNaN(d))return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return '';
}
function numValue(v){const n=Number(String(v??'').replace(/[₹,\s]/g,''));return Number.isFinite(n)?n:0;}
function mapImportRow(row,rowNo){
  const eventDate=normalizeDateValue(aliasValue(row,['Event Date','Booking Date','Date']));
  const clientName=String(aliasValue(row,['Client Name','Customer Name','Name'])).trim();
  const mobile=String(aliasValue(row,['Mobile','Mobile Number','Phone','Phone Number'])).trim();
  const errors=[];if(!eventDate)errors.push('valid date required');if(!clientName)errors.push('client name required');if(!mobile)errors.push('mobile required');
  const advance=numValue(aliasValue(row,['Advance','Advance Amount','Received']));
  const total=numValue(aliasValue(row,['Total','Final Amount','Final Booking Amount','Booking Amount']));
  const givenBalance=aliasValue(row,['Balance','Pending','Pending Amount']);
  const balance=String(givenBalance).trim()!==''?Math.max(0,numValue(givenBalance)):Math.max(0,total-advance);
  const historical=eventDate?eventDate<todayISO():true;
  const now=nowISO();
  const obj={
    id:(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)),eventDate,
    eventTime:String(aliasValue(row,['Event Time','Time'])).trim(),eventType:String(aliasValue(row,['Event Type','Type','Service Type'])).trim()||'Other',clientName,mobile,
    alternateMobile:String(aliasValue(row,['Alternate Mobile','Alternate Phone'])).trim(),location:String(aliasValue(row,['Location','Venue','Venue Name'])).trim(),city:String(aliasValue(row,['City'])).trim(),
    servicePackage:String(aliasValue(row,['Service Package','Package','Service'])).trim(),assignedTo:String(aliasValue(row,['Assigned To','Artist','Staff'])).trim(),source:String(aliasValue(row,['Source','Booking Source'])).trim(),
    advance,total,balance,paymentStatus:String(aliasValue(row,['Payment Status'])).trim()||(balance<=0&&total>0?'Fully Paid':advance>0?'Advance Paid':'Pending'),paymentMode:String(aliasValue(row,['Payment Mode','Mode'])).trim()||'Other',
    bookingStatus:String(aliasValue(row,['Booking Status','Status'])).trim()||(historical?'Completed':'Confirmed'),historical,reminderEnabled:false,reminderDays:Number(settings.defaultReminderDays||2),reminderTime:settings.defaultReminderTime,
    notes:String(aliasValue(row,['Notes','Special Instructions','Remark','Remarks'])).trim(),createdAt:now,updatedAt:now,_rowNo:rowNo,_errors:errors
  };
  const dup=bookings.find(b=>b.eventDate===eventDate&&phone(b.mobile)===phone(mobile)&&phone(mobile));
  obj._duplicate=!!dup;obj._duplicateName=dup?.clientName||'';return obj;
}
async function prepareOldImport(e){
  const file=e.target.files?.[0];if(!file)return;
  try{
    let rows=[];const name=file.name.toLowerCase();
    if(name.endsWith('.csv'))rows=parseCSV(await file.text());
    else if(name.endsWith('.xlsx')||name.endsWith('.xls')){
      if(!window.XLSX)throw new Error('Excel reader could not load. Use CSV or reopen app with internet.');
      const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];rows=XLSX.utils.sheet_to_json(ws,{defval:'',raw:false});
    }else throw new Error('Please select CSV, XLSX or XLS file');
    importFileName=file.name;importRows=rows.map((r,i)=>mapImportRow(r,i+2));importErrors=importRows.filter(x=>x._errors.length);
    tab='import';render();
  }catch(err){toast(`Import failed: ${err.message}`);}finally{e.target.value='';}
}
function importPage(){
  const valid=importRows.filter(x=>!x._errors.length&&!x._duplicate),dups=importRows.filter(x=>x._duplicate),bad=importRows.filter(x=>x._errors.length);
  return `<div class="page"><div class="topbar"><button id="cancelImport" class="icon">‹</button><div>${topHeader('Old Diary Import','Import Preview',importFileName||'Review before saving.')}</div><div></div></div>
    <div class="import-kpis"><div><strong>${valid.length}</strong><span>Ready</span></div><div><strong>${dups.length}</strong><span>Duplicates</span></div><div><strong>${bad.length}</strong><span>Needs Fix</span></div></div>
    ${bad.length?`<div class="banner">${bad.length} row(s) are missing required date, client name or mobile. They will not be imported.</div>`:''}
    <div class="list import-preview">${importRows.slice(0,50).map(b=>`<div class="import-row ${b._errors.length?'bad':b._duplicate?'dup':'good'}"><div><b>Row ${b._rowNo}: ${esc(b.clientName||'Unnamed')}</b><span>${label(b.eventDate)} · ${esc(b.eventType||'Other')}</span><span>${esc(b.mobile||'No mobile')} · ${esc([b.location,b.city].filter(Boolean).join(', ')||'No venue')}</span></div><em>${b._errors.length?esc(b._errors.join(', ')):b._duplicate?`Duplicate of ${esc(b._duplicateName)}`:'Ready'}</em></div>`).join('')}</div>
    ${importRows.length>50?`<div class="mini">Showing first 50 of ${importRows.length} rows.</div>`:''}
    <div class="sticky-actions"><button id="cancelImport2" class="btn secondary">Cancel</button><button id="confirmImport" class="btn primary" ${valid.length?'':'disabled'}>Import ${valid.length} Booking${valid.length===1?'':'s'}</button></div>
  </div>`;
}
async function confirmOldImport(){
  const valid=importRows.filter(x=>!x._errors.length&&!x._duplicate).map(x=>{const y={...x};delete y._rowNo;delete y._errors;delete y._duplicate;delete y._duplicateName;return y;});
  if(!valid.length)return toast('No valid rows to import');
  if(!confirm(`Import ${valid.length} old booking(s)?`))return;
  bookings.push(...valid);save();importRows=[];importErrors=[];importFileName='';selectedMonth='all';bookingFilter='past';tab='bookings';render();toast(`${valid.length} old bookings imported`);
  if(cloudSession&&settings.autoSync)syncAll(false);if(settings.driveBackupEnabled)driveBackup(false);
}
function exportCSV(){download(new Blob([csvText()],{type:'text/csv;charset=utf-8'}),`booking-diary-${todayISO()}.csv`);}
function exportJSON(){
  const data={version:'3.2',exportedAt:nowISO(),bookings,settings:{defaultReminderDays:settings.defaultReminderDays,defaultReminderTime:settings.defaultReminderTime}};
  download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),`booking-diary-backup-${todayISO()}.json`);
}
async function importJSON(e){
  const file=e.target.files?.[0];if(!file)return;
  try{
    const data=JSON.parse(await file.text());const incoming=Array.isArray(data)?data:data.bookings;
    if(!Array.isArray(incoming))throw new Error('Invalid backup file');
    if(!confirm(`Restore ${incoming.length} bookings? Existing bookings will be merged by Booking ID.`))return;
    const map=new Map(bookings.map(b=>[b.id,b]));incoming.forEach(b=>{if(b?.id)map.set(b.id,b);});bookings=[...map.values()];save();toast('Backup restored');render();if(cloudSession)syncAll(false);
  }catch(err){toast(`Restore failed: ${err.message}`);}finally{e.target.value='';}
}
function downloadICS(b){
  if(!b)return;
  const dt=b.eventDate.replaceAll('-','');
  const clean=s=>String(s||'').replace(/[\\;,\n]/g,m=>({'\\':'\\\\',';':'\\;',',':'\\,','\n':'\\n'}[m]));
  const place=[b.location,b.city].filter(Boolean).join(', ');
  const desc=bookingSummary(b);
  const days=Number(b.reminderDays??2);
  const start=b.eventTime?`${dt}T${b.eventTime.replace(':','')}00`:`${dt}`;
  const dtstart=b.eventTime?`DTSTART:${start}`:`DTSTART;VALUE=DATE:${start}`;
  const dtend=b.eventTime?'':`\r\nDTEND;VALUE=DATE:${dt}`;
  const ics=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Booking Diary//EN\r\nBEGIN:VEVENT\r\nUID:${b.id}@bookingdiary\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}\r\n${dtstart}${dtend}\r\nSUMMARY:${clean(`${b.clientName} - ${b.eventType}`)}\r\nLOCATION:${clean(place)}\r\nDESCRIPTION:${clean(desc)}\r\nBEGIN:VALARM\r\nTRIGGER:-P${days}D\r\nACTION:DISPLAY\r\nDESCRIPTION:Booking reminder: ${clean(`${b.clientName} - ${b.eventType}`)}\r\nEND:VALARM\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
  download(new Blob([ics],{type:'text/calendar;charset=utf-8'}),`${(b.clientName||'booking').replace(/[^a-z0-9]/gi,'-')}-booking.ics`);toast('Calendar reminder file ready');
}
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;render();});
window.addEventListener('online',()=>{if(cloudSession&&settings.autoSync)syncAll(false);if(settings.driveBackupEnabled&&driveConfigured())scheduleDriveBackup(1200);});
window.addEventListener('focus',()=>{if(cloudSession&&settings.autoSync)syncAll(false);});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&cloudSession&&settings.autoSync)syncAll(false);});
setInterval(()=>{if(document.visibilityState==='visible'&&cloudSession&&settings.autoSync&&navigator.onLine)syncAll(false);},120000);
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('sw.js?v=3.3.2').catch(()=>{});
setInterval(notifyDue,60000);setTimeout(notifyDue,1000);
setTimeout(()=>{if(cloudSession&&cloudConfigured()&&settings.autoSync)syncAll(false);},1800);

render();
})();
