local store_key = '${ joinKey(keyPrefix, keyStore) }'
local processing_items_key = '${ joinKey(keyPrefix, keyProcessingItems) }'
local message_id = ARGV[1]

local t1 = redis.call('zrem', processing_items_key, message_id)
local t2 = redis.call('hdel', store_key, message_id)

return { t1, t2 }
