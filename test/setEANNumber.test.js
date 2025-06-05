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

function makeRec(pop, upc) {
  return {
    type: 'inventoryitem',
    id: '100',
    getValue: ({fieldId}) => {
      if (fieldId === 'custitem_4ph_pop_ean_autom') return pop;
      if (fieldId === 'upccode') return upc;
    }
  };
}

// EAN available
(() => {
  const submitted = [];
  let calls = 0;
  const stubs = {
    record: {
      submitFields: (opts) => {
        calls++;
        if (opts.values.upccode) submitted.push(opts.values.upccode);
      },
    },
    search: {
      Sort: { ASC: 'ASC' },
      createColumn: (o) => o,
      create: () => ({ run: () => ({ getRange: () => [ { id:'1', getValue: ()=>'111'} ] }) })
    },
    query: {}
  };
  const mod = loadModule(stubs);
  const ean = mod.setEANNumber(makeRec(true, ''));
  assert.strictEqual(ean, '111');
  assert.deepStrictEqual(submitted, ['111']);
  assert.strictEqual(calls, 2);
})();

// No EAN available
(() => {
  const stubs = {
    record: { submitFields: () => { throw new Error('should not update'); } },
    search: {
      Sort: { ASC: 'ASC' },
      createColumn: (o) => o,
      create: () => ({ run: () => ({ getRange: () => [] }) })
    },
    query: {}
  };
  const mod = loadModule(stubs);
  const ean = mod.setEANNumber(makeRec(true, ''));
  assert.strictEqual(ean, undefined);
})();

// Item already has EAN
(() => {
  const stubs = {
    record: { submitFields: () => { throw new Error('should not update'); } },
    search: { Sort:{ASC:'ASC'}, createColumn:(o)=>o, create: () => ({ run: () => ({ getRange: () => [] }) }) },
    query: {}
  };
  const mod = loadModule(stubs);
  const ean = mod.setEANNumber(makeRec(true, 'existing'));
  assert.strictEqual(ean, undefined);
})();

console.log('setEANNumber tests passed');
