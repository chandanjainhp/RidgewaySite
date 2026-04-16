// Event queue - handle incoming events asynchronously
class EventQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  // Enqueue event
  enqueue(event) {
    this.queue.push({
      event,
      timestamp: Date.now(),
      status: 'queued',
    });

    console.log(`[EventQueue] Event queued: ${event.eventId}`);
    return event.eventId;
  }

  // Process queue
  async process(handler) {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      try {
        item.status = 'processing';
        await handler(item.event);
        item.status = 'completed';
        console.log(`[EventQueue] Event processed: ${item.event.eventId}`);
      } catch (error) {
        item.status = 'failed';
        item.error = error.message;
        console.error(`[EventQueue] Event failed: ${item.event.eventId}`, error);
        // Re-queue on failure (implement retry logic as needed)
        this.queue.push(item);
      }
    }

    this.processing = false;
  }

  // Get queue status
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      items: this.queue.map(item => ({
        eventId: item.event.eventId,
        status: item.status,
      })),
    };
  }
}

module.exports = EventQueue;
