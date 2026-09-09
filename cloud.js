const SUPABASE_URL='https://ukjtrhwalayxznepzbvq.supabase.co';
const SUPABASE_KEY='__SUPABASE_PUBLISHABLE_KEY__';
let sb=null, cloudReady=false, currentUser=null, currentHouseholdId=null, currentMemberRole=null, realtimeChannel=null;

function ensureClient(){
  if(!window.supabase) throw new Error('Supabase client not loaded');
  if(SUPABASE_KEY.startsWith('__')) return false;
  if(!sb) sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  return true;
}

function authScreen(message=''){
  document.getElementById('app').innerHTML=`<div class="authShell"><div class="authCard"><div class="authBrand">KamaOut</div><div class="authTag">כמה יצא לנו?</div>${message?`<div class="authMsg">${message}</div>`:''}<div class="authTabs"><button id="showLogin" class="active">כניסה</button><button id="showSignup">הרשמה</button></div><label>אימייל</label><input id="authEmail" type="email" autocomplete="email"><label>סיסמה</label><input id="authPassword" type="password" autocomplete="current-password"><button id="authSubmit" class="authPrimary">כניסה</button></div></div>`;
  let mode='login';
  const setMode=m=>{mode=m;document.getElementById('showLogin').classList.toggle('active',m==='login');document.getElementById('showSignup').classList.toggle('active',m==='signup');document.getElementById('authSubmit').textContent=m==='login'?'כניסה':'יצירת חשבון'};
  showLogin.onclick=()=>setMode('login');showSignup.onclick=()=>setMode('signup');
  authSubmit.onclick=async()=>{const email=authEmail.value.trim(),password=authPassword.value;if(!email||password.length<6)return alert('צריך אימייל וסיסמה של לפחות 6 תווים');const r=mode==='login'?await sb.auth.signInWithPassword({email,password}):await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin}});if(r.error)return alert(r.error.message);if(mode==='signup'&&!r.data.session)return authScreen('שלחנו מייל לאישור החשבון. אחרי האישור חזור לכאן והיכנס.');await initCloud()};
}

function onboardingScreen(invite=''){
  document.getElementById('app').innerHTML=`<div class="authShell"><div class="authCard"><div class="authBrand">ברוכים הבאים</div><div class="authTag">הגדרת משק הבית</div><label>השם שלך</label><input id="displayName" placeholder="למשל יהונתן"><button id="createHome" class="authPrimary">צור משק בית חדש</button><div class="or">או</div><label>קוד הזמנה</label><input id="inviteCode" value="${invite}"><button id="joinHome" class="authSecondary">הצטרף למשק בית</button></div></div>`;
  createHome.onclick=async()=>{const name=displayName.value.trim()||'משתמש';const {data,error}=await sb.rpc('bootstrap_household',{household_name:'משפחת דמרי',display_name:name});if(error)return alert(error.message);currentHouseholdId=data;await seedDefaultHousehold();await loadCloudState()};
  joinHome.onclick=async()=>{const code=inviteCode.value.trim(),name=displayName.value.trim()||'משתמש';if(!code)return alert('צריך קוד הזמנה');const {data,error}=await sb.rpc('accept_household_invite',{invite_code:code,display_name:name});if(error)return alert(error.message);currentHouseholdId=data;await loadCloudState()};
}

async function seedDefaultHousehold(){
  await sb.from('income_sources').insert(DEFAULT_STATE.incomes.map((x,i)=>({household_id:currentHouseholdId,name:x.name,monthly_budget:x.budget,sort_order:i})));
  await sb.from('categories').insert(DEFAULT_STATE.categories.map((c,i)=>({household_id:currentHouseholdId,key:c.id,group_name:c.group,name:c.name,monthly_budget:c.budget,flexibility:c.flex,visibility:c.visibility,alert_at:c.alertAt||null,sort_order:i})));
}

async function loadCloudState(){
  const {data:members,error}=await sb.from('household_members').select('household_id,role').limit(1);if(error)return alert(error.message);
  if(!members?.length)return onboardingScreen(new URLSearchParams(location.search).get('invite')||'');
  currentHouseholdId=members[0].household_id;currentMemberRole=members[0].role;
  const [{data:house},{data:inc},{data:cats},{data:tx}]=await Promise.all([sb.from('households').select('id,name').eq('id',currentHouseholdId).single(),sb.from('income_sources').select('*').eq('household_id',currentHouseholdId).order('sort_order'),sb.from('categories').select('*').eq('household_id',currentHouseholdId).order('sort_order'),sb.from('transactions').select('*').eq('household_id',currentHouseholdId).order('transaction_date',{ascending:false}).order('created_at',{ascending:false})]);
  state={month:'2026-09',household:{name:house?.name||'משק הבית',currency:'ILS',monthlySavingsTarget:1000},incomes:(inc||[]).map(x=>({id:x.id,name:x.name,budget:Number(x.monthly_budget)})),categories:(cats||[]).map(c=>({id:c.id,key:c.key,group:c.group_name,name:c.name,budget:Number(c.monthly_budget),flex:c.flexibility,visibility:c.visibility,alertAt:c.alert_at==null?undefined:Number(c.alert_at)})),transactions:(tx||[]).map(t=>({id:t.id,month:t.transaction_date.slice(0,7),date:t.transaction_date,merchant:t.merchant||'',amount:Number(t.amount),categoryId:t.category_id,person:t.payer_name||'',payment:t.payment_method||''}))};
  cloudReady=true;render();subscribeRealtime();
}

function subscribeRealtime(){if(realtimeChannel)sb.removeChannel(realtimeChannel);realtimeChannel=sb.channel('kamaout-household').on('postgres_changes',{event:'*',schema:'public',table:'transactions',filter:`household_id=eq.${currentHouseholdId}`},()=>loadCloudState()).on('postgres_changes',{event:'*',schema:'public',table:'categories',filter:`household_id=eq.${currentHouseholdId}`},()=>loadCloudState()).on('postgres_changes',{event:'*',schema:'public',table:'income_sources',filter:`household_id=eq.${currentHouseholdId}`},()=>loadCloudState()).subscribe()}

async function cloudAddTransaction(t){const {error}=await sb.from('transactions').insert({household_id:currentHouseholdId,created_by:currentUser.id,category_id:t.categoryId,amount:t.amount,merchant:t.merchant,payer_name:t.person,payment_method:t.payment,transaction_date:new Date(t.date).toISOString().slice(0,10)});if(error)throw error;await loadCloudState()}
async function cloudUpdateCategory(c){const {error}=await sb.from('categories').update({monthly_budget:c.budget,flexibility:c.flex,visibility:c.visibility}).eq('id',c.id);if(error)throw error;await loadCloudState()}
async function cloudDeleteTransaction(id){const {error}=await sb.from('transactions').delete().eq('id',id);if(error)throw error;await loadCloudState()}
async function cloudUpdateIncome(x){const {error}=await sb.from('income_sources').update({monthly_budget:x.budget}).eq('id',x.id);if(error)throw error;await loadCloudState()}

async function accountSheet(){const {data:members}=await sb.from('household_members').select('user_id,role').eq('household_id',currentHouseholdId);openSheet(`<div class="sheetBack" id="overlay"><div class="sheet"><h2>החשבון והמשפחה</h2><div class="accountInfo">${currentUser.email}<br><small>${state.household.name} · ${members?.length||1} משתמשים</small></div>${currentMemberRole==='owner'?`<label>הזמן משתמש נוסף</label><input id="inviteEmail" type="email" placeholder="אימייל (אופציונלי)"><button class="save" id="makeInvite">צור לינק הזמנה</button><div id="inviteResult"></div>`:''}<button class="authSecondary" id="logoutBtn" style="width:100%;margin-top:12px">התנתק</button></div></div>`);if(document.getElementById('makeInvite'))makeInvite.onclick=async()=>{const {data,error}=await sb.rpc('create_household_invite',{hid:currentHouseholdId,email:inviteEmail.value.trim()||null});if(error)return alert(error.message);const link=`${location.origin}${location.pathname}?invite=${data}`;inviteResult.innerHTML=`<div class="inviteBox"><strong>לינק הזמנה</strong><input id="inviteLink" value="${link}" readonly><button id="copyInvite" class="authSecondary">העתק</button></div>`;copyInvite.onclick=()=>navigator.clipboard.writeText(link).then(()=>alert('הועתק'))};logoutBtn.onclick=async()=>{await sb.auth.signOut();location.reload()}}

async function initCloud(){if(!ensureClient()){document.getElementById('app').innerHTML='<div class="authShell"><div class="authCard"><div class="authBrand">KamaOut</div><div class="authMsg">חיבור הענן כמעט מוכן. חסר Publishable Key בהגדרת האפליקציה.</div></div></div>';return}const {data:{session}}=await sb.auth.getSession();if(!session)return authScreen();currentUser=session.user;await loadCloudState()}
