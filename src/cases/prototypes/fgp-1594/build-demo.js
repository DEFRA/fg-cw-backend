// Generate one offline, shareable file using the SAME logic as the Mongo probe.
import { readFile, writeFile } from "node:fs/promises";
const here = new URL("./", import.meta.url);
const core = (await readFile(new URL("logic.js", here), "utf8")).replaceAll(
  "export ",
  "",
);
const seeds = (await readFile(new URL("seed.js", here), "utf8")).replaceAll(
  "export ",
  "",
);
const config = await readFile(new URL("config.json", here), "utf8");
const page = `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>FGP-1594 throwaway dedupe spike</title>
<style>
body{font:18px/1.5 system-ui,sans-serif;max-width:1100px;margin:40px auto;padding:0 24px;color:#172b31;background:#fafbf9}h1,h2,h3{line-height:1.2}h1{font-size:36px}section,details{background:white;border:1px solid #bbc9c4;padding:20px;margin:20px 0}button,select,textarea{font:inherit;padding:7px;margin:4px}button{cursor:pointer;border:1px solid #145e48;background:#eaf4ef;color:#123f31}button:disabled{opacity:.45;cursor:default}button[aria-selected=true]{background:#145e48;color:white}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #d9e0dd;padding:12px 8px}small,.hint{color:#50655e}#message{border-left:5px solid #145e48;padding:10px;background:#eaf4ef;min-height:28px}textarea{box-sizing:border-box;width:100%;height:400px;font:14px monospace}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}.tag{font-weight:650}a{color:#145e48}label{display:inline-block}#walkthrough button{display:inline-block}.warning{font-weight:650;color:#784509}
</style>
<h1>Clean the list · throwaway spike</h1>
<p>Can live, configurable groups support assignment and duplicate labels while cases arrive or leave? Explore what changes, what stays saved, and which actions should be refused.</p>
<p class="warning">FGP-1594 · synthetic data · all changes stay in memory and disappear on reload. This is a behaviour demo, not the final interface.</p>
<div id="message" role="status" aria-live="polite">Select a group or start a walkthrough.</div>
<section><h2>Explore</h2><button id="reset">Reset all cases</button><button id="add">Add a matching application</button><button id="exclude">Withdraw a case</button><p class="hint">Arrival and withdrawal simulate changes made elsewhere. They are not dedupe actions in the final feature.</p></section>
<section><h2>Guided walkthroughs</h2><div id="tabs" role="tablist" aria-label="Walkthroughs"></div><div id="walkthrough"></div></section>
<section><h2 id="heading"></h2><div id="summary"></div></section>
<section><h2>Group detail</h2><div id="detail"></div></section>
<section><h2>Saved state</h2><p id="stored"></p><div id="history"></div><details><summary>Full state for technical inspection</summary><pre id="state"></pre></details></section>
<details><summary>Edit the page configuration</summary><p>Change the stage to REVIEW_OFFER to see scope change, or add a grouping entry such as {"name":"status","value":"$case.currentStatus"}. Changing key names also requires updating data paths.</p><textarea id="configuration" aria-label="Page configuration"></textarea><button id="apply">Apply configuration</button></details>
<script type="module">
${core}
${seeds}
const initialConfig = ${config};
let config = compileConfig(initialConfig);
let state = { cases: seed(), aggregates: [] };
let selectedHash;
let scenario = 0;
let step = 0;
const $ = (id) => document.getElementById(id);
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const message = (text) => { $('message').textContent = text; };
const allRows = () => buildRows(groupCases(state.cases, config), state.aggregates, config, false);
const selected = async () => { const rows = await allRows(); return rows.find((row) => row.keyHash === selectedHash) ?? rows.find((row) => row.key.sbi === '244666513') ?? rows[0]; };
const reset = () => { state = {cases:seed(),aggregates:[]};config=compileConfig(initialConfig);selectedHash=undefined;$('configuration').value=JSON.stringify(config,null,2); };
const save = async (labels, assignee = 'spike-user') => { state = applyMemorySave(state, await selected(), {assignee,labels},config,users); };
const complete = () => save({'300241':{code:'NOT_DUPLICATE'},'300242':{code:'DUPLICATE',data:{duplicateOf:'300241'}}});
const arrive = () => { state.cases.push(makeCase(String(300260 + state.cases.length), '244666513')); };
const withdraw = () => { const kase = state.cases.find((item) => item.caseRef === '300241'); kase.currentStatus = 'APPLICATION_WITHDRAWN'; };
const scenarios = [
 {name:'Completion and arrival',intro:'Start with two active applications and one rejected. Assign the issue, label both applications, then see a new arrival reopen it.',steps:[['Label the first case',()=>save({'300241':{code:'NOT_DUPLICATE'}})],['Label the second case',complete],['Add a matching application',arrive]]},
 {name:'Historical duplicate target',intro:'Complete the group, then withdraw the case the duplicate label refers to. The label stays as history, but the group leaves the summary. Its detail is still open.',steps:[['Complete this group',complete],['Withdraw the original application',withdraw],['Save the historical label unchanged',()=>save({'300242':{code:'DUPLICATE',data:{duplicateOf:'300241'}}})]]},
 {name:'Invalid save',intro:'Try assigning an owner while marking a case as a duplicate of itself. The whole save must fail, leaving no owner or label saved.',steps:[['Try a duplicate pointing to itself',()=>save({'300241':{code:'DUPLICATE',data:{duplicateOf:'300241'}}})]]},
];
const run = async (action, success='State updated.') => { try { await action();message(success); } catch(error){ message('Save refused: '+error.message); } await render(); };
const render = async () => {
 const rows = await allRows();
 const visible = rows.filter((row)=>row.activeCases.length>=2);
 $('heading').textContent=visible.filter((row)=>row.status.tag==='COMPLETED').length+' of '+visible.length+' issues completed';
 $('summary').innerHTML='<table><thead><tr><th>Issue</th><th>Who</th><th>Status</th></tr></thead><tbody>'+visible.map((row)=>'<tr><td><button data-group="'+row.keyHash+'">'+escape(row.columns.details[0].text)+'</button><br><small>'+escape(row.columns.details[1].text)+'</small></td><td>'+escape(row.owner?.name??'Not set')+'</td><td class="tag">'+escape(row.status.tag.replaceAll('_',' '))+'</td></tr>').join('')+'</tbody></table>';
 document.querySelectorAll('[data-group]').forEach((button)=>button.onclick=()=>run(()=>{selectedHash=button.dataset.group;},'Group opened.'));
 const row = await selected();
 if(row){
  selectedHash=row.keyHash;
  $('detail').innerHTML='<h3>'+escape(row.columns.details[0].text)+'</h3><p>'+row.cases.length+' applications; '+row.activeCases.length+' active. '+(row.activeCases.length<2?'This group is hidden from the summary.':'')+'</p><label>Issue owner <select id="owner"><option value="">Not set</option>'+users.map((user)=>'<option value="'+user.id+'" '+(row.owner?.id===user.id?'selected':'')+'>'+escape(user.name)+'</option>').join('')+'</select></label><table><thead><tr><th>Case ID</th><th>Status</th><th>Label</th></tr></thead><tbody>'+row.cases.map((kase)=>{
   const excluded=!row.activeCases.includes(kase);const label=labelFor(kase,config);const options=labelOptions(row,kase,config);const current=label?JSON.stringify({code:label.code,...(Object.keys(label.data??{}).length?{data:label.data}:{})}):'';
   if(label&&!options.some((option)=>option.value===current))options.push({value:current,text:label.code+' with '+(label.data?.duplicateOf??'')+' (historical target)'});
   return '<tr><td>'+escape(kase.caseRef)+'</td><td>'+escape(kase.currentStatus)+(excluded?' (excluded)':'')+'</td><td><select aria-label="Label for '+kase.caseRef+'" data-case="'+kase.caseRef+'" '+(excluded?'disabled':'')+'>'+options.map((option)=>'<option value="'+escape(option.value)+'" '+(option.value===current?'selected':'')+'>'+escape(option.text)+'</option>').join('')+'</select></td></tr>';
  }).join('')+'</tbody></table><button id="save">Save and continue</button>';
  $('save').onclick=()=>run(async()=>{const labels=Object.fromEntries([...document.querySelectorAll('[data-case]:not(:disabled)')].map((input)=>[input.dataset.case,input.value?JSON.parse(input.value):null]));state=applyMemorySave(state,row,{assignee:$('owner').value||null,labels},config,users);},'Owner and changed labels saved together.');
 } else {$('detail').textContent='No groups in this scope.';}
 $('stored').textContent=state.aggregates.length+' saved group assignments; '+state.cases.reduce((sum,kase)=>sum+kase.labels.length,0)+' saved labels. Membership and status are calculated live.';
 $('history').innerHTML='<ul>'+state.cases.flatMap((kase)=>kase.timeline.map((event)=>'<li>Case '+escape(kase.caseRef)+': '+escape(event.data.oldLabel?.code??'Not set')+' → '+escape(event.data.newLabel?.code??'Not set')+'; '+escape(event.createdBy)+' at '+escape(event.createdAt)+'</li>')).join('')+'</ul>';
 $('state').textContent=JSON.stringify(state,null,2);
 $('tabs').innerHTML=scenarios.map((item,index)=>'<button role="tab" aria-selected="'+(scenario===index)+'" data-scenario="'+index+'">'+item.name+'</button>').join('');
 document.querySelectorAll('[data-scenario]').forEach((button)=>button.onclick=()=>run(()=>{scenario=Number(button.dataset.scenario);step=0;reset();},'Walkthrough reset.'));
 $('walkthrough').innerHTML='<p>'+scenarios[scenario].intro+'</p>'+scenarios[scenario].steps.map(([title],index)=>'<button data-step="'+index+'" '+(index!==step?'disabled':'')+'>'+(index+1)+'. '+title+'</button>').join('');
 document.querySelectorAll('[data-step]').forEach((button)=>button.onclick=()=>run(async()=>{const action=scenarios[scenario].steps[step++][1];await action();}));
};
$('reset').onclick=()=>run(()=>{reset();step=0;},'All synthetic cases reset.');
$('add').onclick=()=>run(arrive,'A matching application arrived.');
$('exclude').onclick=()=>run(withdraw,'The original application was withdrawn elsewhere.');
$('apply').onclick=()=>run(()=>{config=compileConfig(JSON.parse($('configuration').value));selectedHash=undefined;},'Configuration applied. Groups recalculated.');
reset();await render();
</script></html>`;
await writeFile(new URL("demo.html", here), page);
process.stdout.write(
  "Created src/cases/prototypes/fgp-1594/demo.html — open directly in a browser.\n",
);
