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

const searchCalls = { create: 0 };
const stubs = {
  record: { submitFields: () => {} },
  search: {
    create: () => {
      searchCalls.create++;
      return { run: () => ({ getRange: () => [] }) };
    },
  },
  query: {},
};

const mod = loadModule(stubs);
mod.assignItemToEANNumber(123, null);
assert.strictEqual(searchCalls.create, 0, 'search.create should not be called when eanNumber is falsy');
console.log('assignItemToEANNumber tests passed');
