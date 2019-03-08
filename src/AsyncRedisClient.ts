import redis, { RedisClient } from 'redis'

/** Generates a (err,value) callback to resolve/reject a promise */
const cbToPromise = (resolve: any, reject: any) => (err: any, value: any) => {
  if (err) reject(err)
  else resolve(value)
}

/** A redis client wrapper to add typed async commands */
export class AsyncRedisClient {
  protected client?: RedisClient

  constructor(public url: string) {}

  /** Create a promise to create/get the internal client (creating on demand) */
  protected clientPromise(): Promise<RedisClient> {
    if (this.client) return Promise.resolve(this.client)
    return new Promise((resolve, reject) => {
      this.client = redis.createClient(this.url)
      this.client.on('ready', () => resolve(this.client!))
      this.client.on('error', err => reject(err))
    })
  }

  /** redis GET command */
  get(key: string): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
      const client = await this.clientPromise()
      client.get(key, cbToPromise(resolve, reject))
    })
  }

  /** redis SET command */
  set(key: string, value: string) {
    return new Promise(async (resolve, reject) => {
      const client = await this.clientPromise()
      client.set(key, value, cbToPromise(resolve, reject))
    })
  }

  /** redis PUBLISH command */
  publish(key: string, value: string) {
    return new Promise<number>(async (resolve, reject) => {
      const client = await this.clientPromise()
      client.publish(key, value, cbToPromise(resolve, reject))
    })
  }

  /** Close the redis connection, if there is one */
  async close() {
    if (!this.client) return
    await new Promise(resolve => this.client!.quit(() => resolve()))
  }
}
