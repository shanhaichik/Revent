var redis = require('redis'),
    extend = require('extend'),
    log4js = require('log4js'),
    log = log4js.getLogger();

function logger(state) {
    var state = state;
    return function(type, message) {
        if (state) {
            log[type](message);
        }
    }
}

/**
 * Redis Event Subscriber
 * Subscribe to Redis Keyspace and Keyevent notification
 * @param config
 * @constructor
 */
function Revent(config) {
    if (!(this instanceof Revent)) {
        return new Revent(config);
    }

    //Require Redis if its not injected
    if (!redis || typeof redis !== 'object') {
        throw new Error('Not connected module Redis.');
    }

    this.params = extend(true, {
        host: 'localhost',
        port: 6379,
        db: 0,
        options: {},
        logger: false
    }, config || {});

    // config log
    this.log = logger(this.params.logger);
    this.log('info', 'Start init params: ' + JSON.stringify(this.params));

    this.receiver = redis.createClient(
        this.params.port,
        this.params.host,
        this.params.options);

    this.publisher = redis.createClient(
        this.params.port,
        this.params.host,
        this.params.options);

    this.receiver.select(this.params.db);
    this.publisher.select(this.params.db);

    if (this.params.auth) {
        this.receiver.auth(this.params.auth);
        this.publisher.auth(this.params.auth);
    }

    this.receiver.on("error", function(err) {
        this.log('error', 'Receiver error: ' + err);
    }.bind(this));

    this.publisher.on("error", function(err) {
        this.log('error', 'Publisher error: ' + err);
    }.bind(this));

    return this;
};

/**
 * Subscribe to a channel
 * @param {String} channel The channel to subscribe to, can be a pattern e.g. 'user.*'
 * @param {Array} params The array consists of the event name for the subscription and callback
 */
Revent.prototype.on = function(channel, params) {
    if (params === undefined || !Array.isArray(params)) {
        throw new Error('Wrong type argument callback.');
    }

    var _callback = params.pop(),
        _events = params,
        _key = ['__keyevent@', '__keyspace@'][+!!params.length] + this.params.db + '__:' + channel;

    this.receiver.on('pmessage', function(pattern, _channel, message) {
        console.log(pattern, _channel, message)
        if (pattern === _key) {
            this.log('debug',
                'Received message:\n' + 'pattern: ' + pattern + '\n' + 'channel: ' + _channel + '\n' + 'message: ' + message);

            if (_events.length && !!~_events.indexOf(message)) {
                _callback(message, _channel);
            } else if (_events[0] === 'all') {
                _callback(message, _channel);
            } else if (!_events.length) {
                _callback(message, _channel);
            }
        }
    }.bind(this));

    this.receiver.psubscribe(_key);
    this.log('info', 'Subscribe channel:' + _key);
    return this;
};

/**
 * Unsubscribe to a channel
 * @param {String} channel The channel to subscribe to, can be a pattern e.g. 'user.*'
 * @param {Array} params The array consists of the event name for the unsubscription and callback
 */
Revent.prototype.off = function(channel, params) {
    if (params === undefined || !Array.isArray(params)) {
        throw new Error('Wrong type argument callback.');
    }

    if (typeof params[0] !== 'string' || (params[0] !== 'space' || params[0] !== 'event')) {
        throw new Error('Not the right name for the event. Possible event / space');
    }

    var _callback = params.pop(),
        _key = ['__keyevent@', '__keyspace@'][+(params[0] === 'space')] + this.params.db + '__:' + channel;

    this.receiver.punsubscribe(_key, _callback);
    this.log('info', 'Unsubscribe channel:' + _key);
    return this;
};

/**
 * Publish an Keyevent
 * @param {String} channel Channel on which to emit the message
 * @param {Object|String} message 
 */
Revent.prototype.publish = function(channel, message) {
    if (typeof message === "object" && message !== null) {
        try {
            message = JSON.stringify(message);
        } catch (e) {
            this.log('error', 'Prepare publish message:' + e);
        }
    }
    this.publisher.publish('__keyevent@' + this.params.db + '__:' + channel, message);
};

/**
 * Safely connection close
 */
Revent.prototype.quit = function() {
    this.receiver.quit();
    this.publisher.quit();
};

/**
 * Hard connection close
 */
Revent.prototype.end = function(argument) {
    this.receiver.end();
    this.publisher.end();
};

module.exports = Revent;