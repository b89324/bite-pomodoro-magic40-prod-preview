import { webkit, devices } from 'playwright';

const base='https://b89324.github.io/bite-pomodoro-magic40-prod-preview/';
let passed=0;
const ok=(value,label)=>{if(!value)throw Error(label);console.log('PASS '+(++passed)+' '+label);};
try{
  await new Promise(r=>setTimeout(r,800));
  const browser=await webkit.launch();
  const context=await browser.newContext({...devices['iPhone 13'],acceptDownloads:true});
  const a=await context.newPage();
  await a.goto(base,{waitUntil:'networkidle'});
  ok((await a.locator('body').innerText()).includes('僅供虛構測試帳號'),'landing clearly labels test-only');
  await a.goto(base+'study.html?student=qa-A&stage=elementary',{waitUntil:'networkidle'});
  ok(await a.locator('[data-page-nav]').count()>0,'qa-A study page renders');
  const stateA=await a.evaluate(()=>JSON.parse(localStorage.getItem('bite-pomodoro-github-v1.student.qa-A')));
  ok(stateA&&Object.keys(stateA.tasks||{}).length===0,'qa-A initial state clean');
  await a.locator('[data-page-nav]').first().selectOption('stats');
  ok(await a.locator('#m40-backup').count()===1,'qa-A backup visible');
  const noticeDownload=a.waitForEvent('download');
  await a.locator('#m40-export').click();
  const download=await noticeDownload;
  ok(download.suggestedFilename().includes('qa-A'),'qa-A backup download');
  ok(!(await a.locator('#m40-message').innerText()).includes('已忽略'),'normal task dates not misidentified');
  const b=await context.newPage();
  await b.goto(base+'study.html?student=qa-B&stage=elementary',{waitUntil:'networkidle'});
  const stateB=await b.evaluate(()=>JSON.parse(localStorage.getItem('bite-pomodoro-github-v1.student.qa-B')));
  ok(stateB&&Object.keys(stateB.tasks||{}).length===0,'qa-B separate clean state');
  const invalid=await context.newPage();
  await invalid.goto(base+'study.html?student=real-student&stage=elementary',{waitUntil:'networkidle'});
  ok((await invalid.locator('#app').innerText()).includes('僅供虛構'),'non-synthetic student blocked');
  ok(await invalid.evaluate(()=>localStorage.getItem('bite-pomodoro-github-v1.student.real-student'))===null,'non-synthetic student data never initialized');
  await browser.close();
  console.log('MAGIC40_LIVE_PAGES_WEBKIT PASS '+passed+'/'+passed);
}finally{}
