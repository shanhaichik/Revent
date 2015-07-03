# Revent
==========
Redis pub/sub module for NodeJS

## Dear friends, if you find any bugs or you will have suggestions, I'll tell you very much. And you plus one in karma;)

## Install

`npm i -S reventjs`

Note: You must explicitly install redis and log4js as a dependency.

## Config
```js
{
	host: '127.0.0.1',
    port: 6379,
    db: 0,
    options: {// redis oprions},
    logger: false
}
```


## Usage
### Subscribe
```js
var Revent = require('reventjs');
var sub = Revent(config.redis);

sub.ready(function() {
	sub
		// Keyspace All 
		.on('hello:*', ['all', function(data, channel, pattern) {
			console.log(data, channel,'all');
		}])
		// Keyspace keys
		.on('hello:*',['expired','del', function(data, channel, pattern) {
			console.log(data, channel,'space');
		}])
		// Keyevents
		// On Keyevents subscribe if no keys, only callback
		.on('hello:*',[function(data, channel, pattern) {
			console.log(data, channel,'event');
		}]);
});

```

### Options
channel | keys / callback 
--------|----------------
Сhannel name for subscribe | List of key events of interest and callback for them. If you need all the set key `all`. 


### Unsubscribe
```js
	// space - Keyspace
	// event - Keyevent
	sub.off('hello:*',['space', function () {
		console.log('unsubscribe hello:*');
	}]);

```

### Options
channel | event type / callback 
--------|----------------------
Сhannel name for unsubscribe | Event type `space/event` and callback for them.


### Publish
```js
	// event - Keyevent
	sub.publish('hello:*',{name:'Peter'});
```

### Options
channel | message 
--------|----------------------
Сhannel name for unsubscribe | Publish message `{Object | String}`



###Just in case
To catch errors without server crashes, you can use:
```js

process.on('uncaughtException', function (err) {
	console.error((new Date).toUTCString() + ' Exception:', err.message)
	console.error(err.stack)
});

```


## Important
Do not forget to set up Redis and add to redis.conf line:

 `--notify-keyspace-events <options>`

  - K     Keyspace events, published with __keyspace@<db>__ prefix.
  - E     Keyevent events, published with __keyevent@<db>__ prefix.
  - g     Generic commands (non-type specific) like DEL, EXPIRE, RENAME, ...
  - $     String commands
  - l     List commands
  - s     Set commands
  - h     Hash commands
  - z     Sorted set commands
  - x     Expired events (events generated every time a key expires)
  - e     Evicted events (events generated when a key is evicted for maxmemory)
  - A     Alias for g$lshzxe, so that the "AKE" string means all the events.

It is also possible to use the. [view](http://redis.io/topics/notifications)

## Changelog
#### 0.2
- Added ready method
- Fix bug then no subscribe 'all' event
- Mini refactor
- Added custom client support

#### 0.1.2
- Fix bug in Off method
- Changed the process of signing. Removed resubscribe to Radis event
- Add subscribe pattern in event callback
- Change channel name in event callback (теперь передается имя, без паттерна)

#### 0.1

- Initial