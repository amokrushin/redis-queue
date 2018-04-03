# redis-queue
[![NPM Stable Version][npm-stable-version-image]][npm-url]
[![Build Status][travis-master-image]][travis-url]
[![Test Coverage][codecov-image]][codecov-url-master]
[![Dependency Status][david-image]][david-url-master]
[![Node.js Version][node-version-image]][node-version-url]
[![License][license-image]][license-url]



_WIP_


## Install

```bash
npm i @amokrushin/redis-queue
```


<a id="RedisQueue"></a>
## RedisQueue

* [RedisQueue](#RedisQueue)
    * [new RedisQueue(createClient, [options])](#new+RedisQueue)
    * _instance_
        * [.enqueue(payload)](#RedisQueue+enqueue) ⇒ <code>Promise</code>
        * [.dequeue()](#RedisQueue+dequeue) ⇒ <code>Promise</code>
        * [.cancel()](#RedisQueue+cancel)
    * _static_
        * [.serialize()](#RedisQueue.serialize)
        * [.deserialize()](#RedisQueue.deserialize)


<a id="new+RedisQueue"></a>
### new RedisQueue(createClient, [options])

Creates a RedisQueue instance

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| `createClient` | `function` |  | Function returning Redis instance. |
| `[options.pollTimeout]` | `number` | `10000` | Force subscriber to poll a queue for a new item. Timer restarts every time after new item was enqueued. |
| `[options.notificationsChannel]` | `string` | `__redis-queue_notifications__` |  |


<a id="RedisQueue+enqueue"></a>
### redisQueue.enqueue(payload) ⇒ `Promise<>`

Enqueue new message to a queue.

| Param | Type | Description |
| --- | --- | --- |
| payload | `any` | Any serializable payload. The payload is serialized using the [.serialize()](#RedisQueue.serialize) method. |


<a id="RedisQueue+dequeue"></a>
### redisQueue.dequeue() ⇒ `Promise<Object|null>`

Dequeue message from a queue.

**Returns**: `Promise<Object>`

| Property | Type | Description |
| --- | --- | --- |
| `id` | `string` | Message identyfier |
| `payload` | `any` | The payload deserialized using the [.deserialize()](#RedisQueue.deserialize) method. |
| `ack` | `function` | The function should be called if message processing was failed. |
| `nack` | `function` | The function should be called if message processing was succesful. |




[npm-stable-version-image]: https://img.shields.io/npm/v/@amokrushin/redis-queue.svg
[npm-url]: https://npmjs.com/package/@amokrushin/redis-queue
[travis-master-image]: https://img.shields.io/travis/amokrushin/redis-queue/master.svg
[travis-url]: https://travis-ci.org/amokrushin/redis-queue
[codecov-image]: https://img.shields.io/codecov/c/github/amokrushin/redis-queue/master.svg
[codecov-url-master]: https://codecov.io/github/amokrushin/redis-queue?branch=master
[david-image]: https://img.shields.io/david/amokrushin/redis-queue.svg
[david-url-master]: https://david-dm.org/amokrushin/redis-queue
[node-version-image]: https://img.shields.io/node/v/@amokrushin/redis-queue.svg
[node-version-url]: https://nodejs.org/en/download/
[license-image]: https://img.shields.io/npm/l/@amokrushin/redis-queue.svg
[license-url]: https://raw.githubusercontent.com/amokrushin/redis-queue/master/LICENSE
