const assert = require('assert');
const Watchdog = require('@amokrushin/watchdog');
const defaults = require('lodash.defaults');
const lua = require('./lua');

const noop = () => {};
const joinKey = (...args) => args.filter(v => v).join(':');
const inRange = (number, min, max) => (number >= min && number <= max);

const NM_POLLING = 'polling';
const NM_BLOCKING = 'blocking';

class RedisQueue {
    constructor(createClient, options) {
        assert.equal(
            typeof createClient,
            'function',
            'createClient argument must be a function',
        );

        this._options = defaults(
            options,
            this.constructor.defaultOptions,
        );

        assert.ok(
            this._options.pollTimeout > 0,
            'pollTimeout value must be greater than 0',
        );

        assert.ok(
            typeof this._options.notificationsChannel === 'string' && this._options.notificationsChannel,
            'notificationsChannel value must be non empty string',
        );

        // TODO: assert options.key*

        this._createClient = createClient;
        this._serialize = this.constructor.serialize;
        this._deserialize = this.constructor.deserialize;
        this._publisherInitialized = false;
        this._subscriberInitialized = false;
        this._luaContext = { ...this._options, joinKey };

        this._isActive = false;

        this._blocking = null;

        this._onPubsubMessage = this._onPubsubMessage.bind(this);
    }

    async enqueue(payload) {
        const { notificationsMode, notificationsChannel, keyNotifications, logger } = this._options;

        if (!this._publisherInitialized) {
            this._initPublisher();
        }

        await this._redis.msgenqueue(this._serialize(payload));

        switch (notificationsMode) {
            case NM_POLLING:
                await this._redis.publish(notificationsChannel, '');
                break;
            case NM_BLOCKING:
                await this._redis.lpush(keyNotifications, 'x');
                break;
            default:
        }

        logger.info('enqueued', payload);
    }

    async dequeue() {
        const { notificationsMode, logger } = this._options;

        if (!this._subscriberInitialized) {
            this._initSubscriber();
        }
        if (!this._isActive && notificationsMode === NM_POLLING) {
            this._startWatchdog();
        }
        this._isActive = true;
        /*
         * Start infinite async loop until "cancel" method will not be called
         */
        while (this._isActive) {
            const res = await this._dequeue();
            if (res) {
                logger.info('dequeued', res.payload);
                return res;
            }
            switch (notificationsMode) {
                case NM_POLLING:
                    await this._waitForEvent();
                    break;
                case NM_BLOCKING:
                    await this._waitForUnblock();
                    break;
                default:
            }
        }
        return null;
    }

    cancel() {
        const { notificationsMode } = this._options;

        this._isActive = false;

        switch (notificationsMode) {
            case NM_POLLING:
                this._stopWatchdog();
                break;
            case NM_BLOCKING:
                if (this._blocking) {
                    this._blocking.quit();
                    this._blocking = null;
                }
                break;
            default:
        }
    }

    async getNackedItems(params = {}) {
        assert.ok(
            typeof params === 'object',
            'params must be an object',
        );
        const { limit } = defaults(params, { limit: 100 });
        assert(
            inRange(limit, 1, 100),
            'limit must be in range [1,100]',
        );

        const redis = this._createClient({ ref: Symbol.for('nonblocking') });
        redis.defineCommand('msgerrors', lua.msgerrors(this._luaContext));

        const erroredMessages = await redis.msgerrors(limit);

        redis.quit();

        return erroredMessages.map(this.constructor.deserialize);
    }

    // eslint-disable-next-line class-methods-use-this
    quit() {
        throw new Error('RedisQueue may use shared a connections, so a quit method is not implemented');
    }

    async _dequeue() {
        const timestamp = Date.now();
        const res = await this._redis.msgdequeue(timestamp);

        /*
         * Return early if queue is empty
         */
        if (!res) {
            return null;
        }

        const [id, raw] = res;
        const payload = this._deserialize(raw);

        const ack = () => this._redis.msgack(id);
        const nack = () => this._redis.msgnack(id);

        return { id, payload, ack, nack };
    }

    async _waitForEvent() {
        /*
         * Return early if dequeue canceled
         */
        if (!this._isActive) {
            return null;
        }
        /*
         * Race condition: pubsub emits 'message' either watchdog emits 'trigger', who'll be the first?
         */
        return new Promise((resolve) => {
            const pubsub = this._pubsub;
            const watchdog = this._watchdog;
            const { logger, notificationsChannel } = this._options;

            function onMessage(msgChannel) {
                if (msgChannel !== notificationsChannel) return;
                logger.info('notification received');
                next();
            }

            function onWatchdog() {
                logger.info('watchdog event received');
                next();
            }

            function next() {
                logger.info('next');
                pubsub.removeListener('message', onMessage);
                watchdog.removeListener('trigger', onWatchdog);
                watchdog.removeListener('cancel', onWatchdog);
                resolve();
            }

            logger.info('waiting for pubsub or watchdog event');
            pubsub.once('message', onMessage);
            watchdog.once('trigger', onWatchdog);
            watchdog.once('cancel', onWatchdog);
        });
    }

    async _waitForUnblock() {
        /*
         * Return early if dequeue canceled
         */
        if (!this._isActive) {
            return null;
        }

        const blocking = this._blocking;
        const { logger, keyNotifications, blockTimeout } = this._options;

        logger.info('waiting for unblocking');
        await blocking.brpop(keyNotifications, blockTimeout);

        return null;
    }

    _initPublisher() {
        if (!this._redis) {
            this._redis = this._createClient({ ref: Symbol.for('nonblocking') });
        }
        this._redis.defineCommand('msgenqueue', lua.msgenqueue(this._luaContext));
        this._publisherInitialized = true;
    }

    _initSubscriber() {
        const { notificationsMode } = this._options;

        if (!this._redis) {
            this._redis = this._createClient({ ref: Symbol.for('nonblocking') });
        }
        this._redis.defineCommand('msgdequeue', lua.msgdequeue(this._luaContext));
        this._redis.defineCommand('msgack', lua.msgack(this._luaContext));
        this._redis.defineCommand('msgnack', lua.msgnack(this._luaContext));
        this._subscriberInitialized = true;

        switch (notificationsMode) {
            case NM_POLLING:
                break;
            case NM_BLOCKING:
                this._blocking = this._createClient({ ref: Symbol('blocking') });
                break;
            default:
        }
    }

    _onPubsubMessage(channel) {
        if (channel !== this._options.notificationsChannel) return;
        this._watchdog.reset();
    }

    _startWatchdog() {
        const { pollTimeout } = this._options;
        this._pubsub = this._createClient({ ref: Symbol.for('subscriber') });
        this._watchdog = new Watchdog({
            timeout: pollTimeout,
            continuous: true,
        });
        this._pubsub.on('message', this._onPubsubMessage);
        this._pubsub.subscribe(this._options.notificationsChannel);
    }

    _stopWatchdog() {
        this._pubsub.unsubscribe(this._options.notificationsChannel);
        this._pubsub.removeListener('message', this._onPubsubMessage);
        this._pubsub.quit();
        this._watchdog.cancel();
        this._watchdog = null;
    }

    static serialize(data) {
        return JSON.stringify(data);
    }

    static deserialize(data) {
        return JSON.parse(data);
    }
}

RedisQueue.defaultOptions = {
    name: '',
    keyPrefix: 'redis-queue',
    keyQueue: 'items:queue',
    keySeq: 'seq',
    keyStore: 'items:store',
    keyProcessingItems: 'items:processing',
    keyNackedItems: 'items:nacked',
    keyNotifications: 'notifications',
    logger: { info: noop },
    pollTimeout: 10000,
    blockTimeout: 10000,
    notificationsChannel: '__redis-queue_notifications__',
    notificationsMode: NM_POLLING, // pubsub or blocking
};

RedisQueue.notificationsModes = {
    NM_POLLING,
    NM_BLOCKING,
};

module.exports = RedisQueue;
