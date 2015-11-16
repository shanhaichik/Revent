'use strict';

import redis            from 'redis';
import { assign,
         isUndefined,
         isObject }     from 'lodash';
import { EventEmitter } from 'events'

export default class Revent extends EventEmitter {
  /**
   * Redis Event Subscriber
   * Subscribe to Redis Keyspace and Keyevent notification
   *
   * @param config
   * @constructor
   */
    constructor(config) {
        super();

        this.queue = {};

        const options = assign({
            db: 0,
            options: {}
            messagePattern: null
        }, config || {});

        const createClient = (port = 6379, host = 'localhost', options = {}) => {
            return !isUndefined(options.createClient)
                    ? options.createClient()
                    : redis.createClient(port, host, options);
        };

        this.receiver  = createClient(options.port, options.host, options.options);
        this.publisher = createClient(options.port, options.host, options.options);

        this.receiver.select(options.db);
        this.publisher.select(options.db);
        this.publisher.db_number = this.receiver.db_number = options.db;

        if(!isUndefined(options.auth)) {
            this.receiver.auth(options.auth);
            this.publisher.auth(options.auth);
        }

        this.config(options.messagePattern);
    }
    /**
     * Init
     *
     * @method config
     * @param {String} pattern RexExp pattern for Redis channel
     */
    config(pattern) {
        let counter = 0;
        const onReady = () => {
            counter++;
            if(counter === 2) {
                this.emit('ready');
                this.receiver.on('pmessage', this._onMessage.bind(this, pattern));
            }
        };

        const onError = (err) => {
            this.emit('error', err)
        };

        this.receiver.once("ready", onReady);
        this.publisher.once("ready", onReady);

        this.receiver.on("error", onError);
        this.publisher.on("error", onError);
    }

    /**
     * Subscribe to a channel
     *
     * @method on
     * @param {String} channel The channel to subscribe to, can be a pattern e.g. 'user.*'
     * @param {Array} params The array consists of the event name for the subscription and callback
     */
    on(event, params) {
        if(!Array.isArray(params)) {
            return super.on(event, params);
        }

        const channels = event.split(' '),
              cb       = params.pop(),
              events   = params,
              DB       = this.receiver.db_number;

        const subscribe = (channel) => {
                let type = (events[0] === 'events') ? '__keyevent@' : '__keyspace@',
                    key = `${type}${DB}__:${channel}`;

                if(!this.queue[key]) this.queue[key] = {};

                events.forEach((event) => {
                    if(!this.queue[key][event])
                        this.queue[key][event] = [];

                    this.queue[key][event].push(cb);
                });

            this.receiver.psubscribe(key);
        };

        channels.length
            ? channels.forEach(subscribe)
            : subscribe(channels);

        return this;
    }

    /**
     * Unsubscribe to a channel
     *
     * @method off
     * @param {String} channel The channel to subscribe to, can be a pattern e.g. 'user.*'
     * @param {Array} params The array consists of the event name for the unsubscription and callback
     */
    off(event, params) {
        if(!Array.isArray(params)) {
            return super.off(event, params);
        }

        const  channels = event.split(' '),
               cb       = params.pop(),
               events   = params,
               DB       = this.receiver.db_number;

        const unsubscribe = (channel) => {
            let type = (!!events.length && events[0] === 'events') ? '__keyevent@' : '__keyspace@',
                key = `${type}${DB}__:${channel}`;

            if(this.queue[key]) {
                this.receiver.punsubscribe(key);
                delete this.queue[key];
                cb(events, key);
            }
        };

        channels.length
            ? channels.forEach(unsubscribe)
            : unsubscribe(channels);

        return this;
    }

    /**
     * Publish an Keyevent
     *
     * @method send
     * @param {String} channel Channel on which to emit the message
     * @param {Object|String} message
     */
    send(channel, message) {
        try {
            const data = isObject(message) ?  JSON.stringify(message) :  message;
            this.publisher.publish(`__keyevent@${this.publisher.db_number}__:${channel}`, data);
        }
        catch (e) {
            throw `Publish Error: ${e}`;
        }

        return this;
    }

    /*
       *  Message handler
       *
       * @method _onMessage
       * @param {String} mpattern RegExp for channel match
       * @param {String} pattern Channel pattern
       * @param {String} channel Channel name
       * @param {String} message Channel message from Redis
   */
    _onMessage(mpattern, pattern, channel, message) {
        let channelID = mpattern ? channel.match(mpattern) : channel.split(":");

        (this.queue[pattern][message]
                ? this.queue[pattern][message]
                : this.queue[pattern]['events']
                    ? this.queue[pattern]['events']
                    : []
        ).forEach((cb) => {
            cb(message, channelID, pattern);
        });
    }

    /**
     * Safely connection close
     *
     * @method quit
     */
    close() {
        this.receiver.quit();
        this.publisher.quit();
    }

    /**
     * Hard connection close
     *
     * @method end
     */
    end() {
        this.receiver.end();
        this.publisher.end();
    }

    /**
     * Redis commands
     *
     * @method command
     * @return {Object} Return Redis publisher client instance
     */
    command() {
        return this.publisher;
    }

    static create(config) {
        return new Revent(config);
    }
}
