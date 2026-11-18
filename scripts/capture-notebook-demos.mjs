import { recordScenarios } from './demo-recorder.mjs';

const note = (b,text,at) => b.run(['note','new','-',...(at?['--at',at]:[])],text);
const notebook = async(p,u)=>{await u.click(p.getByRole('button',{name:'Notebook',exact:true}));await u.pause(800);};
const open = async(p,u,title)=>{
  const tree=p.locator('.nb-tree-open').filter({hasText:title}).first();
  if(await tree.isVisible()) await u.click(tree);
  else { const pages=p.locator('.nb-section[data-section="pages"]');if(await pages.isVisible())await u.click(pages);const target=p.locator('.nb-tree-open').filter({hasText:title}).first();if(await target.isVisible())await u.click(target);else{await u.type(p.getByPlaceholder('Search every page'),title);await u.pause(1000);await u.click(p.locator('.nb-item').filter({hasText:title}).first());} }
  await u.pause(600);
};
const menu=async(p,u,label)=>{await u.click(p.getByRole('button',{name:'Change this page',exact:true}));await u.click(p.getByRole('button',{name:label,exact:true}));};
const settle=async(p,u)=>{await u.click(p.locator('.nb-title').last());await p.keyboard.press('Escape');await u.pause(1200);};
const scenarios={
 'notebook-capture': {
  prepare:async b=>{await note(b,'# Reading checklist\n\nKeep references together.');await note(b,'# Reference index\n\nRevisit selected passages.');},
  run:async(p,u)=>{await u.caption('Find a page in your notebook');await notebook(p,u);await u.type(p.getByPlaceholder('Search every page'),'checklist');await u.pause(1300);await u.click(p.locator('.nb-item,.nb-entry').filter({hasText:'Reading checklist'}).first());await u.pause(1000);await u.shot();await u.caption('Capture a thought without leaving the reader');await p.keyboard.press('Control+j');await u.type(p.getByPlaceholder('Write it down…'),'Return here after comparing the references.');await p.keyboard.press('Enter');await u.pause(1300);}
 },
 'daily-page': {
  run:async(p,u)=>{await u.caption('Keep a page for today');await notebook(p,u);const day=p.locator('.nb-day-row').first();if(await day.isVisible())await u.click(day);else await u.click(p.locator('.nb-item').filter({hasText:'Not written in yet'}).first());await u.type(p.locator('textarea.nb-input'),'Reading log\n\nReviewed the chapter and saved references to revisit.');await settle(p,u);await u.shot();}
 },
 'page-associations': {
  prepare:async b=>{await note(b,'# Reference checklist\n\nRevisit this passage after reading the chapter.');await b.run(['thread','new','Reference collection']);},
  run:async(p,u)=>{await u.caption('Attach a page to a passage');await notebook(p,u);await open(p,u,'Reference checklist');await u.click(p.getByRole('button',{name:'+ Place',exact:true}));await u.type(p.getByPlaceholder('Another place… (a verse, a chapter, a book)'),'John 1:1');await p.keyboard.press('Enter');await u.pause(1000);await u.caption('Keep the same page on another place and a thread');await u.click(p.getByRole('button',{name:'+ Place',exact:true}));await u.type(p.getByPlaceholder('Another place… (a verse, a chapter, a book)'),'John 1:2');await p.keyboard.press('Enter');await u.pause(1000);await u.click(p.getByRole('button',{name:'+ Thread',exact:true}));await u.click(p.locator('.chooser-row').filter({hasText:'Reference collection'}));await u.pause(1400);await u.shot();}
 },
 'page-organization': {
  prepare:async b=>{await note(b,'# Reading projects\n\nA place for related pages.');await note(b,'# Reference checklist\n\nKeep this page nearby.');},
  run:async(p,u)=>{await u.caption('Pin a page you return to often');await notebook(p,u);await open(p,u,'Reference checklist');await menu(p,u,'Pin');await u.pause(900);await u.caption('Move the page inside another page');await menu(p,u,'Move inside…');await u.click(p.locator('.nb-move-row').filter({hasText:'Reading projects'}));await u.pause(1300);await u.shot();}
 },
 'page-links': {
  prepare:async b=>{await note(b,'# Reference index\n\nKeep passages here.');await note(b,'# Reading checklist\n\nSee [[Reference index]] before continuing.');},
  run:async(p,u)=>{await u.caption('Follow a link between your pages');await notebook(p,u);await open(p,u,'Reading checklist');await u.click(p.locator('.nb-body a').filter({hasText:'Reference index'}));await u.pause(1300);await u.caption('See which page links back here');await u.shot();await u.click(p.locator('.nb-linked-row').filter({hasText:'Reading checklist'}));await u.pause(1100);}
 },
 'writing-blocks': {
  prepare:async b=>{await note(b,'# Reading checklist\n\n## Next steps\n\n- [ ] Revisit the chapter\n- [ ] Compare the references\n\n| Reference | Status |\n| --- | --- |\n| John 1 | Ready |');},
  run:async(p,u)=>{await u.caption('Work with a checklist and a table');await notebook(p,u);await open(p,u,'Reading checklist');await u.click(p.getByRole('checkbox',{name:'Tick it done'}).first());await u.pause(900);await u.click(p.getByRole('button',{name:'Edit table',exact:true}));await u.click(p.getByRole('button',{name:'Add row',exact:true}));await u.pause(800);await u.click(p.getByRole('button',{name:'Save block',exact:true}));await u.pause(1100);await u.shot();}
 },
 'scripture-cards': {
  prepare:async b=>{await note(b,'# Passage workspace\n\n```scripture\nJohn 1:1-3\n```');},
  run:async(p,u)=>{await u.caption('A passage block draws its text from the database');await notebook(p,u);await open(p,u,'Passage workspace');await u.pause(1300);await u.click(p.getByRole('button',{name:'Lines',exact:true}));await u.pause(900);await u.click(p.locator('.sv-ylt'));await u.pause(1400);await u.shot();await u.click(p.locator('.sv-ylt'));await u.pause(900);}
 },
 'word-thread-cards': {
  prepare:async b=>{const t=await b.run(['thread','new','Reference collection','--at','John 1:1']);await note(b,'# Source cards\n\n```word\nG3056\n```\n\n```thread\n'+t.id+'\n```');},
  run:async(p,u)=>{await u.caption('Keep source word entries and thread cards in a page');await notebook(p,u);await open(p,u,'Source cards');await u.pause(1700);await u.shot();await u.scroll(p.locator('.nb-editor'),380);await u.click(p.getByRole('button',{name:'Open the page',exact:true}));await u.pause(1400);}
 },
 'questions-and-placement': {
  prepare:async b=>{await note(b,'# Reading checklist\n\n> [!question] Which references should I revisit next?','John 1:1');},
  run:async(p,u)=>{await u.caption('Track a question until you mark it answered');await notebook(p,u);await open(p,u,'Reading checklist');await u.click(p.getByRole('button',{name:'Mark answered',exact:true}));await u.pause(1600);await u.caption('Give a question its own page at the same place');await u.click(p.getByRole('button',{name:'Give it its own page',exact:true}));await u.pause(1600);await u.caption('Reopen the question and return it to the original page');await u.click(p.getByRole('button',{name:'Open it again',exact:true}));await u.pause(1600);await u.click(p.getByRole('button',{name:'Fold into a page…',exact:true}));await u.click(p.locator('.nb-question-target').filter({hasText:'Reading checklist'}));await u.pause(1600);await p.getByRole('button',{name:'Mark answered',exact:true}).waitFor();await u.shot();}
 },
 'live-notebook-view': {
  prepare:async b=>{await note(b,'# Reading question\n\nWhich reference should I revisit?','John 1:1');const q=await note(b,'Which chapter should be next?','John 1:2');await b.run(['note','question',q.id]);await note(b,'# Notebook dashboard\n\n```view\nnotebook @John 1\n```');},
  run:async(p,u)=>{await u.caption('Keep a filtered notebook list inside a page');await notebook(p,u);await open(p,u,'Notebook dashboard');await u.pause(1600);await u.shot();await u.click(p.locator('.nbv-row').first());await u.pause(1200);}
 },
 'page-templates': {
  prepare:async b=>{await note(b,'# Reference checklist\n\n## References\n\n- [ ] Read the chapter\n- [ ] Keep related places together');},
  run:async(p,u)=>{await u.caption('Turn a reusable page into a template');await notebook(p,u);await open(p,u,'Reference checklist');await menu(p,u,'Save as a template');await u.pause(1100);await menu(p,u,'Make a page from it…');await u.pause(1300);await u.shot();await u.click(p.getByRole('button',{name:'Make the page',exact:true}));await u.pause(1500);}
 },
 'page-undo': {
  prepare:async b=>{await note(b,'# Temporary checklist\n\nThis sample page can be restored.');},
  run:async(p,u)=>{await u.caption('Delete a sample page, then undo the deletion');await notebook(p,u);await open(p,u,'Temporary checklist');await menu(p,u,'Delete');await u.pause(900);await u.click(p.getByRole('button',{name:/Undo deletion of 1 page/}));await u.pause(1500);await p.locator('.nb-title').filter({hasText:'Temporary checklist'}).waitFor();await u.shot();}
 },
 'thread-results': {
  run:async(p,u)=>{await u.caption('Collect selected word occurrences in a thread');await u.click(p.locator('#reader .w').nth(5));await u.click(p.getByRole('button',{name:'Every use',exact:true}));await u.pause(1000);await u.click(p.locator('.pane-uses input.tick').nth(0));await u.click(p.locator('.pane-uses input.tick').nth(1));await u.click(p.getByRole('button',{name:'Add to a thread…',exact:true}));await u.type(p.getByPlaceholder('A thread, or a new name'),'Reference collection');await p.keyboard.press('Enter');await u.pause(1300);await u.shot();await notebook(p,u);await open(p,u,'Reference collection');await u.pause(1100);await u.click(p.locator('.nb-thread-color'));await u.click(p.getByRole('button',{name:'blue',exact:true}));await u.pause(1000);}
 },
 'highlight-list': {
  prepare:async b=>{await b.run(['hl','set','John 1:1','yellow']);await b.run(['hl','set','John 1:2','blue']);},
  run:async(p,u)=>{await u.caption('Browse the highlights saved in your study');await u.click(p.locator('#hl-menu'));await u.click(p.getByRole('button',{name:'Your highlights, listed…',exact:true}));await u.pause(1600);await u.shot();}
 },
};

await recordScenarios(scenarios);
