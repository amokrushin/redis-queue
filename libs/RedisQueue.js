const assert = require('assert');
const Watchdog = require('@amokrushin/watchdog');
const defaults = require('lodash.defaults');
const lua = require('./lua');

const noop = () => {};

class RedisQueue {
    /*
     * TODO:
     *  - configurable redis keys
     *  - configurable redis keys namespace
     */
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

        this._createClient = createClient;
        this._serialize = this.constructor.serialize;
        this._deserialize = this.constructor.deserialize;
        this._publisherInitialized = false;
        this._startWatchdogrInitialized = false;

        this._isActive = false;

        this._onPubsubMessage = this._onPubsubMessage.bind(this);
    }

    async enqueue(payload) {
        const { notificationsChannel } = this._options;

        if (!this._publisherInitialized) {
            this._initPublisher();
        }

        await this._redis.msgenqueue(this._serialize(payload));
        await this._redis.publish(notificationsChannel, '');
    }

    async dequeue() {
        if (!this._startWatchdogrInitialized) {
            this._initSubscriber();
        }
        if (!this._isActive) {
            this._startWatchdog();
        }
        /*
         * Start infinite async loop until "cancel" method will not be called
         */
        while (this._isActive) {
            const res = await this._dequeue();
            if (res) {
                return res;
            }
            await this._waitForEvent();
        }
        return null;
    }

    cancel() {
        this._stopWatchdog();
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

    _initPublisher() {
        if (!this._redis) {
            this._redis = this._createClient({ ref: Symbol.for('nonblocking') });
        }
        this._redis.defineCommand('msgenqueue', lua.msgenqueue);
        this._publisherInitialized = true;
    }

    _initSubscriber() {
        if (!this._redis) {
            this._redis = this._createClient({ ref: Symbol.for('nonblocking') });
        }
        this._redis.defineCommand('msgdequeue', lua.msgdequeue);
        this._redis.defineCommand('msgack', lua.msgack);
        this._redis.defineCommand('msgnack', lua.msgnack);
        this._startWatchdogrInitialized = true;
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
        this._isActive = true;
    }

    _stopWatchdog() {
        this._isActive = false;
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

    static async getErrors(createClient) {
        const redis = createClient({ ref: Symbol.for('nonblocking') });
        redis.defineCommand('msgerrors', lua.msgerrors);
        return redis.msgerrors();
    }
}

RedisQueue.defaultOptions = {
    logger: { info: noop },
    pollTimeout: 10000,
    notificationsChannel: '__redis-queue_notifications__',
};

module.exports = RedisQueue;
