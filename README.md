statsd-generic-http-backend
============================

Generic HTTP backend for statsd

## Overview

This backend allows statsd to save to a generic HTTP backend.

## Installation

    $ cd /path/to/statsd
    $ npm install statsd-generic-http-backend
    
To install from behind a proxy server:

    $ export https_proxy=http://your.proxyserver.org:8080
    $ export http_proxy=http://your.proxyserver.org:8080
    $ cd /path/to/statsd
    $ npm install statsd-generic-http-backend


## Configuration

Merge the following configuration into your top-level existing configuration.
Add a structure to your configuration called "elasticsearch":

```js

 backends: [ 'statsd-elasticsearch7-backend' ],
 debug: true,
 http: {
	 port:          8080,
	 host:          "localhost",
	 path:          "/",
	 method:        "POST",
	 secure:        false,
	 countType:     "counter",
	 timerType:     "timer",
	 timerDataType: "timer_data",
	 gaugeDataType: "gauge",
     formatter:     "default_format"
 }
```

NOTE: You can also set the configuratons using environment variables, eg. `HTTP_HOST`, `HTTP_PATH`, `HTTP_PORT`, `HTTP_METHOD`

## Data Format



## Test your installation

Send a UDP packet that statsd understands with netcat.

```
echo "accounts.authentication.password.failed:1|c" | nc -u -w0 127.0.0.1 8125
echo "accounts.authentication.login.time:320|ms|@0.1" | nc -u -w0 127.0.0.1 8125
echo "accounts.authentication.login.num_users:333|g" | nc -u -w0 127.0.0.1 8125
echo "accounts.authentication.login.num_users:-10|g" | nc -u -w0 127.0.0.1 8125
```

## Default Metric Name Mapping

Each key sent to the HTTP backend will be broken up by dots (.) and each part of the key will be treated as a document property in the JSON object.  The first for keys will be treated as namespace, group, target, and action, with any remaining keys concatenated into the "action" key with dots.

For example:

```js
accounts.authentication.password.failure.count:1|c
```

The above would be mapped into a JSON document like this:
```js
{
	"_type":"counter",
	"ns":"accounts",
	"grp":"authentication",
	"tgt":"password",
	"act":"failure.count",
	"val":"1",
	"timestamp":"1393853783000"
}
```

Currently the keys are hardcoded to: namespace, group, target, and action, as in the above example. 

## Configurable Metric Formatters

You can choose to use from a selection of metric key formatters or write your own.

The config value _formatter_ will resolve to the name of a file under lib/ with a .js extension added to it.

```
formatter:  my_own_format  # this will require ('lib/' + 'my_own_format' + '.js);
```

In this module you will need to export a number of functions.  The 4 that are supported right now are:

```
counters( key, value, ts, array )
timers( key, value, ts, array )
timer_data( key, value, ts, array )
gauges( key, value, ts, array )
```

Look at `lib/default_format.js` for a template to build your own.
