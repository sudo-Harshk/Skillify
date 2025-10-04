// Deprecated DB helper
// The project was refactored to a stateless architecture. This file remains as a harmless stub
// for compatibility with any lingering imports. Do not use it for new code.

function _throw() {
  throw new Error('DB helper removed: project is stateless. Do not use db/sqlite.js');
}

module.exports = {
  init: _throw,
  insertQuestions: _throw,
  getQuestions: _throw,
  clearQuestionsFor: _throw
};
