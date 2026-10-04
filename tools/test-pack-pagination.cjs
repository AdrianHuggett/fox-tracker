// Exercise the production loader against Supabase-style capped responses.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
const loader = source.slice(source.indexOf('async function loadPackContents(){'), source.indexOf('async function loadAll(){'));
async function check(total, cap, failAt, emptyAt) {
  const calls = [];
  const expected = Array.from({length: total}, (_, i) => ({pack_id: Math.floor(i / 8), item: 'item-' + i, qty: i}));
  const SB = {from(table) {
    assert.equal(table, 'pack_contents');
    const orders = [];
    return {
      select(columns, options) { assert.equal(columns, '*'); assert.equal(options.count, 'exact'); return this; },
      order(key) { orders.push(key); return this; },
      range(first, last) {
        assert.deepEqual(orders, ['pack_id', 'item']);
        calls.push(first);
        if (first === failAt) return Promise.resolve({data: null, error: {message: 'offline'}});
        return Promise.resolve({data: first === emptyAt ? [] : expected.slice(first, Math.min(last + 1, first + cap)), count: total, error: null});
      }
    };
  }};
  const load = vm.runInNewContext(loader + '\nloadPackContents', {SB});
  const result = await load();
  if (failAt !== undefined || emptyAt !== undefined) assert.ok(result.error);
  else {
    assert.equal(result.error, null);
    assert.equal(result.data.length, total);
    assert.equal(JSON.stringify(result.data), JSON.stringify(expected));
  }
  return calls;
}
(async () => {
  assert.deepEqual(await check(1132, 1000), [0, 500, 1000]);
  assert.deepEqual(await check(1132, 200), [0, 200, 400, 600, 800, 1000]);
  await check(1000, 1000);
  await check(0, 1000);
  await check(1132, 1000, 500);
  await check(1132, 1000, undefined, 500);
  console.log('Pack pagination: 6 scenarios passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
