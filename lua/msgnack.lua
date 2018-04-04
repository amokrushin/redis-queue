local processing_items_key = '${ joinKey(keyPrefix, keyProcessingItems) }'
local nacked_items_key = '${ joinKey(keyPrefix, keyNackedItems) }'
local message_id = ARGV[1]

local timestamp = redis.call('zscore', processing_items_key, message_id)
if timestamp then
    redis.call('zadd', nacked_items_key, timestamp, message_id)
end
local t1 = redis.call('zrem', processing_items_key, message_id)

return t1
