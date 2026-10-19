// In-process event bus. Domain code emits events (issue_created, issue_updated, comment_created, ...)
// and the automation engine and outgoing webhooks subscribe. Listeners run synchronously so that
// automation results are part of the same request (and its live-update broadcast); listeners must not throw.
const listeners = [];
function on(fn) { listeners.push(fn); }
function emit(event, data) {
  for (const fn of listeners) {
    try { fn(event, data); } catch (e) { console.error('hook listener failed', event, e); }
  }
}
module.exports = { on, emit };
