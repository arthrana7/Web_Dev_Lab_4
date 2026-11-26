const EventEmitter = require('events');

// Exported singleton instance of EventEmitter
const appEvents = new EventEmitter();

module.exports = appEvents;
