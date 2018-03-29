local processing_key = 'processing'
local error_key = 'error'
local message_id = ARGV[1]

local timestamp = redis.call('zscore', processing_key, message_id)
if timestamp then
    redis.call('zadd', error_key, timestamp, message_id)
end
local t1 = redis.call('zrem', processing_key, message_id)

return t1
