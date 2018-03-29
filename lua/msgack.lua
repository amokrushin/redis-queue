local store_key = 'store'
local processing_key = 'processing'
local message_id = ARGV[1]

local t1 = redis.call('zrem', processing_key, message_id)
local t2 = redis.call('hdel', store_key, message_id)

return { t1, t2 }
