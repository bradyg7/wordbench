import { recordScenarios } from './demo-recorder.mjs';
const button=(p,name)=>p.getByRole('button',{name,exact:true});
async function more(p,u,name){await u.click(p.locator('#more'));await u.click(p.locator('.more-menu').getByRole('button',{name:new RegExp('^'+name)}));}
async function settings(p,u){await more(p,u,'Settings');}
async function plans(p,u){await more(p,u,'Reading plans');}
async function replace(p,u,loc,text){await u.click(loc);await p.keyboard.press('Control+A');await p.keyboard.type(text,{delay:85});await p.keyboard.press('Tab');await u.pause(600);}
async function select(p,u,loc,key){await u.click(loc);await p.keyboard.press(key);await p.keyboard.press('Enter');await u.pause(700);}
async function resize(p,u){const g=p.locator('.grip-right');await g.waitFor({state:'visible'});const c=await u.center(g);await u.move(c.x,c.y);await p.mouse.down();await u.move(c.x-210,c.y,1400);await p.mouse.up();await u.pause(800);}
const scenes={
 'reading-progress':async(p,u)=>{
  await u.caption('Mark a chapter read when you reach the end');await u.scroll(p.locator('#reader'),7000);await u.click(p.getByRole('button',{name:'Mark John 1 read',exact:true}));await u.pause(900);
  await u.caption('Review the chapter totals in Reading plans');await plans(p,u);await u.pause(1000);await u.shot();
  await u.caption('A mistaken mark can be taken back');await u.click(p.getByRole('button',{name:'Mark unread',exact:true}));await u.pause(1000);
 },
 'workspace-layout':async(p,u)=>{
  await u.caption('Open related tools, then give the panes more room');
  await u.click(button(p,'Notebook'));await u.click(button(p,'Shelf'));await resize(p,u);
  await u.caption('Save this arrangement with a name');await settings(p,u);
  await u.click(p.locator('.set-nav').getByRole('button',{name:'Layouts',exact:true}));
  await u.type(p.getByPlaceholder('Name for the panes open now'),'Reading desk');await u.click(button(p,'Save this layout'));
  await u.pause(1100);await u.shot();
  await u.type(p.getByRole('textbox',{name:'Shortcut for Reading desk'}),'Ctrl+Alt+R');await u.click(button(p,'Save shortcut'));await u.pause(900);
 },
 'workspace-shelf':async(p,u)=>{
  await u.caption('Make a folder for passages you want to keep together');await u.click(button(p,'Shelf'));
  await u.click(button(p,'New folder'));await u.type(p.getByPlaceholder('Name the new folder'),'Reading passages');await u.click(button(p,'Make'));
  await u.click(p.locator('.shelf-add'));await u.click(p.locator('.shelf-menu').getByRole('button',{name:/^A place/}));
  await u.type(p.getByPlaceholder('Num 25:10-13, Ps 106, Ruth'),'John 1:1-5');await p.keyboard.press('Enter');await u.pause(1200);
  await u.click(p.locator('.shelf-add'));await u.click(p.locator('.shelf-menu').getByRole('button',{name:/^A place/}));
  await u.type(p.getByPlaceholder('Num 25:10-13, Ps 106, Ruth'),'Psalm 119:1-8');await p.keyboard.press('Enter');await u.pause(1200);
  if(await p.locator('.shelf-item').count()!==2)throw Error('Shelf references did not persist');
  await u.caption('Open the folder’s passages together, then close its tabs');await u.click(button(p,'Open all'));await u.pause(1600);await u.shot();
  await u.click(p.locator('#tb-shelf'));await u.click(button(p,'Close all'));await u.pause(1000);
 },
 'workspace-toolbar':async(p,u)=>{
  await u.caption('Put frequently used tools on the toolbar');await more(p,u,'Customize toolbar');
  await u.type(p.getByPlaceholder('Find a button'),'Text size');await u.click(p.locator('.tb-entry').filter({hasText:'Text size'}));
  await u.caption('Drag buttons into your preferred order');await u.drag(p.locator('.tb-edit').filter({hasText:'Shelf'}),p.locator('.tb-edit').filter({hasText:'Notebook'}));
  await u.click(button(p,'Done'));await u.pause(800);await u.shot();
 },
 'workspace-theme':async(p,u)=>{
  await u.caption('Choose a comfortable reading size');await settings(p,u);await u.click(button(p,'A+'));await u.click(button(p,'A+'));
  await u.caption('Create your own theme and change a color');await u.click(p.locator('.set-nav').getByRole('button',{name:'Theme',exact:true}));
  await u.click(button(p,'+ New theme'));await replace(p,u,p.locator('.theme-name'),'Warm reading');
  const row=p.locator('.color-row').filter({has:p.locator('.color-name').getByText('Page behind the text',{exact:true})});
  await replace(p,u,row.locator('.hex'),'#fff8eb');await u.pause(900);await u.shot();
 },
 'workspace-preferences':async(p,u)=>{
  await u.caption('Choose when reference cards appear');await settings(p,u);await u.click(p.locator('.set-nav').getByRole('button',{name:'Hover and cards',exact:true}));await u.click(button(p,'refs'));
  await u.caption('Notebook preferences are saved as you change them');await u.click(p.locator('.set-nav').getByRole('button',{name:'Notebook',exact:true}));await u.pause(1000);await u.shot();
 },
 'workspace-shortcut':async(p,u)=>{
  await u.caption('Keep a useful action as a toolbar button');await more(p,u,'Customize toolbar');
  await u.scroll(p.locator('.tb-drawer'),580);await u.click(p.locator('.tb-entry').filter({hasText:'A command of your own'}));
  await u.type(p.getByLabel('Name on the button'),'Compare this chapter');await u.type(p.getByLabel('The line'),'compare {chapter} ylt');
  await u.type(p.getByLabel('Key (optional)'),'Ctrl+Alt+Y');await u.caption('The preview shows how the current chapter fills the placeholder');await u.shot();
  await u.click(button(p,'Keep and add to toolbar'));await u.click(button(p,'Done'));await u.pause(700);
 },
 'plan-create':async(p,u)=>{
  await u.caption('Build a plan from selected books');await plans(p,u);await u.click(button(p,'New plan'));
  await u.type(p.getByRole('textbox',{name:'Name',exact:true}),'John at my pace');await u.click(button(p,'+ Books…'));
  await u.scroll(p.locator('.plan-modal-body'),350);await u.click(p.locator('.plan-books [data-code="JHN"]'));await u.click(button(p,'Done'));
  await select(p,u,p.getByRole('combobox',{name:'Pace',exact:true}),'End');await u.caption('Read at your own pace without a deadline');await u.click(button(p,'Start the plan'));await u.pause(1300);
  await u.click(button(p,'Read'));await u.pause(900);await u.click(button(p,'Mark read'));await u.pause(1000);await u.shot();
 },
 'plan-arrange':async(p,u)=>{
  await u.caption('Arrange a short reading schedule by hand');await plans(p,u);await u.click(button(p,'New plan'));await u.type(p.getByRole('textbox',{name:'Name',exact:true}),'Three reading days');
  await u.click(button(p,'+ A passage…'));await u.type(p.locator('.ask-input').last(),'John 1-3');await u.click(button(p,'OK'));
  await replace(p,u,p.getByRole('spinbutton',{name:'Number',exact:true}),'3');await u.click(button(p,'Arrange the days myself…'));await u.pause(900);
  await u.drag(p.locator('.plan-bday').nth(0).locator('.plan-bchip').first(),p.locator('.plan-bday').nth(1));await u.caption('Manually arranged days remain marked as kept');await u.shot();
  await u.click(button(p,'Start the plan'));await u.pause(1100);
 },
 'plan-import':async(p,u)=>{
  await u.caption('Import a reference list: one reading day per line');await plans(p,u);await u.click(button(p,'New plan'));await u.click(button(p,'A published plan…'));
  await u.type(p.getByRole('textbox',{name:'Name',exact:true}),'Sample reading list');await u.type(p.getByRole('textbox',{name:'The plan, as you have it'}),'John 1\nJohn 2\nJohn 3');
  await u.type(p.getByRole('textbox',{name:'Where it came from'}),'My sample reference list');await u.scroll(p.locator('.plan-modal-body'),280);
  await u.caption('Check the detected days and readings before starting');await u.shot();await u.click(button(p,'Start the plan'));await u.pause(1100);
 },
 'plan-revise':{prepare:async b=>{await b.run(['plan','start','Morning reading','--passages','John 1-5','--days','5','--start','2026-11-08']);},run:async(p,u)=>{
  await u.caption('Choose what happens to days you have not read');await plans(p,u);await u.click(button(p,'What should happen?'));await u.pause(700);await u.shot();
  await u.click(button(p,'Do it'));await u.pause(800);await u.caption('Rename the plan while keeping its readings');await u.click(button(p,'Rename…'));
  await replace(p,u,p.locator('.ask-input'),'Evening reading');await u.click(button(p,'OK'));await u.pause(1000);
 }},
 'plan-past':{prepare:async b=>{await b.run(['plan','start','Sample week','--passages','John 1-3','--pace','own']);await b.run(['plan','done','Sample week','--day','1']);},run:async(p,u)=>{
  await u.caption('Stop a plan without erasing what you have read');await plans(p,u);await u.click(button(p,'Stop'));await u.click(p.getByRole('button',{name:/^Past plans/}));await u.pause(800);await u.shot();
  await u.caption('Start a fresh copy from a past plan');await u.click(button(p,'Use again…'));await u.click(button(p,'OK'));await u.pause(900);
  await u.scroll(p.locator('.pane-plans'),350);await u.pause(900);
 }},
};
for(const [id,scene] of Object.entries(scenes)) {
 const run=scene.run||scene;
 scenes[id]={...(typeof scene==='object'?scene:{}),run:async(p,u)=>{p.setDefaultTimeout(14000);await run(p,u);}};
}
await recordScenarios(scenes);
