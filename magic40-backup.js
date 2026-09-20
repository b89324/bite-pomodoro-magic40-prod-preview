/* magic40 production browser backup / import / one-time undo UI. */
(function () {
 'use strict';
 const prefix='bite-pomodoro-magic40.undo.';
 const undoBaselinePrefix='bite-pomodoro-magic40.undo-baseline.';
 const maxBytes=4*1024*1024;
 const required={tasks:'object',calendarEvents:'array',magicMemory:'array',sessions:'array',exams:'array',reviewCompletions:'object',cancelledReviews:'object',reviewTimeRecords:'object'};
 let plan=null;
 function object(x){return x!==null && typeof x==='object' && !Array.isArray(x);}
 function verify(raw){
   if(!object(raw)||raw.format!=='bite-magic40-v1'||raw.version!==1||raw.studentId!==magic40Student||!object(raw.state))throw Error('備份格式、版本或學生歸屬不符。');
   const payload=JSON.stringify(raw);
   if(payload.length>maxBytes)throw Error('備份超過 4 MB 上限。');
   for(const [k,t] of Object.entries(required))if(t==='array'?!Array.isArray(raw.state[k]):!object(raw.state[k]))throw Error('備份缺少或格式不符：'+k);
   if(Object.keys(raw.state).some(k=>['__proto__','constructor','prototype'].includes(k)))throw Error('備份包含不安全欄位。');
   for(const [d,rows] of Object.entries(raw.state.tasks))if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Array.isArray(rows))throw Error('工作日期或清單格式錯誤。');
   return raw;
 }
 function packageState(){return {format:'bite-magic40-v1',version:1,studentId:magic40Student,createdAt:new Date().toISOString(),state:cleanBackupState40(state)};}
 function counts(s){return [['To Do',Object.values(s.tasks||{}).reduce((n,x)=>n+(Array.isArray(x)?x.length:0),0)],['行事曆',s.calendarEvents.length],['魔法記憶',s.magicMemory.length],['複習完成標記',Object.keys(s.reviewCompletions).length],['複習取消標記',Object.keys(s.cancelledReviews).length],['複習時間',Object.keys(s.reviewTimeRecords).length],['專注紀錄',s.sessions.length],['成績',s.exams.length]];}
 function escape(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 function normalizedState40(v){
   var x=typeof v==='string'?JSON.parse(v):JSON.parse(JSON.stringify(v));
   if(!object(x))return x;
   if(typeof x.activeExamPlanId!=='string')x.activeExamPlanId='';
   return x;
 }
 function canonical40(v){
   if(Array.isArray(v))return '['+v.map(canonical40).join(',')+']';
   if(object(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical40(v[k])).join(',')+'}';
   return JSON.stringify(v);
 }
 function sameState40(raw,current){
   try{return canonical40(normalizedState40(raw))===canonical40(normalizedState40(current));}
   catch(_){return false;}
 }
 function cleanBackupState40(source){
   const s=JSON.parse(JSON.stringify(source));
   const clean={};
   for(const [d,rows] of Object.entries(s.tasks||{})){
     if(/^\d{4}-\d{2}-\d{2}$/.test(d)&&Array.isArray(rows))clean[d]=rows;
   }
   s.tasks=clean;
   return s;
 }
 function notice(msg){const x=document.getElementById('m40-message');if(x)x.textContent=msg;}
 function writeSafely(record){
   const prev=JSON.stringify(cleanBackupState40(state)),undoKey=prefix+magic40Student,baselineKey=undoBaselinePrefix+magic40Student;
   const oldUndo=magic40NativeStorage.getItem(undoKey);
   const oldBaseline=magic40NativeStorage.getItem(baselineKey);
   const oldPersonal=magic40NativeStorage.getItem(magic40PersonalKey);
   if(!sameState40(oldPersonal,state))throw Error('本學生資料已由其他分頁更新，請重新整理後再匯入。');
   const incoming=JSON.stringify(verify(record).state);
   try {
     magic40NativeStorage.setItem(undoKey,prev);
     magic40NativeStorage.setItem(magic40PersonalKey,incoming);
     magic40NativeStorage.setItem(baselineKey,incoming);
   } catch(e) {
     try{if(oldPersonal===null)magic40NativeStorage.removeItem(magic40PersonalKey);else magic40NativeStorage.setItem(magic40PersonalKey,oldPersonal);}catch(_e){}
     try{if(oldUndo===null)magic40NativeStorage.removeItem(undoKey);else magic40NativeStorage.setItem(undoKey,oldUndo);}catch(_e){}
     try{if(oldBaseline===null)magic40NativeStorage.removeItem(baselineKey);else magic40NativeStorage.setItem(baselineKey,oldBaseline);}catch(_e){}
     throw e;
   }
   state=JSON.parse(incoming); magic40RefreshStorageBaseline(); render();
 }
 const previousStats=statsView;
 statsView=function(){return previousStats()+'<section class="card" id="m40-backup"><h2>🛡️ 學生資料隔離與備份</h2><p>目前學生：<b>'+escape(magic40Student)+'</b>。資料依目前學生分開儲存在這台裝置的瀏覽器中；不與其他學生共用學習資料。</p><p>下載備份、選取備份檔後先預覽，核對同一學生才可明確確認匯入。</p><div class="actions"><button class="btn" id="m40-export" type="button">下載本生完整備份</button><label class="btn">選取 JSON 備份<input id="m40-file" type="file" accept="application/json,.json" style="display:none"></label><button class="btn" id="m40-restore" type="button">復原最近一次匯入</button></div><div id="m40-preview"></div><p id="m40-message" role="status"></p></section>';};
 const previousBind=bindStats;
 bindStats=function(){previousBind();
   const button=document.getElementById('m40-export'),file=document.getElementById('m40-file'),undo=document.getElementById('m40-restore'),preview=document.getElementById('m40-preview');
   if(!button||!file||!undo||!preview)return;
   button.onclick=()=>{try{
     const storedExport=magic40NativeStorage.getItem(magic40PersonalKey);
     if(!sameState40(storedExport,state))throw Error('另一個分頁已修改本學生資料；請重新整理再下載備份，避免下載過期紀錄。');
     const dirtyTaskKeys=Object.entries(state.tasks||{}).filter(([d,rows])=>!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d)||!Array.isArray(rows)).map(([d])=>d); const data=verify(packageState());const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='bite-pomodoro-'+magic40Student+'-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('已產生 '+magic40Student+' 的備份下載。'+(dirtyTaskKeys.length?' 已忽略 '+dirtyTaskKeys.length+' 個非日期舊測試鍵。':''));
   }catch(e){notice('備份失敗：'+e.message);}};
   file.onchange=async()=>{plan=null;preview.textContent='';try{
     const f=file.files&&file.files[0];if(!f)return;if(f.size>maxBytes)throw Error('檔案超過 4 MB。');
     const raw=verify(JSON.parse(await f.text())), before=JSON.stringify(state);
     if(!sameState40(magic40NativeStorage.getItem(magic40PersonalKey),state))throw Error('另一個分頁已修改本學生資料；請重新整理後再預覽匯入。');
     plan={record:raw,before,storedBefore:magic40NativeStorage.getItem(magic40PersonalKey),studentId:magic40Student};
     const details=counts(raw.state).map(([name,n])=>'<li>'+escape(name)+'：'+n+' 筆</li>').join('');
     preview.innerHTML='<p><b>預覽：'+escape(raw.studentId)+'</b>｜備份時間 '+escape(raw.createdAt||'未提供')+'</p><ul>'+details+'</ul><p>匯入將以此備份取代本學生目前資料；其他學生不變。</p><label><input id="m40-check" type="checkbox"> 我確認備份所屬學生與筆數，並同意取代本學生目前資料。</label> <button class="btn" id="m40-apply" type="button">確認匯入</button>';
     document.getElementById('m40-apply').onclick=()=>{try{
       if(!document.getElementById('m40-check').checked)throw Error('請先勾選確認。');
       if(!plan||plan.studentId!==magic40Student||!sameState40(plan.before,state)||!sameState40(plan.storedBefore,magic40NativeStorage.getItem(magic40PersonalKey)))throw Error('目前資料已變更，請重新選取備份檔。');
       writeSafely(plan.record);plan=null;notice('匯入成功。');
     }catch(e){notice('匯入未執行：'+e.message);}};
     notice('預覽完成，尚未修改任何學習資料。');
   }catch(e){notice('無法預覽：'+e.message);}finally{file.value='';}};
   undo.onclick=()=>{try{
     const key=prefix+magic40Student,baselineKey=undoBaselinePrefix+magic40Student,raw=magic40NativeStorage.getItem(key);
     if(raw===null){
       notice('目前沒有可再次復原的匯入紀錄。若剛才已復原成功，這是正常狀態。');
       return;
     }
     const importedBaseline=magic40NativeStorage.getItem(baselineKey);
     if(importedBaseline===null||!sameState40(importedBaseline,magic40NativeStorage.getItem(magic40PersonalKey))||!sameState40(importedBaseline,state))throw Error('匯入後資料已有新變更，不能直接復原；請先下載目前資料備份。');
     if(!confirm('確定復原 '+magic40Student+' 最近一次匯入前的資料？'))return;
     const prev=magic40NativeStorage.getItem(magic40PersonalKey);
     const oldUndo=magic40NativeStorage.getItem(key),oldBaseline=magic40NativeStorage.getItem(baselineKey);
     try {
       const restored=verify({format:'bite-magic40-v1',version:1,studentId:magic40Student,state:cleanBackupState40(JSON.parse(raw))});
       magic40NativeStorage.setItem(magic40PersonalKey,JSON.stringify(restored.state));
       magic40NativeStorage.removeItem(key);
       magic40NativeStorage.removeItem(baselineKey);
       state=JSON.parse(JSON.stringify(restored.state));
       magic40RefreshStorageBaseline();
       render();
       notice('復原成功：已回到最近一次匯入前的資料。此復原紀錄已使用，不能再重複復原。');
     }catch(e){
       try{if(prev===null)magic40NativeStorage.removeItem(magic40PersonalKey);else magic40NativeStorage.setItem(magic40PersonalKey,prev);}catch(_e){}
       try{if(oldUndo===null)magic40NativeStorage.removeItem(key);else magic40NativeStorage.setItem(key,oldUndo);}catch(_e){}
       try{if(oldBaseline===null)magic40NativeStorage.removeItem(baselineKey);else magic40NativeStorage.setItem(baselineKey,oldBaseline);}catch(_e){}
       throw e;
     }
   }catch(e){notice('復原失敗：'+e.message);}};
 };
 if(view==='stats')render();
})();