// ui.js
import { loginWithGoogle, logout, watchAuth } from './auth.js';
import { seedTemplatesIfMissing, createCourse, createAnalyzeAndDesignTasks, createNarrativeSectionTasks, injectMediaChain, updateTaskStatus, extendTask, auth, db, listUsers, updateUserRoles, createInvite, listInvites, deleteInvite, createSampleCourseSeed } from './db.js?v=5';
import { collection, getDocs, query, doc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const app = document.getElementById('app');

function iconDart(){
  return `<span class="logo" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2l2.5 2.5L12 7l-2.5-2.5L12 2zm8 8l2 2-8 8-2-2 8-8zM4 12l6 6-2 2-6-6 2-2z"/></svg></span>`;
}

function header(user){
  return `
  <div class="header container" role="banner">
    <div class="brand" aria-label="DART — Design and Development Accountability and Responsibility Tracker">
      ${iconDart()}
      <div class="brand-text">
        <div class="brand-title"><abbr title="Design and Development Accountability and Responsibility Tracker">DART</abbr></div>
        <div class="brand-sub">Design & Development Accountability & Responsibility Tracker</div>
      </div>
    </div>
    <div class="topnav">
      <div class="search" role="search"><input aria-label="Search" placeholder="Search (coming soon)" style="background:transparent;border:0;color:inherit;width:100%"></div>
      ${user? `<button class="btn ghost" id="btn-logout">Sign out</button>` : ""}
    </div>
  </div>`;
}

function loginView(){
  app.innerHTML = `
    ${header(null)}
    <div class="container vstack">
      <div class="card vstack" style="max-width:520px;margin:24px auto">
        <h1 style="margin:0">Welcome to DART</h1>
        <p class="small">Design & Development Accountability & Responsibility Tracker</p>
        <button class="btn primary" id="btn-google">Continue with Google</button>
        <p class="small">Your PC will assign roles after you sign in the first time.</p>
      </div>
      <div class="footer container">© ${new Date().getFullYear()} DART</div>
    </div>
  `;
  document.getElementById('btn-google').onclick = loginWithGoogle;
}

function pcDashboard(user){
  app.innerHTML = `
    ${header(user)}
    <div class="container vstack">
      <div class="card vstack">
        <div class="cardline">
          <h2 style="margin:0">Portfolio</h2><span class="badge">PC</span>
          <div class="hstack">
            <button class="btn" id="btn-seed">Seed Templates</button>
            <button class="btn" id="btn-sample">Add Sample Course</button>
            <button class="btn" id="btn-roles">Role Manager</button>
            <button class="btn primary" id="btn-new-course">New Course</button>
          </div>
        </div>
        <div class="toolbar" role="toolbar" aria-label="Filters">
          <button class="chip" aria-pressed="true">All</button>
          <button class="chip">Analyze</button>
          <button class="chip">Design</button>
          <button class="chip">Develop</button>
          <button class="chip">Implement</button>
        </div>
        <div class="grid cards" id="course-grid"></div>
      </div>
      <div class="footer container">Signed in as <b>${user.profile.displayName || user.email}</b></div>
    </div>
    <div class="modal" id="modal"></div>
  `;
  document.getElementById('btn-logout').onclick = logout;
  document.getElementById('btn-seed').onclick = async ()=>{
    await seedTemplatesIfMissing();
    alert('Templates seeded/verified.');
  };
  document.getElementById('btn-new-course').onclick = () => openCourseWizard();
  document.getElementById('btn-roles').onclick = () => openRoleManager();
  document.getElementById('btn-sample').onclick = () => seedSample();
  renderCourses();
}

async function renderCourses(){
  const grid = document.getElementById('course-grid');
  const snap = await getDocs(query(collection(db,'courses')));
  grid.innerHTML = '';
  snap.forEach(d=>{
    const c = d.data(); c.id = d.id;
    grid.innerHTML += `
      <div class="card vstack">
        <div class="cardline">
          <div>
            <div style="font-weight:700">${c.code || ''}</div>
            <div class="small">${c.title || ''}</div>
          </div>
          <div class="chip">${(c.phase||'analyze').toUpperCase()}</div>
        </div>
        <div class="hstack">
          <button class="btn" data-open-course="${c.id}">Open</button>
          <button class="btn ghost" data-delete-course="${c.id}">Remove</button>
        </div>
      </div>
    `;
  });
  grid.querySelectorAll('[data-open-course]').forEach(b=>{
    b.onclick = () => openCourse(b.getAttribute('data-open-course'));
  });
  grid.querySelectorAll('[data-delete-course]').forEach(b=>{
    b.onclick = async ()=>{
      if(!confirm('Delete this course? This cannot be undone.')) return;
      const id = b.getAttribute('data-delete-course');
      const tasksSnap = await getDocs(collection(db,'courses',id,'tasks'));
      for(const d of tasksSnap.docs){ await deleteDoc(d.ref); }
      await deleteDoc(doc(db,'courses',id));
      toast('Course deleted.');
      renderCourses();
    };
  });
}

function openCourseWizard(){
  const modal = document.getElementById('modal');
  modal.classList.add('open');
  modal.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="New Course">
      <header><b>Create Course</b><button class="btn ghost" id="close">Close</button></header>
      <section class="vstack">
        <label>Course Code <input id="ccode"></label>
        <label>Course Title <input id="ctitle"></label>
        <label>Assign Learning Designer UID <input id="ld"></label>
        <label>Assign SME UID <input id="sme"></label>
        <div class="hstack"><button class="btn primary" id="create">Create</button></div>
        <p class="small">Tip: After creation, open course → run “Analyze & Design” tasks, then build sections and media.</p>
      </section>
    </div>
  `;
  document.getElementById('close').onclick = ()=> modal.classList.remove('open');
  document.getElementById('create').onclick = async ()=>{
    const courseId = await createCourse({
      code: document.getElementById('ccode').value,
      title: document.getElementById('ctitle').value,
      ldUid: document.getElementById('ld').value || null,
      smeUid: document.getElementById('sme').value || null
    });
    await createAnalyzeAndDesignTasks(courseId);
    modal.classList.remove('open');
    renderCourses();
    openCourse(courseId);
  };
}

async function openCourse(courseId){
  const tasksSnap = await getDocs(query(collection(db,'courses',courseId,'tasks')));
  const tasks = []; tasksSnap.forEach(d=>tasks.push(d.data()));
  const course = (await getDoc(doc(db,'courses',courseId))).data();

  app.innerHTML = `
    ${header({profile: {displayName:''}})}
    <div class="container vstack">
      <div class="card vstack">
        <div class="cardline">
          <div><h2 style="margin:0">${course.code} — ${course.title}</h2></div>
          <div class="hstack">
            <button class="btn" id="btn-sections">Build Modules & Sections</button>
            <button class="btn" id="btn-media">Add Media Workflows</button>
            <button class="btn ghost" id="btn-back">Back</button>
          </div>
        </div>

        <div class="section-title">Kanban Overview</div>
        <div class="kboard" id="kboard"></div>

        <div class="section-title">Tasks (All)</div>
        <div id="tasklist" class="vstack"></div>
      </div>
    </div>
    <div class="modal" id="modal"></div>
  `;
  document.getElementById('btn-back').onclick = () => pcDashboard({profile:{displayName:''}});
  document.getElementById('btn-sections').onclick = ()=> openSectionsWizard(courseId);
  document.getElementById('btn-media').onclick = ()=> openMediaWizard(courseId);
  document.getElementById('btn-logout').onclick = logout;
  renderKanban(tasks);
  renderTaskList(courseId, tasks);
}

function renderKanban(tasks){
  const cols = [
    {key:'analyze', name:'Analyze'},
    {key:'design', name:'Design'},
    {key:'develop', name:'Develop'},
    {key:'implement', name:'Implement'},
  ];
  const kb = document.getElementById('kboard');
  kb.innerHTML='';
  cols.forEach(c=>{
    const columnCards = tasks.filter(t=>t.phase===c.key).map(t=>`
      <div class="card">
        <div class="hstack"><span class="dot ${t.status}"></span><b>${t.title}</b></div>
        <div class="small">${t.role.toUpperCase()} • Target ${t.targetDays}d</div>
      </div>
    `).join('');
    kb.innerHTML += `
      <div class="kcol">
        <h4>${c.name}</h4>
        <div class="count">${tasks.filter(t=>t.phase===c.key).length} tasks</div>
        <div>${columnCards}</div>
      </div>`;
  });
}

function taskCard(t, courseId){
  const color = t.status==='green'?'green': t.status==='yellow'?'yellow':'red';
  const due = t.dueDate ? new Date(t.dueDate.seconds*1000).toLocaleDateString() : '—';
  return `
    <div class="task vstack" data-task="${t.id}">
      <div class="cardline">
        <div class="hstack">
          <span class="dot ${color}" aria-label="status"></span>
          <div class="title">${t.title}</div>
        </div>
        <div class="small">${t.role.toUpperCase()}</div>
      </div>
      <div class="meta">
        <span>Due: <b>${due}</b></span>
        <span>Target: ${t.targetDays}d</span>
        <span>Lane: ${t.lane}</span>
      </div>
      <div class="actions">
        <button class="chip" data-status="red">Red</button>
        <button class="chip" data-status="yellow">Yellow</button>
        <button class="chip" data-status="green">Green</button>
        <button class="chip" data-extend>Need more time</button>
      </div>
    </div>
  `;
}

function renderTaskList(courseId, tasks){
  const list = document.getElementById('tasklist');
  list.innerHTML = tasks.map(t => taskCard(t, courseId)).join('');
  list.querySelectorAll('.task').forEach(el=>{
    const id = el.getAttribute('data-task');
    const t = tasks.find(k=>k.id===id);
    el.querySelectorAll('[data-status]').forEach(btn=>{
      btn.onclick = async ()=>{
        await updateTaskStatus(courseId, t, btn.getAttribute('data-status'));
        openCourse(courseId);
      };
    });
    el.querySelector('[data-extend]').onclick = ()=> openExtendModal(courseId, t);
  });
}

function openExtendModal(courseId, t){
  const modal = document.getElementById('modal');
  modal.classList.add('open');
  modal.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Request more time">
      <header><b>Need more time</b><button class="btn ghost" id="close">Close</button></header>
      <section class="vstack">
        <label>Extra days
          <select id="days">
            <option value="1">+1 day</option>
            <option value="2">+2 days</option>
            <option value="3">+3 days</option>
            <option value="5">+5 days</option>
            <option value="7">+7 days</option>
          </select>
        </label>
        <label>Reason (required)
          <select id="reason">
            <option>Awaiting SME input or approval</option>
            <option>Missing or incomplete source content</option>
            <option>Blocked by dependency task</option>
            <option>Scope change or new requirements</option>
            <option>Asset creation delays</option>
            <option>Technical issue or system downtime</option>
            <option>Team member unavailable</option>
            <option>Meeting/feedback scheduling conflicts</option>
            <option>Other</option>
          </select>
        </label>
        <label>Details (optional) <textarea id="note" rows="3" placeholder="Add short context…"></textarea></label>
        <div class="hstack"><button class="btn primary" id="save">Save</button></div>
      </section>
    </div>`;
  document.getElementById('close').onclick = ()=> modal.classList.remove('open');
  document.getElementById('save').onclick = async ()=>{
    const days = parseInt(document.getElementById('days').value,10);
    const reason = document.getElementById('reason').value;
    const note = document.getElementById('note').value;
    await extendTask(courseId, t, days, `${reason}${note?': '+note:''}`);
    modal.classList.remove('open');
    openCourse(courseId);
  };
}

function openMediaWizard(courseId){
  const modal = document.getElementById('modal');
  modal.classList.add('open');
  modal.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Add media workflows">
      <header><b>Add Media Workflows</b><button class="btn ghost" id="close">Close</button></header>
      <section class="vstack">
        <label><input type="checkbox" id="vid"> Video (creates full chain)</label>
        <label><input type="checkbox" id="slides"> Interactive Slides</label>
        <label><input type="checkbox" id="infog"> Infographic</label>
        <label><input type="checkbox" id="handout"> Handout</label>
        <label>Optional label (e.g., "Lecture 1") <input id="label"></label>
        <div class="hstack"><button class="btn primary" id="apply">Insert</button></div>
      </section>
    </div>`;
  document.getElementById('close').onclick = ()=> modal.classList.remove('open');
  document.getElementById('apply').onclick = async ()=>{
    const label = document.getElementById('label').value;
    if(document.getElementById('vid').checked) await injectMediaChain(courseId, 'video', label);
    if(document.getElementById('slides').checked) await injectMediaChain(courseId, 'slides', label);
    if(document.getElementById('infog').checked) await injectMediaChain(courseId, 'infographic', label);
    if(document.getElementById('handout').checked) await injectMediaChain(courseId, 'handout', label);
    modal.classList.remove('open');
    openCourse(courseId);
  };
}

function openSectionsWizard(courseId){
  const modal = document.getElementById('modal');
  modal.classList.add('open');
  modal.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Modules & Sections">
      <header><b>Modules & Sections</b><button class="btn ghost" id="close">Close</button></header>
      <section class="vstack" id="wizard">
        <div class="vstack card">
          <div class="hstack">
            <label style="flex:1"># of Modules <input type="number" id="mods" min="1" value="5"></label>
            <label style="flex:1">Sections per Module (default) <input type="number" id="spm" min="1" value="6"></label>
          </div>
          <div class="hstack"><button class="btn" id="gen">Generate</button></div>
        </div>
        <div id="table"></div>
        <div class="hstack">
          <button class="btn primary" id="save">Create Section Tasks</button>
        </div>
        <p class="small">System targets 90 hours @ 3h per section ⇒ ~30 sections. It will prompt if short/over.</p>
      </section>
    </div>
  `;
  const mod = document.getElementById('mods');
  const spm = document.getElementById('spm');
  const table = document.getElementById('table');
  const model = [];
  function renderTable(){
    let total=0;
    let html = '<div class="vstack card"><div class="grid" style="grid-template-columns:repeat(3,1fr);gap:8px">';
    for(let i=1;i<=parseInt(mod.value,10);i++){
      const idx = i-1;
      if(!model[idx]) model[idx] = {module:i, sections: parseInt(spm.value,10)};
      total += model[idx].sections;
      html += `
        <label>Module ${i} — Sections
          <input type="number" min="1" value="${model[idx].sections}" data-idx="${idx}">
        </label>`;
    }
    html += '</div><div class="small">Total sections: <b>'+total+'</b> / Target ~30</div></div>';
    table.innerHTML = html;
    table.querySelectorAll('input[type="number"]').forEach(inp=>{
      inp.oninput = ()=>{
        const idx = parseInt(inp.getAttribute('data-idx'),10);
        model[idx].sections = Math.max(1, parseInt(inp.value,10)||1);
        renderTable();
      };
    });
  }
  document.getElementById('gen').onclick = renderTable;
  document.getElementById('close').onclick = ()=> modal.classList.remove('open');
  document.getElementById('save').onclick = async ()=>{
    const map = model.filter(Boolean);
    if(map.length===0){ alert('Click Generate first.'); return; }
    await createNarrativeSectionTasks(courseId, map);
    modal.classList.remove('open');
    openCourse(courseId);
  };
}

async function seedSample(){
  
  const id = await createSampleCourseSeed();
  alert('Sample course created.');
  renderCourses();
  openCourse(id);
}

async function openRoleManager(){
  const modal = document.getElementById('modal');
  modal.classList.add('open');
  
  const users = await listUsers();
  const invites = await listInvites();

  function rolesRow(r){
    return `<div class="role-grid">
      ${['pc','ld','sme','md','chair','dean'].map(k => `
        <label><input type="checkbox" data-role="${k}" ${r && r[k]?'checked':''}> ${k.toUpperCase()}</label>
      `).join('')}
    </div>`;
  }

  modal.innerHTML = `
  <div class="sheet" role="dialog" aria-modal="true" aria-label="Role Manager">
    <header><b>Role Manager</b><button class="btn ghost" id="close">Close</button></header>
    <section class="vstack">
      <div class="card vstack">
        <h3 style="margin:0">Invite by Email</h3>
        <div class="hstack" style="gap:8px;flex-wrap:wrap">
          <input id="invite-email" placeholder="name@school.edu" style="max-width:320px">
          <span class="small">Assign roles:</span>
        </div>
        ${rolesRow({pc:false,ld:false,sme:false,md:false,chair:false,dean:false})}
        <div class="hstack"><button class="btn primary" id="send-invite">Create Invite</button></div>
        <p class="small">They’ll receive instructions to open the DART link and sign in with Google using this email. Roles apply automatically.</p>
      </div>

      <div class="card vstack">
        <h3 style="margin:0">Pending Invites</h3>
        <div id="inv-list">${invites.filter(i=>i.status==='pending').map(i=>`
          <div class="cardline">
            <div>${i.email} <span class="small">(${Object.keys(i.roles||{}).filter(k=>i.roles[k]).map(k=>k.toUpperCase()).join(', ')||'No roles'})</span></div>
            <div class="hstack">
              <button class="chip" data-copy="${i.email}">Copy email</button>
              <button class="chip" data-mailto="${i.email}">Send email…</button>
              <button class="chip" data-revoke="${i.id}">Revoke</button>
            </div>
          </div>
        `).join('')}
        </div>
      </div>

      <div class="card vstack">
        <h3 style="margin:0">Existing Users</h3>
        <table class="table">
          <thead><tr><th>Email</th><th>Display</th><th>Roles</th><th></th></tr></thead>
          <tbody id="user-rows">
            ${users.map(u=>`
              <tr>
                <td>${u.email||''}</td>
                <td>${u.displayName||''}</td>
                <td>${rolesRow(u.roles||{})}</td>
                <td><button class="btn" data-save="${u.id}">Save</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  </div>`;

  document.getElementById('close').onclick = ()=> modal.classList.remove('open');

  modal.querySelectorAll('[data-save]').forEach(btn=>{
    btn.onclick = async ()=>{
      const tr = btn.closest('tr');
      const roles = {};
      tr.querySelectorAll('input[type="checkbox"][data-role]').forEach(cb=> roles[cb.getAttribute('data-role')] = cb.checked );
      await updateUserRoles(btn.getAttribute('data-save'), roles);
      toast('Roles updated.');
    };
  });

  document.getElementById('send-invite').onclick = async ()=>{
    const email = document.getElementById('invite-email').value.trim();
    if(!email){ alert('Enter an email'); return; }
    const grid = modal.querySelector('.role-grid');
    const roles = {}; grid.querySelectorAll('input[data-role]').forEach(cb=> roles[cb.getAttribute('data-role')] = cb.checked );
    await createInvite(email, roles, 'pc');
    toast('Invite created. Send them an email with your DART link.');
    openRoleManager();
  };

  modal.querySelectorAll('[data-copy]').forEach(btn=>{
    btn.onclick = ()=> { navigator.clipboard.writeText(btn.getAttribute('data-copy')); toast('Email copied'); };
  });
  modal.querySelectorAll('[data-mailto]').forEach(btn=>{
    btn.onclick = ()=> {
      const email = btn.getAttribute('data-mailto');
      const subj = encodeURIComponent('You are invited to DART');
      const body = encodeURIComponent('Hi!\n\nYou have been invited to DART (Design & Development Accountability & Responsibility Tracker).\n\n1) Open: '+location.href.split('#')[0]+'\n2) Click "Continue with Google" using this email: '+email+'\n3) You will see your assigned roles and tasks.\n\nThanks!');
      location.href = 'mailto:'+email+'?subject='+subj+'&body='+body;
    };
  });
  modal.querySelectorAll('[data-revoke]').forEach(btn=>{
    btn.onclick = async ()=>{ await deleteInvite(btn.getAttribute('data-revoke')); toast('Invite revoked'); openRoleManager(); };
  });
}

function toast(msg){
  let t = document.getElementById('toast');
  if(!t){ t = document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t);}
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=> t.classList.remove('show'), 1800);
}

export function mountApp(){
  watchAuth(user=>{
    if(!user){ loginView(); return; }
    const roles = user.profile?.roles || {};
    if(roles.pc){ pcDashboard(user); }
    else { pcDashboard(user); } // MVP: reuse PC view for all roles
  });
}
