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
  vm.runInThisContext(fs.readFileSync('./4ph_ue_item_ addapted V2.js', 'utf8'), {
    filename: 'script.js',
  });
  delete global.module;
  return module.exports;
}

const capturedFilters = [];
const stubs = {
  record: { submitFields: () => {} },
  search: {
    Sort: { ASC: 'ASC' },
    Operator: { ISNOTEMPTY: 'isnotempty', ANYOF: 'anyof' },
    createColumn: (opts) => opts,
    createFilter: (opts) => opts,
    create: (opts) => {
      capturedFilters.push(opts.filters);
      return {
        run: () => ({
          getRange: () => [{ id: '1', getValue: () => 'EAN1' }]
        })
      };
    }
  },
  query: {}
};

const mod = loadModule(stubs);
const first = mod.getAndReserveUniqueEAN();
const second = mod.getAndReserveUniqueEAN();

assert.deepStrictEqual(first, { id: '1', eanNumber: 'EAN1' });
assert.deepStrictEqual(second, { id: '1', eanNumber: 'EAN1' });
const expectedFilters = [
  { name: 'name', operator: 'isnotempty' },
  { name: 'custrecord_4ph_item', operator: 'anyof', values: ['@NONE@'] }
];
assert.deepStrictEqual(capturedFilters[0], expectedFilters, 'search filters should match');
console.log('getAndReserveUniqueEAN tests passed');
