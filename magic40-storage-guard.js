/* magic40 production student-isolated storage guard.
 * Must execute BEFORE github-app.js in the SAME new Function scope.
 */
const magic40NativeStorage = globalThis.localStorage;
const magic40Root = 'bite-pomodoro-github-v1';
const magic40Portal = 'bitepomodoro.github.portal.';
const magic40Student = (() => {
  try { return String(JSON.parse(magic40NativeStorage.getItem(magic40Portal + 'studentId') || '""') || '').trim(); }
  catch (_) { return ''; }
})();
if (!['qa-A','qa-B'].includes(magic40Student)) throw new Error('此預覽站只供虛構 qa-A／qa-B 測試；請由預覽首頁選擇測試角色。');
if (magic40Student.length > 128 || /[\u0000-\u001F\u007F]/.test(magic40Student)) throw new Error('學生識別資料格式不正確，請回主頁重新選擇。');

const magic40PersonalKey = magic40Root + '.student.' + magic40Student;
const magic40HadPersonal = magic40NativeStorage.getItem(magic40PersonalKey) !== null;
const magic40EmptyState = JSON.stringify({
  tasks:{},sessions:[],exams:[],calendarEvents:[],magicMemory:[],customTimerModes:[],
  reviewCompletions:{},cancelledReviews:{},reviewTimeRecords:{}
});
let magic40Baseline = magic40NativeStorage.getItem(magic40PersonalKey);
function magic40RefreshStorageBaseline(){ magic40Baseline = magic40NativeStorage.getItem(magic40PersonalKey); }
function magic40Conflict(message){
  try { window.dispatchEvent(new CustomEvent('magic40-storage-conflict',{detail:{studentId:magic40Student,message}})); } catch (_) {}
  throw new Error(message);
}
function magic40GuardedStudentWrite(value,remove){
  const latest = magic40NativeStorage.getItem(magic40PersonalKey);
  if (latest !== magic40Baseline) return magic40Conflict('同一學生的紀錄已由其他分頁更新，為避免覆蓋，請先重新整理。');
  if (remove) magic40NativeStorage.removeItem(magic40PersonalKey);
  else magic40NativeStorage.setItem(magic40PersonalKey,String(value));
  magic40RefreshStorageBaseline();
}
const localStorage = Object.freeze({
  getItem(key){
    const k=String(key);
    if(k===magic40Root||k===magic40PersonalKey){
      const v=magic40NativeStorage.getItem(magic40PersonalKey);
      return v===null?magic40EmptyState:v;
    }
    if(k.startsWith(magic40Root+'.student.')) return k===magic40PersonalKey?magic40NativeStorage.getItem(k):null;
    return magic40NativeStorage.getItem(k);
  },
  setItem(key,value){
    const k=String(key);
    if(k===magic40Root||k===magic40PersonalKey) return magic40GuardedStudentWrite(value,false);
    if(k.startsWith(magic40Root+'.student.')) return magic40Conflict('禁止寫入其他學生的學習資料。');
    return magic40NativeStorage.setItem(k,String(value));
  },
  removeItem(key){
    const k=String(key);
    if(k===magic40Root||k===magic40PersonalKey) return magic40GuardedStudentWrite(null,true);
    if(k.startsWith(magic40Root+'.student.')) return magic40Conflict('禁止刪除其他學生資料。');
    return magic40NativeStorage.removeItem(k);
  }
});