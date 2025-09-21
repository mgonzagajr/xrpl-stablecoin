// IPFS Request Queue to control concurrency
class IPFSQueue {
  private queue: Array<() => Promise<unknown>> = [];
  private running = 0;
  private maxConcurrent = 2; // Limit to 2 concurrent requests
  private delayBetweenRequests = 1000; // 1 second delay between requests

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const fn = this.queue.shift();
    
    if (fn) {
      try {
        await fn();
      } catch (error) {
        console.error('IPFS queue error:', error);
      } finally {
        this.running--;
        
        // Add delay before processing next request
        if (this.queue.length > 0) {
          setTimeout(() => this.process(), this.delayBetweenRequests);
        } else {
          this.process(); // Process immediately if no delay needed
        }
      }
    } else {
      this.running--;
    }
  }

  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      running: this.running,
      maxConcurrent: this.maxConcurrent
    };
  }
}

export const ipfsQueue = new IPFSQueue();
