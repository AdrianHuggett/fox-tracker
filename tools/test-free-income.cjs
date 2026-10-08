// Regression scenarios for the production calculation, using synthetic snapshots.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const between = (a,b) => source.slice(source.indexOf(a), source.indexOf(b));
const code = between('function dayNum(', 'function prettyDay(') +
  between('function packsDelivered(', 'function currentSnapshot(') +
  between('function trimHistory(', 'function freeCell(');
const item = 'Taming Manuals';
const snapshot = (day, have, packs={}) => ({day:'2026-10-'+String(day).padStart(2,'0'), have, packs});
function rate(history, contents={}, name=item) {
  const context = {HIST:history, D:{contents}, FREE_M:{}, FREE_MIN_DAYS:3,
    FREE_WINDOW_DAYS:90, HIST_SPAN:0, HIST_SINCE:'', n:v=>Number(v)||0};
  vm.createContext(context);
  vm.runInContext(code+';recomputeFree()',context);
  return context.FREE_M[name];
}
function close(actual, expected) { assert.ok(Math.abs(actual-expected)<1e-10, `${actual} != ${expected}`); }
const seq = values => values.map((v,i)=>snapshot(i+1,{[item]:v}));
close(rate(seq([10,12,15,17])).rate, 7/3);
assert.equal(rate(seq([10,12,15])), undefined); // No measured figure before three elapsed days.
close(rate([snapshot(1,{[item]:10}),snapshot(7,{[item]:22})]).rate,2); // Missing dates still count.
close(rate(seq([10,12,5,7])).rate,4/3); // Spending does not fabricate the unobserved income.
const contents={1:{[item]:100},2:{[item]:20}};
close(rate([snapshot(1,{[item]:10},{1:2}),snapshot(4,{[item]:10},{})],contents).rate,0);
close(rate([snapshot(1,{[item]:10},{1:2}),snapshot(4,{[item]:16},{})],contents).rate,2);
close(rate([snapshot(1,{[item]:100},{1:2}),snapshot(4,{[item]:1},{})],contents).rate,0);
close(rate([snapshot(1,{[item]:10},{1:2}),snapshot(4,{[item]:36},{2:1})],contents).rate,2);
close(rate([snapshot(1,{[item]:10}),snapshot(4,{[item]:116},{1:1})],contents).rate,2);
for(const speed of ['General Speedups','Training Speedups','Construction Speedups','Research Speedups','Healing Speedups','Expert Skill Learning Speedups']) {
  const h=[snapshot(1,{[speed]:10}),snapshot(4,{[speed]:15},{1:1})];
  close(rate(h,{1:{[speed]:48}},speed).rate,1); // 5 days gained, 2 purchased, 3 free / 3 days.
}
const measured=rate(seq([10,12,15,17]));
assert.equal(measured.earned,7);
assert.equal(measured.span,3);
assert.equal(measured.since,'2026-10-01');
assert.equal(measured.until,'2026-10-04');
console.log('Free income: 15 calculation scenarios and explanation fields passed.');
