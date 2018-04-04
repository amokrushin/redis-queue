local queue_key = '${ joinKey(keyPrefix, keyQueue) }'
local store_key = '${ joinKey(keyPrefix, keyStore) }'
local processing_items_key = '${ joinKey(keyPrefix, keyProcessingItems) }'
local timestamp = ARGV[1]

local message_id = redis.call('rpop', queue_key)

if message_id then
    redis.call('zadd', processing_items_key, timestamp, message_id)
    local message = redis.call('hget', store_key, message_id)
    return { message_id, message }
else
    return nil
end
