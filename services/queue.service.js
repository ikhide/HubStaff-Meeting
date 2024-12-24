const { queue } = require("async");
const { queueLimit } = require("../config/hubspot.config");
const { goal } = require("../utils");

class QueueService {
  constructor(domain) {
    this.domain = domain;
    this.actions = [];
    this.queue = this.createQueue();
  }

  createQueue() {
    return queue(async (action, callback) => {
      this.actions.push(action);
      if (this.actions.length >= queueLimit) {
        await this.flush();
      }
      callback();
    }, 100000000);
  }

  async flush() {
    if (this.actions.length > 0) {
      await goal(this.actions);
      this.actions = [];
    }
  }

  async drain() {
    if (this.queue.length() > 0) {
      await this.queue.drain();
    }
    await this.flush();
  }
}

module.exports = QueueService;
