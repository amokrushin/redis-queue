local store_key = 'store'
local error_key = 'error'

local message_ids = redis.call('zrange', error_key, 0, -1)
local message_ids_list = unpack(message_ids)
local messages = redis.call('hmget', store_key, message_ids_list)
redis.call('hdel', store_key, message_ids_list)

return messages
