// db.js
import { initFirebase } from './firebase.js';
import { DEFAULT_TEMPLATES } from './templates.js';

const { auth, db } = initFirebase();
export { auth, db };

import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, addDoc,
  query, where, getDocs, orderBy, writeBatch
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

export function addDays(date, days, business=false){
  let d = new Date(date);
  if(!business){
    d.setDate(d.getDate()+days);
    return d;
  }
  let added=0;
  while(added<days){
    d.setDate(d.getDate()+1);
    const isWeekend = d.getDay()===0 || d.getDay()===6;
    if(!isWeekend) added++;
  }
  return d;
}

export async function ensureUserDoc(user){
  const uref = doc(db, 'users', user.uid);
  const snap = await getDoc(uref);
  if(!snap.exists()){
    await setDoc(uref, {
      email: user.email || '',
      displayName: user.displayName || '',
      roles: { pc: false, ld: false, sme: false, md: false, chair: false, dean: false },
      status: 'pending',
      createdAt: serverTimestamp()
    });
  }
  const q = await getDocs(query(collection(db,'users'), where('roles.pc','==', true)));
  if(q.empty){
    await updateDoc(uref, { 'roles.pc': true, status: 'active' });
  }
}

export async function getUser(uid){
  const snap = await getDoc(doc(db,'users',uid));
  return snap.exists()? snap.data(): null;
}

export async function seedTemplatesIfMissing(){
  const tref = doc(db,'meta','templates_v1');
  const snap = await getDoc(tref);
  if(!snap.exists()){
    await setDoc(tref, { seededAt: serverTimestamp(), version: 1, data: DEFAULT_TEMPLATES });
  }
  return (await getDoc(tref)).data().data;
}

export async function createCourse(course){
  const ref = await addDoc(collection(db,'courses'), {
    ...course,
    createdAt: serverTimestamp(),
    phase: 'analyze'
  });
  return ref.id;
}

export async function createAnalyzeAndDesignTasks(courseId){
  const meta = await seedTemplatesIfMissing();
  const batch = writeBatch(db);
  const tasksCol = collection(db,'courses',courseId,'tasks');

  function addTask(t, idx, lane='phase', phase='analyze'){
    const id = doc(tasksCol).id;
    const docRef = doc(db,'courses',courseId,'tasks', id);
    const depends = (t.dependsOnIndex||[]).map(i => '$IDX$'+i);
    batch.set(docRef, {
      id, courseId, title: t.title, role: t.role, collaborators: t.collaborators||[],
      status: 'red', targetDays: t.targetDays||0, businessDays: !!t.businessDays,
      dueDate: null, dependencies: depends, lane, phase, createdAt: serverTimestamp()
    });
    return id;
  }

  const createdAnalyzeIds = [];
  meta.analyze.forEach((t,i)=> createdAnalyzeIds.push(addTask(t,i,'analyze','analyze')) );
  const createdDesignIds = [];
  meta.design.forEach((t,i)=> createdDesignIds.push(addTask(t,i,'design','design')) );

  await batch.commit();

  const allSnap = await getDocs(collection(db,'courses',courseId,'tasks'));
  const byIndexAnalyze = createdAnalyzeIds;
  const byIndexDesign = createdDesignIds;
  const updates = writeBatch(db);
  allSnap.forEach(d=>{
    let data = d.data();
    if(Array.isArray(data.dependencies)){
      let deps = data.dependencies.map(dep => {
        if(typeof dep === 'string' && dep.startsWith('$IDX$')){
          const idx = parseInt(dep.replace('$IDX$',''));
          if(data.lane==='analyze') return byIndexAnalyze[idx];
          if(data.lane==='design') return byIndexDesign[idx];
        }
        return dep;
      });
      updates.update(d.ref, { dependencies: deps });
    }
  });
  await updates.commit();
}

export async function createNarrativeSectionTasks(courseId, moduleMap){
  const tasksCol = collection(db,'courses',courseId,'tasks');
  const batch = writeBatch(db);
  moduleMap.forEach(row=>{
    const m = row.module;
    for(let s=1; s<=row.sections; s++){
      const base = `M${m}.S${s}`;

      function setTask(title, role, targetDays){
        const id = doc(tasksCol).id;
        batch.set(doc(db,'courses',courseId,'tasks', id), {
          id, courseId, title: `${title}: ${base}`, role,
          status:'red', targetDays, businessDays:false, dueDate:null,
          dependencies:[], lane:'narrative', phase:'develop', createdAt: serverTimestamp()
        });
        return id;
      }

      const t1 = setTask('Course Narrative', 'ld', 3);
      const t2 = setTask('SME Review', 'sme', 1);
      const t3 = setTask('Revise Narrative', 'ld', 1);
      const t5 = setTask('Publish in Canvas', 'ld', 1);

      // sequence
      batch.update(doc(db,'courses',courseId,'tasks', t2), { dependencies: [t1] });
      batch.update(doc(db,'courses',courseId,'tasks', t3), { dependencies: [t2] });
      batch.update(doc(db,'courses',courseId,'tasks', t5), { dependencies: [t3] });

      // graphics after narrative
      const gId = doc(tasksCol).id;
      batch.set(doc(db,'courses',courseId,'tasks', gId), {
        id: gId, courseId, title: `In-course Graphic Design: ${base}`, role:'md',
        status:'red', targetDays: 1, businessDays:false, dueDate:null,
        dependencies:[t1], lane:'graphics', phase:'develop', createdAt: serverTimestamp()
      });

      // QA by PC
      const qaId = doc(tasksCol).id;
      batch.set(doc(db,'courses',courseId,'tasks', qaId), {
        id: qaId, courseId, title: `QA – Canvas Narrative + Graphics: ${base}`, role:'pc',
        status:'red', targetDays: 2, businessDays:true, dueDate:null,
        dependencies:[gId], lane:'qa', phase:'develop', createdAt: serverTimestamp()
      });
    }
  });
  await batch.commit();
}

export async function injectMediaChain(courseId, type, label){
  const meta = await seedTemplatesIfMissing();
  const chain = meta.mediaChains[type];
  if(!chain) throw new Error('Unknown media type');
  const tasksCol = collection(db,'courses',courseId,'tasks');
  const batch = writeBatch(db);
  const created = [];
  chain.forEach((t,i)=>{
    const id = doc(tasksCol).id;
    created.push(id);
    const deps = (t.dependsOnIndex||[]).map(idx => '$IDX$'+idx);
    batch.set(doc(db,'courses',courseId,'tasks', id), {
      id, courseId, title: `${t.title}${label? ' — '+label:''}`, role:t.role,
      status:'red', targetDays:t.targetDays||0, variableDate: !!t.variableDate,
      businessDays: !!t.businessDays, dueDate:null, dependencies: deps,
      lane: type, phase: 'develop', createdAt: serverTimestamp()
    });
  });
  await batch.commit();

  const updates = writeBatch(db);
  created.forEach((id, i)=>{
    const deps = (chain[i].dependsOnIndex||[]).map(idx => created[idx]);
    updates.update(doc(db,'courses',courseId,'tasks', id), { dependencies: deps });
  });
  await updates.commit();
}


// Compute a due date when a task is started (Yellow)
export async function updateTaskStatus(courseId, task, status){
  const ref = doc(db, 'courses', courseId, 'tasks', task.id);
  const updates = { status };
  const now = new Date();
  // When moving to Yellow for the first time, set an initial due date
  if(status === 'yellow' && !task.dueDate){
    const target = (typeof task.targetDays === 'number' ? task.targetDays : 0);
    const due = addDays(now, target, !!task.businessDays);
    updates.dueDate = due;
    updates.startedAt = now;
  }
  if(status === 'green'){
    updates.completedAt = now;
  }
  await updateDoc(ref, updates);
}


// Grant more time and cascade to dependents
export async function extendTask(courseId, task, extraDays, reasonNote){
  const tasksCol = collection(db, 'courses', courseId, 'tasks');
  const taskRef = doc(db, 'courses', courseId, 'tasks', task.id);

  // 1) Extend the task's own due date (create one if it exists and status is yellow)
  const now = new Date();
  let baseDue = null;
  if(task.dueDate && task.dueDate.seconds){
    baseDue = new Date(task.dueDate.seconds * 1000);
  }else if(task.status === 'yellow'){
    // If it's in progress but no due date yet (edge case), set one from now
    const target = (typeof task.targetDays === 'number' ? task.targetDays : 0);
    baseDue = addDays(now, target, !!task.businessDays);
  }

  const newDue = baseDue ? addDays(baseDue, extraDays, !!task.businessDays) : null;

  const updates = {
    extensionRequestedAt: now,
    extensionDays: extraDays,
    extensionReason: reasonNote || ''
  };
  if(newDue) updates.dueDate = newDue;

  await updateDoc(taskRef, updates);

  // 2) Cascade: find dependents and add the same number of days to their due dates if they have one already
  // We only shift tasks that are not completed (green)
  const qSnap = await getDocs(query(tasksCol, where('dependencies', 'array-contains', task.id)));
  const batch = writeBatch(db);
  qSnap.forEach(d => {
    const dep = d.data();
    if(dep.status === 'green') return;
    let depDue = null;
    if(dep.dueDate && dep.dueDate.seconds){
      depDue = new Date(dep.dueDate.seconds * 1000);
      const shifted = addDays(depDue, extraDays, !!dep.businessDays);
      batch.update(d.ref, { dueDate: shifted });
    }
  });
  await batch.commit();
}
