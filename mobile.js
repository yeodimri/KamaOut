function alertHtml(x){
  const over=x.a>x.threshold;
  return `<div class="mAlertRow">
    <div class="mAlertText"><strong>${x.c.name}</strong><small>${ils(x.a)} מתוך ${ils(x.c.budget)}</small></div>
    <span class="mAlertBadge ${over?'danger':'warning'}">${over?`חריגה ${ils(x.a-x.threshold)}`:`${x.p}%`}</span>
  </div>`
}

function groupCard(n,g){
  const p=pct(g.actual,g.budget), cls=g.actual>g.budget?'over':p>=80?'warn':'';
  return `<div class="mCategoryRow">
    <div class="mCategoryTop">
      <div><strong>${n}</strong><small>${ils(g.actual)} מתוך ${ils(g.budget)}</small></div>
      <span>${p}%</span>
    </div>
    <div class="mProgress ${cls}"><i style="width:${Math.min(100,p)}%"></i></div>
  </div>`
}

function txHtml(t){
  const c=state.categories.find(c=>c.id===t.categoryId);
  return `<div class="mTxRow">
    <div class="mTxMain">
      <div class="mTxIcon">${(t.merchant||'ה').trim().charAt(0)}</div>
      <div><strong>${t.merchant}</strong><small>${c?.name||''} · ${t.person||''}</small></div>
    </div>
    <strong class="mTxAmount">${ils(t.amount)}</strong>
  </div>`
}

function mobileHome(){
  const tx=txs(), al=alerts(), spent=actualTotal(), budget=expenseBudget();
  const remaining=Math.max(budget-spent,0);
  const used=pct(spent,budget);
  const groups=Object.entries(groupData()).sort((a,b)=>b[1].budget-a[1].budget);
  const hasOver=al.some(x=>x.a>x.threshold);
  return `<div class="mHome">
    <header class="mHeader">
      <div>
        <div class="mLogo">KamaOut</div>
        <div class="mDate">${monthLabel()}</div>
      </div>
      <button class="mProfile" aria-label="פרופיל">י</button>
    </header>

    <section class="mHero">
      <div class="mHeroEyebrow">הוצאנו החודש</div>
      <div class="mHeroAmount">${ils(spent)}</div>
      <div class="mHeroTrack"><i style="width:${Math.min(100,used)}%"></i></div>
      <div class="mHeroBudget"><span>${used}% מהתקציב</span><span>נשאר ${ils(remaining)}</span></div>
      <div class="mHeroDivider"></div>
      <div class="mHeroStats">
        <div><span>הכנסות</span><strong>${ils(incomeBudget())}</strong></div>
        <div><span>תקציב ריאלי</span><strong>${ils(budget)}</strong></div>
        <div><span>יתרה צפויה</span><strong>${ils(predictedBalance())}</strong></div>
      </div>
    </section>

    <div class="mQuickActions">
      <button class="mQuick primary" data-action="scan"><span class="mQuickIcon">▣</span><span><strong>צלם קבלה</strong><small>נזהה את ההוצאה</small></span></button>
      <button class="mQuick secondary" data-action="add"><span class="mQuickIcon">＋</span><span><strong>הוסף ידנית</strong><small>פחות מ־10 שניות</small></span></button>
    </div>

    <section class="mBlock">
      <div class="mBlockHead"><div><span class="mKicker">מצב החודש</span><h3>חריגות והתראות</h3></div><button data-tab="month">לכל התקציב</button></div>
      ${al.length?al.slice(0,3).map(alertHtml).join(''):`<div class="mGoodState"><span class="mGoodIcon">✓</span><div><strong>הכול נראה טוב</strong><small>אין כרגע חריגות או קטגוריות קרובות לתקרה</small></div></div>`}
    </section>

    <section class="mBlock">
      <div class="mBlockHead"><div><span class="mKicker">לאן הכסף הולך?</span><h3>קטגוריות מרכזיות</h3></div><button data-tab="month">הכול</button></div>
      ${groups.slice(0,5).map(([n,g])=>groupCard(n,g)).join('')}
    </section>

    <section class="mBlock mLastBlock">
      <div class="mBlockHead"><div><span class="mKicker">פעילות</span><h3>הוצאות אחרונות</h3></div><button data-tab="expenses">לכולן</button></div>
      ${tx.length?tx.slice(0,5).map(txHtml).join(''):`<div class="mEmptyState"><div class="mEmptyIcon">₪</div><strong>עוד אין הוצאות</strong><small>ההוצאה הראשונה שתוסיפו תופיע כאן מיד</small><button data-action="add">הוסף הוצאה ראשונה</button></div>`}
    </section>
  </div>`;
}

function mobileMonth(){
  return `<div class="mSubPage">
    <div class="mSubHeader"><span>${monthLabel()}</span><h2>החודש</h2><p>תקציב מול מה שקרה בפועל</p></div>
    <div class="mMiniCards">
      <div><span>תקציב</span><strong>${ils(expenseBudget())}</strong></div>
      <div><span>בפועל</span><strong>${ils(actualTotal())}</strong></div>
      <div><span>נותר</span><strong>${ils(Math.max(expenseBudget()-actualTotal(),0))}</strong></div>
    </div>
    <section class="mBlock mStandalone">${state.categories.map(c=>groupCard(c.name,{budget:c.budget,actual:actual(c.id)})).join('')}</section>
  </div>`;
}

function mobileExpenses(){
  const tx=txs();
  return `<div class="mSubPage">
    <div class="mSubHeader"><span>${monthLabel()}</span><h2>הוצאות</h2><p>כל העסקאות במקום אחד</p></div>
    <div class="mQuickActions mSubActions">
      <button class="mQuick primary" data-action="scan"><span class="mQuickIcon">▣</span><span><strong>צלם קבלה</strong></span></button>
      <button class="mQuick secondary" data-action="add"><span class="mQuickIcon">＋</span><span><strong>הוסף ידנית</strong></span></button>
    </div>
    <section class="mBlock mStandalone">${tx.length?tx.map(txHtml).join(''):`<div class="mEmptyState"><div class="mEmptyIcon">₪</div><strong>אין עסקאות עדיין</strong><small>הוסיפו הוצאה והיא תופיע כאן.</small></div>`}</section>
  </div>`;
}

function mobileStatus(){
  const f=flexTotals();
  return `<div class="mSubPage">
    <div class="mSubHeader"><span>${monthLabel()}</span><h2>מצבנו</h2><p>התמונה הריאלית של משק הבית</p></div>
    <section class="mBalanceCard"><span>יתרה חודשית צפויה</span><strong>${ils(predictedBalance())}</strong><small>${ils(incomeBudget())} הכנסות פחות ${ils(expenseBudget())} תקציב ריאלי</small></section>
    <section class="mBlock mStandalone"><div class="mBlockHead"><div><span class="mKicker">תקציב</span><h3>גלוי מול רזרבות</h3></div></div>${groupCard('הוצאות גלויות',{budget:visibleBudget(),actual:0})}${groupCard('רזרבות / חבויות',{budget:hiddenBudget(),actual:0})}</section>
    <section class="mBlock"><div class="mBlockHead"><div><span class="mKicker">שליטה</span><h3>גמישות התקציב</h3></div></div>${groupCard('קשיח',{budget:f.fixed,actual:0})}${groupCard('בינוני',{budget:f.medium,actual:0})}${groupCard('גמיש',{budget:f.high,actual:0})}</section>
  </div>`;
}

function mobileView(){
  let content=mobileTab==='home'?mobileHome():mobileTab==='month'?mobileMonth():mobileTab==='expenses'?mobileExpenses():mobileStatus();
  return `<div class="mobileShell">${content}<nav class="bottomNav">
    <button data-tab="home" class="${mobileTab==='home'?'active':''}"><span class="navIcon">⌂</span><span>בית</span></button>
    <button data-tab="month" class="${mobileTab==='month'?'active':''}"><span class="navIcon">▦</span><span>החודש</span></button>
    <button data-tab="expenses" class="${mobileTab==='expenses'?'active':''}"><span class="navIcon">≡</span><span>הוצאות</span></button>
    <button data-tab="status" class="${mobileTab==='status'?'active':''}"><span class="navIcon">◉</span><span>מצבנו</span></button>
  </nav></div>`;
}
