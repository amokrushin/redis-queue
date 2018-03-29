local queue_key = 'queue'
local store_key = 'store'
local id_key = 'pk'
local message = ARGV[1]

local message_id = redis.call('incr', id_key)
redis.call('hset', store_key, message_id, message)
redis.call('lpush', queue_key, message_id)

return message_id
