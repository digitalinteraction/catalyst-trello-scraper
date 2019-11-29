import redis, { RedisClient } from 'redis'
import { promisify } from 'util'

export function promisifiedRedis(url: string) {
  const client = redis.createClient(url)

  return {
    get: promisify(client.get).bind(client),
    set: promisify(client.set).bind(client),
    publish: promisify(client.publish).bind(client),
    quit: promisify(client.quit).bind(client)
  }
}
