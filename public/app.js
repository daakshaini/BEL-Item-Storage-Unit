const app = document.getElementById("app");
const headerActions = document.getElementById("header-actions");
const toastBox = document.getElementById("toast");
let currentUser = null;
let captchaData = null;
let toastTimer;

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = v => `₹${Number(v || 0).toFixed(2)}`;
const date = v => v ? new Date(v.replace(" ","T")+"Z").toLocaleString() : "—";
const fmt = n => Number(n || 0).toLocaleString("en-IN");
function notify(message, isError=false) {
  toastBox.textContent = message; toastBox.style.background = isError ? "#a83232" : "#1e2d49";
  toastBox.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toastBox.classList.remove("show"),2800);
}
async function api(url, options={}) {
  const response = await fetch(url,{credentials:"same-origin",...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
function setHeader() {
  const isAuth = !currentUser && ["login", "signup", "admin-login"].includes(route());
  const isLanding = !currentUser && route()==="";
  document.querySelector(".topbar").classList.toggle("hide", isAuth);
  document.body.classList.toggle("landing-mode", isLanding);
  const brandName = document.querySelector(".brand strong");
  if (brandName) brandName.textContent = isLanding ? "InventoryHub" : "Item Storage Unit";
  document.body.classList.toggle("auth-mode", isAuth);
  document.body.classList.toggle("auth-signup", isAuth && route()==="signup");
  document.body.classList.toggle("auth-admin", isAuth && route()==="admin-login");
  document.body.classList.toggle("user-mode", !!currentUser && currentUser.role!=="admin");
  document.body.classList.toggle("admin-mode", !!currentUser && currentUser.role==="admin");
  headerActions.innerHTML = currentUser
    ? `<nav class="main-nav"><a href="#/new-item" class="nav-link ${route()==="new-item"?"active":""}">＋ Add Item</a><a href="#/inventory" class="nav-link ${route()==="inventory"||route()==="history"?"active":""}">☷ My Inventory</a>${currentUser.role==="admin"?`<a href="#/admin" class="nav-link ${route().startsWith("admin")?"active":""}">♙ Admin</a>`:""}</nav><span class="muted small user-identity">@${esc(currentUser.username)}</span><button class="btn btn-outline btn-sm" id="logoutBtn">↪ Logout</button>`
    : `<a class="btn btn-ghost btn-sm" href="#/login">Login</a><a class="btn btn-sm" href="#/signup">Sign up</a>`;
  document.getElementById("logoutBtn")?.addEventListener("click",logout);
}
async function logout(){try{await api("/api/logout",{method:"POST",body:"{}"});}catch{}currentUser=null;setHeader();location.hash="/login";render();}
function welcomePopup(message){if(!message)return;const el=document.createElement("div");el.className="welcome";el.innerHTML=`<div class="welcome-box"><div class="welcome-mark">✓</div><h2>${esc(message)}</h2><p>Your session has started successfully.</p><button class="btn" id="welcomeOk">Continue</button></div>`;document.body.appendChild(el);el.querySelector("#welcomeOk").onclick=()=>el.remove();}
function route(){return (location.hash.replace(/^#\/?/,"")||"").split("?")[0];}
function go(path){location.hash="/"+path;}
function pageHead(title,sub,action=""){return `<div class="section-head"><div><h1>${title}</h1><p>${sub}</p></div>${action}</div>`;}
function landingPage(){
  app.innerHTML = `<div class="landing-page">
    <section class="landing-hero">
      <h1>Manage your inventory<br><span>securely</span></h1>
      <div class="landing-actions"><a class="btn landing-primary" href="#/signup">Get Started</a><a class="btn landing-secondary" href="#/login">I have an account</a></div>
    </section>
    <section class="landing-features" aria-label="Features">
      <article class="landing-feature"><div class="feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 4.5 6v5.5c0 4.7 3.2 7.8 7.5 9.5 4.3-1.7 7.5-4.8 7.5-9.5V6L12 3Z"/><path d="m9 12 2 2 4-4"/></svg></div><h2>Private accounts</h2><p>Each user only sees their own inventory.</p></article>
      <article class="landing-feature"><div class="feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 2 5 3v6l-5 3-5-3V5l5-3Z"/><path d="m7 11-5 3v6l5 3 5-3v-6l-5-3Z"/><path d="m17 11-5 3v6l5 3 5-3v-6l-5-3Z"/><path d="m7 5 5 3 5-3M7 17l5 3 5-3"/></svg></div><h2>Item tracking</h2><p>Part number, name, price, and quantity.</p></article>
      <article class="landing-feature"><div class="feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="M3 7v10l9 5 9-5V7M12 12v10"/></svg></div><h2>Simple UI</h2><p>Clean blue &amp; white modern design.</p></article>
    </section>
  </div>`;
}
function stat(label,value,foot=""){return `<div class="card stat"><p class="stat-label">${label}</p><div class="stat-value">${value}</div>${foot?`<div class="stat-foot">${foot}</div>`:""}</div>`;}
function table(headers,rows,empty="No records found."){return `<div class="card table-wrap"><table class="data-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows||`<tr><td colspan="${headers.length}"><div class="empty">${empty}</div></td></tr>`}</tbody></table></div>`;}
function adminNav(active){const links=[["admin","▦","Dashboard"],["admin/items","▤","All Items"],["admin/transactions","⇄","Transactions"],["admin/users","♙","Users"],["admin/activity","◷","Activity Logs"],["admin/security","⛨","Security"]];return `<aside class="card sidebar"><div class="side-label">Admin Console</div>${links.map(([path,icon,label])=>`<a class="side-link ${active===path?"active":""}" href="#/${path}"><span class="side-icon">${icon}</span>${label}</a>`).join("")}<div class="side-bottom"><a class="side-link" href="#/inventory"><span class="side-icon">←</span>Back to app</a></div></aside>`;}
function shell(nav,content){return `<div class="layout">${nav}<section>${content}</section></div>`;}
function userShell(content){return `<div class="user-content">${content}</div>`;}
async function loadCaptcha(){captchaData=await api("/api/captcha");return `<div class="field"><label>CAPTCHA Verification</label><div class="captcha-row"><div class="captcha-question">${esc(captchaData.question)}</div><button class="btn btn-outline btn-sm" type="button" id="refreshCaptcha" title="Refresh CAPTCHA">↻</button></div><input class="input" name="captchaAnswer" placeholder="Enter the answer" inputmode="numeric" required><input type="hidden" name="captchaToken" value="${captchaData.token}"></div>`;}
async function authPage(signup=false,admin=false){
  const title=admin?"Administrator Login":signup?"Create your account":"Welcome back";
  const sub=admin?"Sign in to the administrator console":signup?"Create your Item Storage Unit account":"Sign in to access your inventory";
  const captcha=await loadCaptcha();
  app.innerHTML=`<div class="auth-wrap"><div class="card auth-card"><div class="auth-logo">IS</div><h1>${title}</h1><p class="intro">${sub}</p><form id="authForm" class="auth-form">
  <div class="field"><label>${admin?"Admin Email / Username":"Username"}</label><input class="input" name="username" autocomplete="username" placeholder="${admin?"masteradmin@2026":"Enter 6-digit username"}" required ${signup?'pattern="2[0-9]{5}" maxlength="6"':''}></div>
  <div class="field"><label>Password</label><input class="input" type="password" name="password" autocomplete="${signup?"new-password":"current-password"}" placeholder="Enter password" required></div>
  ${signup?`<div class="field"><label>Confirm Password</label><input class="input" type="password" name="confirmPassword" autocomplete="new-password" required><span class="muted small">At least 8 characters with uppercase, lowercase, number and special character.</span></div>`:""}
  <div id="captchaSlot">${captcha}</div><div id="formError" class="error hide"></div><button class="btn" type="submit">${signup?"Create Account":"Sign In"}</button>
  </form><p class="auth-foot">${admin?`<a href="#/login">User login</a>`:signup?`Already have an account? <a href="#/login">Sign in</a>`:`Don't have an account? <a href="#/signup">Create account</a>`}</p>
  ${!admin?`<p class="auth-foot"><a href="#/admin-login">Administrator login</a></p>`:""}
  </div><p class="muted small" style="text-align:center;margin-top:15px">BEL Machilipatnam · Item Storage Unit</p></div>`;
  const refresh=async()=>{document.getElementById("captchaSlot").innerHTML=await loadCaptcha();wireRefresh();};
  function wireRefresh(){document.getElementById("refreshCaptcha")?.addEventListener("click",refresh);}
  wireRefresh();
  document.getElementById("authForm").addEventListener("submit",async e=>{
    e.preventDefault();const f=new FormData(e.currentTarget);const error=document.getElementById("formError");error.classList.add("hide");
    if(signup&&f.get("password")!==f.get("confirmPassword")){error.textContent="Passwords do not match.";error.classList.remove("hide");return;}
    const button=e.currentTarget.querySelector("button[type=submit]");button.disabled=true;button.textContent="Please wait…";
    try{
      const data=await api(signup?"/api/signup":"/api/login",{method:"POST",body:JSON.stringify({username:f.get("username"),password:f.get("password"),confirmPassword:f.get("confirmPassword"),captchaAnswer:f.get("captchaAnswer"),captchaToken:f.get("captchaToken")})});
      if(signup){notify(data.message||"Account created successfully");go("login");return;}
      currentUser=data.user;setHeader();
      if(admin&&currentUser.role!=="admin"){await logout();throw new Error("Administrator credentials required.");}
      if(!admin&&currentUser.role==="admin"){go("admin");}else if(currentUser.role==="admin"){go("admin");}else{go("inventory");}
      if(data.welcome)welcomePopup(data.welcome);
    }catch(err){error.textContent=err.message;error.classList.remove("hide");button.disabled=false;button.textContent=signup?"Create Account":"Sign In";try{document.getElementById("captchaSlot").innerHTML=await loadCaptcha();wireRefresh();}catch{}}
  });
}
async function inventoryPage(){
  const {items}=await api("/api/inventory");const totalQty=items.reduce((s,i)=>s+i.quantity,0);const value=items.reduce((s,i)=>s+i.item_price*i.quantity,0);
  const rows=items.map(i=>`<tr><td class="mono">${esc(i.part_number)}</td><td><strong>${esc(i.item_name)}</strong></td><td class="right">${money(i.item_price)}</td><td class="right"><div class="qty-control"><button data-adjust="${i.id}" data-dir="remove" data-qty="1" title="Remove one">−</button><strong>${fmt(i.quantity)}</strong><button data-adjust="${i.id}" data-dir="add" data-qty="1" title="Add one">+</button></div></td><td class="right">${money(i.item_price*i.quantity)}</td><td>${date(i.created_at)}</td><td><button class="btn btn-danger btn-sm" data-delete="${i.id}">Delete</button></td></tr>`).join("");
  app.innerHTML=userShell(`${pageHead("My Inventory","Only your items are shown here.",`<a class="btn" href="#/new-item">＋ Add Item</a>`)}<div class="stats three">${stat("Total Items",fmt(items.length))}${stat("Total Quantity",fmt(totalQty))}${stat("Inventory Value",money(value))}</div>${table(["Part Number","Item Name",'<span class="right">Price</span>','<span class="right">Qty</span>','<span class="right">Total</span>',"Added On",""],rows,"No items yet. Add your first item to get started.")}`);
  app.querySelectorAll("[data-adjust]").forEach(b=>b.onclick=async()=>{const id=b.dataset.adjust;const dir=b.dataset.dir;try{await api(`/api/items/${id}/adjust`,{method:"POST",body:JSON.stringify({direction:dir,quantity:1})});notify(dir==="add"?"Stock added":"Stock removed");inventoryPage();}catch(e){notify(e.message,true);}});
  app.querySelectorAll("[data-delete]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this item?"))return;try{await api(`/api/items/${b.dataset.delete}`,{method:"DELETE"});notify("Item deleted");inventoryPage();}catch(e){notify(e.message,true);}});
}
function newItemPage(){
  app.innerHTML=userShell(`${pageHead("Add New Item","Enter the item details to add it to your inventory.")}<div class="card card-pad" style="max-width:650px"><form id="itemForm" class="form-grid">
  <div class="field span-2"><label>Part Number</label><input class="input mono" name="part_number" maxlength="10" inputmode="numeric" pattern="[0-9]{10}" placeholder="Enter 10-digit part number" required></div>
  <div class="field span-2"><label>Item Name</label><input class="input" name="item_name" placeholder="Enter item name" required></div>
  <div class="field"><label>Item Price (₹)</label><input class="input" type="number" name="item_price" min="0" step="0.01" placeholder="0.00" required></div>
  <div class="field"><label>Quantity</label><input class="input" type="number" name="quantity" min="0" step="1" placeholder="0" required></div>
  <div class="span-2" style="display:flex;gap:9px;padding-top:5px"><button class="btn" type="submit">Submit</button><a class="btn btn-outline" href="#/inventory">Cancel</a></div></form></div>`);
  document.querySelector('[name="part_number"]').addEventListener("input",e=>e.target.value=e.target.value.replace(/\D/g,"").slice(0,10));
  document.getElementById("itemForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const payload=Object.fromEntries(f);try{await api("/api/items",{method:"POST",body:JSON.stringify(payload)});notify("Item added successfully");go("inventory");}catch(err){notify(err.message,true);}};
}
async function userTransactions(){
 const {transactions}=await api("/api/transactions");
 const rows=transactions.map(t=>`<tr><td>${date(t.created_at)}</td><td><span class="badge ${t.action==="Removed"||t.action==="Deleted"?"red":"green"}">${esc(t.action)}</span></td><td>${esc(t.item_name)}</td><td class="mono">${esc(t.part_number)}</td><td class="right">${fmt(t.quantity)}</td><td class="right"><strong>${fmt(t.net_quantity)}</strong></td></tr>`).join("");
 app.innerHTML=userShell(`${pageHead("Transaction History","Your inventory stock additions and removals.")}<div class="toolbar"><input id="myTxSearch" class="input search" placeholder="Search item or part number…"></div><div id="myTxTable">${table(["Date & Time","Action","Item","Part Number",'<span class="right">Quantity</span>','<span class="right">Net Qty</span>'],rows,"No transactions recorded yet.")}</div>`);
 document.getElementById("myTxSearch").oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll("#myTxTable tbody tr").forEach(tr=>tr.classList.toggle("hide",!tr.textContent.toLowerCase().includes(q)));};
}
async function adminDashboard(){
 const d=await api("/api/admin/overview");const s=d.stats;
 const recent=d.recentItems.map(i=>`<tr><td><strong>${esc(i.item_name)}</strong><div class="muted small mono">${esc(i.part_number)}</div></td><td>@${esc(i.username)}</td><td class="right">${fmt(i.quantity)}</td><td>${date(i.created_at)}</td></tr>`).join("");
 const tx=d.recentTransactions.map(t=>`<tr><td>@${esc(t.username)}</td><td><span class="badge ${t.action==="Removed"?"red":"green"}">${esc(t.action)}</span></td><td>${esc(t.item_name)}</td><td class="right">${fmt(t.quantity)}</td><td class="right">${fmt(t.net_quantity)}</td></tr>`).join("");
 app.innerHTML=shell(adminNav("admin"),`${pageHead("Admin Dashboard","System overview and recent activity.")}<div class="stats">${stat("Total Users",fmt(s.users))}${stat("Total Items",fmt(s.items))}${stat("Active (7d)",fmt(s.activeUsers))}${stat("Total Quantity",fmt(s.totalQty))}</div><div class="content-grid"><div class="card card-pad"><h2 class="card-title">Recently Added Items</h2>${table(["Item","Owner",'<span class="right">Net Qty</span>',"Added On"],recent,"No items yet.")}</div><div class="card card-pad"><h2 class="card-title">Recent Transactions</h2>${table(["User","Action","Item",'<span class="right">Qty</span>','<span class="right">Net Qty</span>'],tx,"No transactions yet.")}</div></div>`);
}
async function adminItems(){
 const {items}=await api("/api/admin/items");const rows=items.map(i=>`<tr><td class="mono">${esc(i.part_number)}</td><td><strong>${esc(i.item_name)}</strong></td><td>@${esc(i.username)}</td><td class="right">${money(i.item_price)}</td><td class="right"><strong>${fmt(i.quantity)}</strong></td><td class="right">${money(i.item_price*i.quantity)}</td><td>${date(i.created_at)}</td></tr>`).join("");
 app.innerHTML=shell(adminNav("admin/items"),`${pageHead("All Items","Complete inventory across every user.")}<div class="stats three">${stat("Total Items",fmt(items.length))}${stat("Total Net Quantity",fmt(items.reduce((s,i)=>s+i.quantity,0)))}${stat("Inventory Value",money(items.reduce((s,i)=>s+i.item_price*i.quantity,0)))}</div><div class="toolbar"><input id="itemSearch" class="input search" placeholder="Search item, part number, or user…"></div><div id="itemsTable">${table(["Part Number","Item Name","Owner",'<span class="right">Price</span>','<span class="right">Net Qty</span>','<span class="right">Total</span>',"Added On"],rows)}</div>`);
 document.getElementById("itemSearch").oninput=e=>{const q=e.target.value.toLowerCase();const filtered=items.filter(i=>[i.part_number,i.item_name,i.username].some(v=>String(v).toLowerCase().includes(q)));document.getElementById("itemsTable").innerHTML=table(["Part Number","Item Name","Owner",'<span class="right">Price</span>','<span class="right">Net Qty</span>','<span class="right">Total</span>',"Added On"],filtered.map(i=>`<tr><td class="mono">${esc(i.part_number)}</td><td>${esc(i.item_name)}</td><td>@${esc(i.username)}</td><td class="right">${money(i.item_price)}</td><td class="right">${fmt(i.quantity)}</td><td class="right">${money(i.item_price*i.quantity)}</td><td>${date(i.created_at)}</td></tr>`).join(""));};
}
async function adminUsers(){
 const {users}=await api("/api/admin/users");const rows=users.filter(u=>u.role!=="admin").map(u=>`<tr><td><strong>@${esc(u.username)}</strong></td><td><span class="badge">User</span></td><td><span class="badge ${u.blocked?"red":"green"}">${u.blocked?"Blocked":"Active"}</span></td><td class="right">${fmt(u.itemCount)}</td><td>${date(u.created_at)}</td><td><button class="btn btn-outline btn-sm" data-view="${u.id}">View Items</button> <button class="btn btn-outline btn-sm" data-block="${u.id}">${u.blocked?"Unblock":"Block"}</button> <button class="btn btn-danger btn-sm" data-remove="${u.id}">Remove</button></td></tr>`).join("");
 app.innerHTML=shell(adminNav("admin/users"),`${pageHead("User Management","View, search, block, or remove users.")}<div class="toolbar"><input class="input search" id="userSearch" placeholder="Search username…"></div><div id="usersTable">${table(["Username","Role","Status",'<span class="right">Items</span>',"Joined","Actions"],rows,"No users registered yet.")}</div><div id="userItems" class="card card-pad hide" style="margin-top:15px"></div>`);
 document.getElementById("userSearch").oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll("#usersTable tbody tr").forEach(tr=>tr.classList.toggle("hide",!tr.textContent.toLowerCase().includes(q)));};
 app.querySelectorAll("[data-remove]").forEach(b=>b.onclick=async()=>{const u=users.find(x=>x.id===Number(b.dataset.remove));if(!confirm(`Remove user @${u.username} and their inventory? This cannot be undone.`))return;try{await api(`/api/admin/users/${u.id}`,{method:"DELETE"});notify("User removed");adminUsers();}catch(e){notify(e.message,true);}});
 app.querySelectorAll("[data-block]").forEach(b=>b.onclick=async()=>{try{await api(`/api/admin/users/${b.dataset.block}/block`,{method:"PATCH",body:"{}"});notify("User status updated");adminUsers();}catch(e){notify(e.message,true);}});
 app.querySelectorAll("[data-view]").forEach(b=>b.onclick=async()=>{try{const d=await api(`/api/admin/user-items/${b.dataset.view}`);const u=users.find(x=>x.id===Number(b.dataset.view));const box=document.getElementById("userItems");box.classList.remove("hide");box.innerHTML=`<h2 class="card-title">Items belonging to @${esc(u.username)}</h2>${table(["Part Number","Item Name","Quantity"],d.items.map(i=>`<tr><td class="mono">${esc(i.part_number)}</td><td>${esc(i.item_name)}</td><td>${fmt(i.quantity)}</td></tr>`).join(""),"No items for this user.")}`;}catch(e){notify(e.message,true);}});
}
async function adminTransactions(active){
 const {transactions}=await api("/api/admin/transactions");const rows=transactions.map(t=>`<tr><td>${date(t.created_at)}</td><td>@${esc(t.username)}</td><td><span class="badge ${t.action==="Removed"||t.action==="Deleted"?"red":"green"}">${esc(t.action)}</span></td><td>${esc(t.item_name)}</td><td class="mono">${esc(t.part_number)}</td><td class="right">${fmt(t.quantity)}</td><td class="right"><strong>${fmt(t.net_quantity)}</strong></td></tr>`).join("");
 app.innerHTML=shell(adminNav(active),`${pageHead("Transaction History","All inventory stock transactions across users.")}<div class="toolbar"><input id="txSearch" class="input search" placeholder="Search user, item, or part number…"></div><div id="txTable">${table(["Date & Time","User","Action","Item","Part Number",'<span class="right">Quantity</span>','<span class="right">Net Qty</span>'],rows,"No transactions recorded yet.")}</div>`);
 document.getElementById("txSearch").oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll("#txTable tbody tr").forEach(tr=>tr.classList.toggle("hide",!tr.textContent.toLowerCase().includes(q)));};
}
async function adminActivity(){
 const {activities}=await api("/api/admin/activity");
 const rows=activities.map(a=>`<tr><td>@${esc(a.username)}</td><td><span class="badge gray">${esc(a.action.replaceAll("_"," "))}</span></td><td>${esc(a.item_name||"—")}</td><td class="mono">${esc(a.part_number||"—")}</td><td class="right">${a.quantity==null?"—":fmt(a.quantity)}</td><td class="right">${a.net_quantity==null?"—":fmt(a.net_quantity)}</td><td>${date(a.created_at)}</td></tr>`).join("");
 app.innerHTML=shell(adminNav("admin/activity"),`${pageHead("Activity Logs","Audit trail of inventory actions performed by users.")}<div class="toolbar"><input id="activitySearch" class="input search" placeholder="Search user, item, or part number…"></div><div id="activityTable">${table(["User","Activity","Item","Part Number",'<span class="right">Quantity</span>','<span class="right">Net Qty</span>',"Date & Time"],rows,"No activity recorded yet.")}</div>`);
 document.getElementById("activitySearch").oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll("#activityTable tbody tr").forEach(tr=>tr.classList.toggle("hide",!tr.textContent.toLowerCase().includes(q)));};
}
async function adminSecurity(){
 const d=await api("/api/admin/security");const auth=d.authLogs;const actions=d.adminActions;
 const authRows=auth.map(l=>`<tr><td><span class="badge ${l.event.includes("failed")||l.event.includes("blocked")?"red":"gray"}">${esc(l.event.replaceAll("_"," "))}</span></td><td>@${esc(l.username||"—")}</td><td>${esc(l.details||"—")}</td><td>${date(l.created_at)}</td></tr>`).join("");
 const actionRows=actions.map(a=>`<tr><td>@${esc(a.admin_username)}</td><td>${esc(a.action.replaceAll("_"," "))}</td><td>${esc(a.target_label||"—")}</td><td>${date(a.created_at)}</td></tr>`).join("");
 app.innerHTML=shell(adminNav("admin/security"),`${pageHead("Security & Audit","Authentication events, administrator actions and security records.")}<div class="stats three">${stat("Auth Events",fmt(auth.length))}${stat("Admin Actions",fmt(actions.length))}${stat("Failed Logins",fmt(auth.filter(l=>l.event==="login_failed"||l.event==="blocked_attempt").length))}</div><div class="tabs"><button class="tab active" data-tab="auth">Auth Logs</button><button class="tab" data-tab="admin">Admin Actions</button></div><div id="securityTable">${table(["Event","User","Details","When"],authRows,"No authentication events yet.")}</div>`);
 app.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{app.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===b));document.getElementById("securityTable").innerHTML=b.dataset.tab==="auth"?table(["Event","User","Details","When"],authRows,"No authentication events yet."):table(["Admin","Action","Target","When"],actionRows,"No administrator actions yet.");});
}
async function render(){
 const r=route();
 setHeader();
 if(!currentUser){if(r==="")return landingPage();if(r==="signup")return authPage(true);if(r==="admin-login")return authPage(false,true);if(r==="login")return authPage(false);go("");return;}
 try{
   if(currentUser.role==="admin"){
     if(r==="admin"||r==="")return await adminDashboard();
     if(r==="admin/items")return await adminItems();
     if(r==="admin/users")return await adminUsers();
     if(r==="admin/transactions")return await adminTransactions("admin/transactions");
     if(r==="admin/activity")return await adminActivity();
     if(r==="admin/security")return await adminSecurity();
     if(r==="inventory")return await inventoryPage();
     if(r==="new-item")return newItemPage();
     go("admin");return;
   }
   if(r==="inventory"||r==="")return await inventoryPage();
   if(r==="new-item")return newItemPage();
   if(r==="history")return await userTransactions();
   if(r==="admin"||r.startsWith("admin/")){notify("Administrator access required.",true);go("inventory");return;}
   go("inventory");
 }catch(e){if(e.message.includes("log in")){currentUser=null;setHeader();go("login");}else{app.innerHTML=`<div class="card card-pad"><h2>Unable to load this page</h2><p class="muted">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Try again</button></div>`;}}
}
async function init(){
 try{const d=await api("/api/me");currentUser=d.user;}catch{currentUser=null;}
 setHeader();window.addEventListener("hashchange",render);render();
}
init();
