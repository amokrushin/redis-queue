const test = require('tape-async');
const sinon = require('sinon');
const RedisQueue = require('../../libs/RedisQueue');
const { delay } = require('../../libs/async-utils');
const Redis = require('ioredis');

const { NM_BLOCKING } = RedisQueue.notificationsModes;

test('setup', async (t) => {
    const redis = new Redis({
        host: process.env.REDIS_HOST,
        retryStrategy: () => false,
    });

    await redis.flushdb();
    await redis.quit();

    t.pass('done');
});

test('one publisher and two subscribers', async (t) => {
    const clients = [];
    const createClient = () => {
        const redis = new Redis({
            host: process.env.REDIS_HOST,
            retryStrategy: () => false,
        });
        redis.once('error', (err) => {
            throw new Error(err);
        });
        clients.push(redis);
        return redis;
    };

    const log = [];

    const createLogger = (name) => ({
        info: (...args) => log.push([name, ...args].join(' ')),
    });

    const publisher = new RedisQueue(createClient, {
        notificationsMode: NM_BLOCKING,
        logger: createLogger('[PUBLISHER]'),
    });

    const subscriberA = new RedisQueue(createClient, {
        notificationsMode: NM_BLOCKING,
        logger: createLogger('[SUBSCRIBER_A]'),
    });

    const subscriberB = new RedisQueue(createClient, {
        notificationsMode: NM_BLOCKING,
        logger: createLogger('[SUBSCRIBER_B]'),
    });

    subscriberA.dequeue();
    await delay(100);
    subscriberA.dequeue();
    await delay(100);
    subscriberB.dequeue();
    await delay(100);
    publisher.enqueue('foo');
    await delay(100);
    publisher.enqueue('bar');
    await delay(100);
    await publisher.enqueue('baz:1');
    await publisher.enqueue('baz:2');

    t.deepEqual(
        log,
        [
            '[SUBSCRIBER_A] waiting for unblocking',
            '[SUBSCRIBER_A] waiting for unblocking',
            '[SUBSCRIBER_B] waiting for unblocking',
            '[PUBLISHER] enqueued foo',
            '[SUBSCRIBER_A] dequeued foo',
            '[PUBLISHER] enqueued bar',
            '[SUBSCRIBER_B] dequeued bar',
            '[PUBLISHER] enqueued baz:1',
            '[SUBSCRIBER_A] dequeued baz:1',
            '[PUBLISHER] enqueued baz:2',
        ],
        'log match',
    );
    await delay(1000);
    clients.forEach((client) => {
        client.quit();
    });
});
