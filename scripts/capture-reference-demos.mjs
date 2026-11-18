import { recordScenarios } from './demo-recorder.mjs';
import { writeFile } from 'node:fs/promises';
const command=async(p,u,text)=>{await u.click(p.locator('#cmd'));await p.keyboard.press('Control+a');await p.keyboard.press('Backspace');await u.type(p.locator('#cmd'),text);await p.keyboard.press('Enter');await u.pause(1600);};
const more=async(p,u,label)=>{await u.click(p.locator('#more'));await u.click(p.getByRole('button',{name:label==='Help'?/^Help/:label,exact:label!=='Help'}));};
const choose=async(p,u,loc,value)=>{const index=await loc.locator('option').evaluateAll((opts,value)=>opts.findIndex(o=>o.value===value),value);if(index<0)throw Error('Missing option '+value);await u.click(loc);await p.keyboard.press('Home');for(let i=0;i<index;i++)await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await u.pause(900);};

const scenarios={
  'find-in-pane':{prepare:async b=>{await b.run(['note','new','-'],'# Reference checklist\n\nKeep reference links together.\n\nReturn to this reference checklist after reading.');},run:async(p,u)=>{
    await u.caption('Find words within a notebook pane');
    await u.click(p.locator('#tb-notebook'));
    await u.type(p.getByPlaceholder('Search every page'),'Reference checklist');
    await u.click(p.locator('.nb-item').filter({hasText:'Reference checklist'}).first());
    await p.keyboard.press('Control+f');
    await u.type(p.getByPlaceholder('Find in this pane'),'reference');
    await u.pause(1700);await u.shot();
    await p.keyboard.press('Enter');await u.pause(1400);
    await p.keyboard.press('Enter');await u.pause(1400);
    await p.keyboard.press('Escape');await u.pause(1000);
  }},
  'bible-search':async(p,u)=>{
    await u.caption('Search the Bible from the search field');
    await command(p,u,'search lamp');
    await p.locator('.pane-search .row').first().waitFor();
    await u.shot();
    await u.caption('Open a result in its chapter');
    await u.click(p.locator('.pane-search .ref-link').first());
    await u.pause(1000);
    const go=p.getByRole('button',{name:/Go to in the reader|Go to chapter/}).first();
    if(await go.isVisible())await u.click(go);
    await u.pause(1600);
    await u.caption('Return to the reading place you left');
    await command(p,u,'back');await u.pause(1500);
  },
  'interlinear-tools':async(p,u)=>{
    await u.caption('Open the interlinear from a word card');
    await u.click(p.locator('#reader .w').nth(5));
    await u.click(p.getByRole('button',{name:'Interlinear',exact:true}));
    await u.pause(1800);await u.shot();
    await u.caption('Follow a source word to its lexical entry');
    await u.click(p.locator('.inter-strong').filter({hasText:'G3056'}).first());
    await u.pause(1600);
    await u.scroll(p.locator('.pane-strong'),300);
    await u.click(p.getByRole('button',{name:'Count by book',exact:true}));
    await u.pause(2000);
  },
  'hebrew-lexicon':async(p,u)=>{
    await u.caption('Look up a numbered Hebrew entry');
    await command(p,u,'def H1');
    await p.locator('.pane-strong').waitFor();
    await u.pause(1500);
    await u.scroll(p.locator('.pane-strong'),360);
    await u.caption('Open the identified BDB source');
    await u.click(p.getByRole('button',{name:'BDB',exact:true}));
    await u.pause(2200);await u.shot();
    await u.scroll(p.locator('.pane-bdb'),250);await u.pause(1800);
  },
  'word-forms':async(p,u)=>{
    await u.caption('Find the forms of an English word');
    await command(p,u,'forms light');
    await p.locator('.pane-forms .entry-row').first().waitFor();
    await u.pause(1500);await u.shot();
    await u.caption('Click a form to inspect its occurrences');
    await u.click(p.locator('.pane-forms .entry-row').first());
    await u.pause(2000);await u.scroll(p.locator('.pane-uses'),240);
  },
  'nearby-search':async(p,u)=>{
    await u.caption('Search for two words near one another');
    await command(p,u,'near light darkness within 8');
    await p.locator('.pane-near .row').first().waitFor();
    await u.pause(2200);await u.shot();
    await u.scroll(p.locator('.pane-near'),320);await u.pause(2200);
  },
  'lexical-search':async(p,u)=>{
    await u.caption('Search within lexical definitions');
    await command(p,u,'lexiconc light');
    await p.locator('.pane-lexiconc .entry-row').first().waitFor();
    await u.pause(1800);await u.shot();
    await u.caption('Open an entry from the results');
    await u.click(p.locator('.pane-lexiconc .entry-row').first());
    await u.pause(2200);
  },
  'reference-dictionary':{prepare:async backend=>{await backend.run(['note','new','-'],'# Reference index\n\nRevisit John 1:1.');},run:async(p,u)=>{
    await u.caption('Open a referenced passage without leaving the reader');
    await u.click(p.locator('#tb-notebook'));
    await u.type(p.getByPlaceholder('Search every page'),'Reference index');
    await u.click(p.locator('.nb-item').filter({hasText:'Reference index'}).first());
    await u.click(p.locator('.nb-body a.ref').first());
    await u.pause(1200);
    await u.click(p.getByRole('button',{name:'Definitions',exact:true}));
    await u.pause(1400);
    await u.caption('Read an identified historical dictionary entry');
    await u.click(p.locator('.vc-def-word').filter({hasText:/beginning/i}).first());
    await u.pause(2400);await u.shot();
  }},
  'copy-reference':async(p,u)=>{
    await p.context().grantPermissions(['clipboard-read','clipboard-write']);
    await u.caption('Copy a passage with its reference');
    await u.click(p.locator('#reader .vn[data-v="1"]'),'right');
    await u.click(p.getByRole('button',{name:'Copy',exact:true}));
    const copied=await p.evaluate(()=>navigator.clipboard.readText());
    if(!copied.includes('John 1:1'))throw Error('Clipboard lost reference');
    await u.pause(1800);
    await u.caption('Paste the source text into a new page');
    await u.click(p.locator('#tb-notebook'));
    await u.click(p.getByRole('button',{name:'A new page',exact:true}).first());
    if(await p.getByRole('button',{name:'Make the page',exact:true}).isVisible())await u.click(p.getByRole('button',{name:'Make the page',exact:true}));
    await u.type(p.locator('textarea.nb-input'),'# Copied reference\n\n');
    await p.keyboard.press('Control+v');await u.pause(1700);await p.keyboard.press('Escape');
    await u.pause(1500);await u.shot();
  },
  'help-and-keys':async(p,u)=>{
    await u.caption('Find help for a task');await more(p,u,'Help');
    await u.type(p.getByPlaceholder('A task, topic, or word'),'highlight');
    await u.pause(1800);await u.shot();
    await u.caption('Browse keyboard shortcuts');
    await u.click(p.getByRole('button',{name:'Keys',exact:true}));
    await u.type(p.getByPlaceholder('A key or a word'),'find');await u.pause(1800);
    await u.caption('The command reference explains explicit app actions');
    await u.click(p.getByRole('button',{name:'Commands',exact:true}));
    await u.type(p.getByPlaceholder('A command or a word'),'search');await u.pause(2200);
  },
  'findings':async(p,u)=>{
    await u.caption('Keep feedback about the app separate from study notes');
    await p.keyboard.press('Control+Shift+j');
    await u.type(p.getByPlaceholder('What did you notice? (kept apart from your study)'),'Sample feedback: make the toolbar easier to find.');
    await p.keyboard.press('Enter');await u.pause(1300);
    await more(p,u,'Findings');await u.pause(1300);
    await u.caption('Attach a supporting file to the local finding');
    const chooser=p.waitForEvent('filechooser');
    await u.click(p.getByRole('button',{name:'Attach a file…',exact:true}));
    await (await chooser).setFiles({name:'sample-feedback.txt',mimeType:'text/plain',buffer:Buffer.from('Sample feedback attachment. No personal study data.')});
    await u.pause(2000);
    await p.getByText('sample-feedback.txt',{exact:true}).waitFor();await u.shot();
    await u.caption('Mark the finding handled');
    await u.click(p.getByRole('button',{name:'✓ Handled',exact:true}));await u.pause(1800);
  },
  'read-aloud-controls':async(p,u)=>{
    await u.caption('Start local read-aloud — this walkthrough is silent');
    await more(p,u,'Listen');
    await p.getByRole('button',{name:'Pause read-aloud',exact:true}).waitFor();
    await u.pause(4500);await u.shot();
    await u.caption('Pause, choose a speed, and resume');
    await u.click(p.getByRole('button',{name:'Pause read-aloud',exact:true}));
    await choose(p,u,p.getByRole('combobox',{name:'Speech speed'}),'1.25');
    await u.click(p.getByRole('button',{name:'Resume read-aloud',exact:true}));await u.pause(3000);
    await u.click(p.getByRole('button',{name:'Stop',exact:true}));await u.pause(1500);
  },
};
await recordScenarios(scenarios);
