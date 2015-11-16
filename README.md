# Revent
###Redis pub/sub module for NodeJS

## Install

`npm i reventjs`

## Config
```js
{
  	host: /* Redis host */,
    port: /* Redis port */,
    db:   /* Redis DB connect */,
    options: {/* Redis options */},
		createClient: /* Redis client instance */,
		messagePattern: /* Message pattern RexExp*/
}
```


## Usage
### Subscribe
```js
import Revent  from 'reventjs';
var redis = Revent.create({/* config */});

redis
		.on('ready', () => {

					redis.on('hello:*', ['expired','del' ,(data, channel, pattern) => {
						console.log(data, channel, pattern);
					}]);

			}).on('error', (err) => {
					console.error(`Redis client error: ${err}`);
			});

// OR
redis.on('ready', () => {
					console.log('Redis ready');
			})
			.on('error', (err) => {
					console.error(`Redis client error: ${err}`);
			});

redis.on('hello:*', ['expired','del' ,(data, channel, pattern) => {
	console.log(data, channel, pattern);
}]);
```

### Unsubscribe
```js
	// space - Keyspace
	redis.off('hello:* world:*',[() => {
		console.log('unsubscribe hello:*');
	}]);

	// event - Keyevent
	redis.off('events',[() => {
		console.log('unsubscribe Events');
	}]);

```

### Publish
```js
	redis.send('hello:*', {name:'Peter'});
```

### Connection close
```js
	redis.close();

	//Hard
	redis.end();
```

### Redis command
```js
	redis.command().expire(`hello:123`, 0, (err, reply) => {
			if(err || !reply) {
					console.error(err);
			}

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

## Dear friends, if you find any bugs or you will have suggestions, I'll tell you thanks very much. And you plus one in karma;)
