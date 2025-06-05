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
  global.log = stubs.log;
  vm.runInThisContext(fs.readFileSync('./4ph_ue_item_ addapted V2.js', 'utf8'), {
    filename: 'script.js',
  });
  delete global.module;
  return module.exports;
}

const logCalls = [];
const stubs = {
  record: {},
  search: {},
  query: {},
  log: {
    error: (title, err) => logCalls.push({ title, err }),
  },
};

const mod = loadModule(stubs);
global.log = stubs.log;

const scriptContext = {
  UserEventType: { CREATE: 'create' },
  type: 'create',
  newRecord: {
    setValue: () => {
      throw new Error('fail');
    },
  },
};

mod.beforeLoad(scriptContext);
delete global.log;
assert.strictEqual(logCalls.length, 1, 'Error should be logged when beforeLoad throws');
console.log('beforeLoad logging test passed');
