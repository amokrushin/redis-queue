local queue_key = '${ joinKey(keyPrefix, keyQueue) }'
local store_key = '${ joinKey(keyPrefix, keyStore) }'
local seq_key = '${ joinKey(keyPrefix, keySeq) }'
local message = ARGV[1]

local message_id = redis.call('incr', seq_key)
redis.call('hset', store_key, message_id, message)
redis.call('lpush', queue_key, message_id)

return message_id
