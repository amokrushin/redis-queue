const test = require('tape-async');
const sinon = require('sinon');
const RedisQueue = require('../../libs/RedisQueue');
const { delay } = require('../../libs/async-utils');

const { object } = sinon.match;

test('constructor', (t) => {
    t.equal(typeof RedisQueue, 'function', 'is function');
    t.equal(RedisQueue.name, 'RedisQueue', 'name match');
    t.end();
});

test('instance', (t) => {
    t.throws(() => {
        new RedisQueue();
    }, 'throws error without required "createClient" argument');

    const queue = new RedisQueue(() => {});

    t.equal(typeof queue.enqueue, 'function', 'has enqueue method');
    t.equal(typeof queue.dequeue, 'function', 'has dequeue method');
    t.equal(typeof queue.cancel, 'function', 'has cancel method');

    t.end();
});

test('enqueue redis.* calls', async (t) => {
    const defineCommand = sinon.spy();
    const msgenqueue = sinon.spy();
    const publish = sinon.spy();

    const redis = {
        defineCommand,
        msgenqueue,
        publish,
    };

    const queue = new RedisQueue(() => redis);

    await queue.enqueue('foo');

    t.ok(defineCommand.calledOnce, 'defineCommand called once');
    t.ok(defineCommand.calledWithExactly('msgenqueue', object), 'defineCommand arguments match');

    t.ok(publish.calledOnce, 'publish called once');

    t.ok(msgenqueue.calledOnce, 'msgenqueue called once');
    t.ok(msgenqueue.calledWithExactly('"foo"'), 'msgenqueue arguments match');

    t.ok(defineCommand.calledBefore(msgenqueue), 'defineCommand called before msgenqueue');
    t.ok(msgenqueue.calledBefore(publish), 'msgenqueue called before publish');
});


test('dequeue redis.* calls', async (t) => {
    t.timeoutAfter(1000);

    const defineCommand = sinon.spy();
    const subscribe = sinon.spy();
    const unsubscribe = sinon.spy();
    const msgdequeue = sinon.spy();
    const on = sinon.spy();
    const once = sinon.spy();
    const removeListener = sinon.spy();
    const quit = sinon.spy();

    const redis = {
        defineCommand,
        subscribe,
        unsubscribe,
        on,
        once,
        removeListener,
        msgdequeue,
        quit,
    };

    const queue = new RedisQueue(() => redis);

    queue.dequeue();
    await delay(100);
    queue.cancel();

    t.ok(defineCommand.calledThrice, 'defineCommand called thrice');
    t.ok(defineCommand.firstCall.calledWithExactly('msgdequeue', object), 'defineCommand#1 arguments match');
    t.ok(defineCommand.secondCall.calledWithExactly('msgack', object), 'defineCommand#2 arguments match');
    t.ok(defineCommand.thirdCall.calledWithExactly('msgnack', object), 'defineCommand#3 arguments match');

    t.ok(subscribe.calledOnce, 'subscribe called once');
    t.ok(msgdequeue.calledOnce, 'msgdequeue called once');

    t.ok(defineCommand.calledBefore(msgdequeue), 'defineCommand called before msgdequeue');
});
