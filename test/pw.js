// Playwright from the project (npm install) or from a shared install on the machine.
module.exports = (() => {
  for (const p of ['playwright', '/opt/npm-tools/node_modules/playwright']) { try { return require(p); } catch (e) { /* try the next */ } }
  throw new Error('Playwright is not installed. Run: npm install');
})();
