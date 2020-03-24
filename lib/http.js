/*
 * Flush stats to a generic HTTP endpoint
 *
 * To enable this backend, include the backend in the
 * configuration array:
 *
 *   backends: ['statsd-generic-http-backend']
 *  (if the config file is in the statsd folder)
 *
 * This backend supports the following config options:
 *
 *   host:            hostname or IP of the http endpoint
 *   port:            port of the http endpoint
 *   path:            http path of the http endpoint (default: '/')
 *   method:          http method to use when submitting data (default: post)
 *   secure:          Prefix of the dynamic index to be created (default: 'true')
 */

const http = require('http'),
      https = require('https'),
      fs = require('fs');

// this will be instantiated to the logger
let lg;
let debug;
let flushInterval;
let httpHost;
let httpPort;
let httpPath;
let httpMethod;
let httpCountType;
let httpTimerType;
let httpHttps;
let httpCertCa;

let httpStats = {};

function transform(stats, statsdType) {
    const payload = [];

    for (let i = 0; i < stats.length; i++) {
        stats[i].type = statsdType;
        payload.push(stats[i]);
    }

    return payload;
}

function insert(listCounters, listTimers, listTimerData, listGaugeData) {
    let payload = transform(listCounters, httpCountType);
    payload = payload.concat(transform(listTimers, httpTimerType));
    payload = payload.concat(transform(listTimerData, httpTimerType));
    payload = payload.concat(transform(listGaugeData, elasticGaugeDataType));

    if (payload.length === 0) {
        // No work to do
        return;
    }

    payload = JSON.stringify(payload)

    const optionsPost = {
        host: httpHost,
        port: httpPort,
        path: httpPath,
        method: httpMethod,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': payload.length
        }
    };

    let httpClient = http;
    if (httpHttps) {
        httpClient = https;

        if (httpCertCa) {
            optionsPost.ca = fs.readFileSync(httpCertCa);
            optionsPost.agent = new https.Agent(optionsPost);
        }
    }

    const req = httpClient.request(optionsPost, function (res) {
        res.on('data', (d) => {
            lg.log(`HTTP responded with ${res.statusCode}`);
            if (res.statusCode >= 400) {
                let errdata = "HTTP " + res.statusCode + ": " + d;
                lg.log('error', errdata);
            }
        });
    }).on('error', function (err) {
        lg.log('error', 'Error with HTTP request, no stats flushed.');
        console.log(err);
    });

    if (debug) {
        lg.log('HTTP payload:');
        lg.log(payload);
    }

    req.write(payload);
    req.end();
}

const flush_stats = function elastic_flush(ts, metrics) {
  let numStats = 0;
  let key;
  let array_counts = new Array();
  let array_timers = new Array();
  let array_timer_data = new Array();
  let array_gauges = new Array();

  ts = ts * 1000;

  for (key in metrics.counters) {
    numStats += fm.counters(key, metrics.counters[key], ts, array_counts);
  }

  for (key in metrics.timers) {
    numStats += fm.timers(key, metrics.timers[key], ts, array_timers);
  }

  if (array_timers.length > 0) {
    for (key in metrics.timer_data) {
      fm.timer_data(key, metrics.timer_data[key], ts, array_timer_data);
    }
  }

  for (key in metrics.gauges) {
    numStats += fm.gauges(key, metrics.gauges[key], ts, array_gauges);
  }

  if (debug) {
    lg.log('metrics:');
    lg.log(JSON.stringify(metrics));
  }

  insert(array_counts, array_timers, array_timer_data, array_gauges);

  if (debug) {
    lg.log("debug", "flushed " + numStats + " stats to ES");
  }
};

const http_backend_status = function (writeCb) {
  for (let stat in httpStats) {
    writeCb(null, 'http', stat, httpStats[stat]);
  }
};

exports.init = function (startup_time, config, events, logger) {

    debug = config.debug;
    lg = logger;

    let configHTTP = config.http || {};

    httpHost = configHTTP.host || process.env.HTTP_HOST || 'localhost';
    httpPort = configHTTP.port || process.env.HTTP_PORT || 8080;
    httpPath = configHTTP.path || process.env.HTTP_PATH || '/';
    httpCountType = configHTTP.countType || process.env.HTTP_COUNT_TYPE || 'counter';
    httpTimerType = configHTTP.timerType || process.env.HTTP_TIMER_TYPE || 'timer';
    elasticTimerDataType = configHTTP.timerDataType || process.env.HTTP_TIMER_DATATYPE || httpTimerType + '_stats';
    elasticGaugeDataType = configHTTP.gaugeDataType  || process.env.HTTP_GAUGE_DATATYPE || 'gauge';
    elasticFormatter = configHTTP.formatter || process.env.HTTP_FORMATTER || 'default_format';
    httpHttps = configHTTP.secure || process.env.HTTP_SECURE || false;
    httpCertCa = configHTTP.ca || undefined;

    fm = require('./' + elasticFormatter + '.js');
    if (debug) {
        lg.log("debug", "loaded formatter " + elasticFormatter);
    }

    if (fm.init) {
        fm.init(configHTTP);
    }
    flushInterval = config.flushInterval;

    httpStats.last_flush = startup_time;
    httpStats.last_exception = startup_time;

    events.on('flush', flush_stats);
    events.on('status', http_backend_status);

    return true;
};
