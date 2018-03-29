local queue_key = 'queue'
local store_key = 'store'
local processing_key = 'processing'
local timestamp = ARGV[1]

local message_id = redis.call('rpop', queue_key)

if message_id then
    redis.call('zadd', processing_key, timestamp, message_id)
    local message = redis.call('hget', store_key, message_id)
    return { message_id, message }
else
    return nil
end
