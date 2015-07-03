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

    // Require Redis if its not injected
    if (!redis || typeof redis !== 'object') {
        throw new Error('Not connected module Redis.');
    }

    this.queue = {};

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

    var createClient = function () {
       if (this.params.createClient) {
         return this.params.createClient();
        } else {
         return redis.createClient(this.params.port, this.params.host, this.params.options);
       }
    }.bind(this),
    
    onError = function (err) {
        this.log('error', 'Receiver error: ' + err);
    }.bind(this);

    this.receiver  = createClient();
    this.publisher = createClient();

    this.receiver.select(this.params.db);
    this.publisher.select(this.params.db);

    if (this.params.auth) {
        this.receiver.auth(this.params.auth);
        this.publisher.auth(this.params.auth);
    }

    this.receiver.on("error", onError);
    this.publisher.on("error", onError);
    return this;
};
 /*
    *  Ready handler
    *
    * @method ready
    * @param {Function} func redis ready handler
*/
Revent.prototype.ready = function (func) {
    var _self = this;
    _self.receiver.on("ready", onReady);
    _self.publisher.on("ready", onReady);

    var counter = 0;
    function onReady () {
        counter++;
        if(counter == 2) {
            func();
            _self.receiver.on('pmessage', _self._message.bind(_self));
        }
    } 
}    

/*
    *  Message handler
    *
    * @method _message
    * @param {String} pattern channel pattern
    * @param {String} channel channel name
    * @param {String} channel channel name
*/
Revent.prototype._message = function(pattern, channel, message) {
    this.log('debug', 'Received message:\n' + 'pattern: ' + pattern + '\n' + 'channel: ' + channel + '\n' + 'message: ' + message + '\n');

    var _queue = [],
        _channel = channel.match(/([a-z0-9]+)$/);

    _queue = (this.queue[pattern][message]) 
            ? this.queue[pattern][message] 
            : this.queue[pattern];

    if ('all' in this.queue[pattern]) {
        _queue = [].concat(this.queue[pattern]['all'] || [])
                   .concat(this.queue[pattern][message] || []);
    }

    if(Array.isArray(_queue)) {
        _queue.forEach(function(_callback) {
            _callback(message, _channel[0], pattern);
        });
    }
};

/**
 * Subscribe to a channel
 *
 * @method on
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

    if (!this.queue[_key]) {
        this.queue[_key] = (_events.length) ? {} : [];
    }
    if (_events.length) {
        _events.forEach(function(event) {
            if (!this.queue[_key][event]) {
                this.queue[_key][event] = []
            }
            this.queue[_key][event].push(_callback);
        }.bind(this));
    } else {
        this.queue[_key].push(_callback);
    }

    this.receiver.psubscribe(_key);
    this.log('info', 'Subscribe channel:' + _key);
    return this;
};

/**
 * Unsubscribe to a channel
 *
 * @method off 
 * @param {String} channel The channel to subscribe to, can be a pattern e.g. 'user.*'
 * @param {Array} params The array consists of the event name for the unsubscription and callback
 */
Revent.prototype.off = function(channel, params) {
    if (params === undefined || !Array.isArray(params)) {
        throw new Error('Wrong type argument callback.');
    }

    if (typeof params[0] !== 'string' || (params[0] !== 'space' && params[0] !== 'event')) {
        throw new Error('Not the right name for the event. Possible event / space');
    }

    var _callback = params.pop(),
        _key = ['__keyevent@', '__keyspace@'][+(params[0] === 'space')] + this.params.db + '__:' + channel;

    this.receiver.punsubscribe(_key, _callback);
    delete this.queue[_key];

    this.log('info', 'Unsubscribe channel:' + _key);
    return this;
};

/**
 * Publish an Keyevent
 *
 * @method publish
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
 *
 * @method quit
 */
Revent.prototype.quit = function() {
    this.receiver.quit();
    this.publisher.quit();
};

/**
 * Hard connection close
 *
 * @method end
 */
Revent.prototype.end = function(argument) {
    this.receiver.end();
    this.publisher.end();
};

module.exports = Revent;