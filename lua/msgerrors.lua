local store_key = '${ joinKey(keyPrefix, keyStore) }'
local nacked_items_key = '${ joinKey(keyPrefix, keyNackedItems) }'
local limit = tonumber(ARGV[1])

local message_ids = redis.call('zrange', nacked_items_key, 0, limit - 1)

if next(message_ids) ~= nil then
    local messages = redis.call('hmget', store_key, unpack(message_ids))
    redis.call('hdel', store_key, unpack(message_ids))
    redis.call('zremrangebyrank', nacked_items_key, 0, limit - 1)
    return messages
end

return {}
