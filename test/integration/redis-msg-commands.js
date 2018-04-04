const test = require('tape-async');
const assert = require('assert');
const Redis = require('ioredis');
const lua = require('../../libs/lua');

assert(process.env.NODE_ENV, 'test');

const redis = new Redis({
    host: process.env.REDIS_HOST,
    retryStrategy: () => false,
});

const luaContext = {
    keyPrefix: '',
    keyQueue: 'items:queue',
    keySeq: 'seq',
    keyStore: 'items:store',
    keyProcessingItems: 'items:processing',
    keyNackedItems: 'items:nacked',
    joinKey: (...args) => args.filter(v => v).join(':'),
};

test('connect', (t) => {
    redis.once('connect', () => {
        t.pass('done');
        t.end();
    });
    redis.once('error', (err) => {
        console.error(err.message);
        process.exit(1);
    });
});


test('setup', async (t) => {
    await redis.flushdb();

    redis.defineCommand('msgenqueue', lua.msgenqueue(luaContext));
    redis.defineCommand('msgdequeue', lua.msgdequeue(luaContext));
    redis.defineCommand('msgack', lua.msgack(luaContext));
    redis.defineCommand('msgnack', lua.msgnack(luaContext));
    redis.defineCommand('msgerrors', lua.msgerrors(luaContext));

    t.pass('done');
});

test('enqueue first message', async (t) => {
    const messageId = await redis.msgenqueue('lorem ipsum');

    t.equal(
        messageId,
        1,
        'message id match',
    );
    t.equal(
        await redis.get(luaContext.keySeq),
        '1',
        'redis pk match',
    );
    t.deepEqual(
        await redis.lrange(luaContext.keyQueue, 0, -1),
        ['1'],
        'redis queue match',
    );
    t.deepEqual(
        await redis.hgetall(luaContext.keyStore),
        { 1: 'lorem ipsum' },
        'redis store match',
    );
});

test('enqueue second message', async (t) => {
    const messageId = await redis.msgenqueue('lorem ipsum');

    t.equal(messageId, 2, 'message id match');
    t.equal(
        await redis.get(luaContext.keySeq),
        '2',
        'message id match',
    );
    t.equal(
        await redis.get(luaContext.keySeq),
        '2',
        'redis pk match',
    );
    t.deepEqual(
        await redis.lrange(luaContext.keyQueue, 0, -1),
        ['2', '1'],
        'redis queue match',
    );
    t.deepEqual(
        await redis.hgetall(luaContext.keyStore),
        { 1: 'lorem ipsum', 2: 'lorem ipsum' },
        'redis store match',
    );
});

test('dequeue first message', async (t) => {
    const timestamp = Date.now();
    const [messageId, message] = await redis.msgdequeue(timestamp);

    t.equal(messageId, '1', 'message id match');
    t.equal(message, 'lorem ipsum', 'message value match');

    const res = await redis.msgack(messageId);
    t.deepEqual(res, [1, 1], 'ack response ok');
});

test('dequeue second message', async (t) => {
    const timestamp = Date.now();
    const [messageId, message] = await redis.msgdequeue(timestamp);

    t.equal(messageId, '2', 'message id match');
    t.equal(message, 'lorem ipsum', 'message value match');

    const res = await redis.msgnack(messageId);
    t.deepEqual(res, 1, 'nack response ok');
});

test('ack invalid id', async (t) => {
    const messageId = 1;
    const res = await redis.msgack(messageId);
    t.deepEqual(res, [0, 0], 'ack response ok');
});

test('nack invalid id', async (t) => {
    const messageId = 1;
    const res = await redis.msgnack(messageId);
    t.deepEqual(res, 0, 'nack response ok');
});

test('get errors', async (t) => {
    const res = await redis.msgerrors(10);
    t.deepEqual(res, ['lorem ipsum'], 'errors response ok');
});

test('teardown', async (t) => {
    await redis.quit();
    t.pass('done');
});
