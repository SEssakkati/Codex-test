const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function loadModule(stubs) {
  const module = { exports: {} };
  global.define = (deps, factory) => {
    module.exports = {};
    factory(stubs.record, stubs.search, stubs.query);
  };
  global.module = module;
  global.log = { error: () => {}, audit: () => {} };
  vm.runInThisContext(fs.readFileSync('./4ph_ue_item_ addapted V2.js', 'utf8'), {
    filename: 'script.js',
  });
  delete global.module;
  delete global.define;
  return module.exports;
}

// Case: available EAN
(() => {
  const submitCalls = [];
  const stubs = {
    record: { submitFields: (opts) => { submitCalls.push(opts.id); } },
    search: {
      Sort: { ASC: 'ASC' },
      createColumn: (o) => o,
      create: () => ({
        run: () => ({
          getRange: () => [ { id: '1', getValue: () => 'EAN1' } ]
        })
      })
    },
    query: {}
  };
  const mod = loadModule(stubs);
  const result = mod.getAndReserveUniqueEAN();
  assert.deepStrictEqual(result, { id: '1', eanNumber: 'EAN1' });
  assert.strictEqual(submitCalls.length, 1);
})();

// Case: first reserved fails then next succeeds
(() => {
  const submitCalls = [];
  const stubs = {
    record: { submitFields: (opts) => {
      submitCalls.push(opts.id);
      if (opts.id === '1') throw new Error('fail');
    } },
    search: {
      Sort: { ASC: 'ASC' },
      createColumn: (o) => o,
      create: () => ({
        run: () => ({
          getRange: () => [
            { id: '1', getValue: () => 'EAN1' },
            { id: '2', getValue: () => 'EAN2' }
          ]
        })
      })
    },
    query: {}
  };
  const mod = loadModule(stubs);
  const result = mod.getAndReserveUniqueEAN();
  assert.deepStrictEqual(result, { id: '2', eanNumber: 'EAN2' });
  assert.deepStrictEqual(submitCalls, ['1','2']);
})();

// Case: no available EAN
(() => {
  const stubs = {
    record: { submitFields: () => { throw new Error('should not be called'); } },
    search: {
      Sort: { ASC: 'ASC' },
      createColumn: (o) => o,
      create: () => ({ run: () => ({ getRange: () => [] }) })
    },
    query: {}
  };
  const mod = loadModule(stubs);
  const result = mod.getAndReserveUniqueEAN();
  assert.strictEqual(result, null);
})();

console.log('getAndReserveUniqueEAN tests passed');
