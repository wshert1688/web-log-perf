var async = require("async"),
    redis = require("redis"), comb = require("comb"),
    client = redis.createClient(6379, '192.168.8.44'), mysql = require('mysql');

var pool = mysql.createPool({
    host: '192.168.8.44',
    user: 'root',
    password: 'club'
});

var query = function (sql, param, cb) {
    pool.getConnection(function (err, connection) {
        var q = connection.query(sql, param, function (err, rows) {
            if (cb != undefined) {
                cb(err, rows);
            }
            connection.release();
        });
        //console.log(q.sql);
    });
}
var print = function (data) {
}
var getServers = function (cb) {
    client.smembers(['carBiz_server'],
        function (err, data) {
            if (data == null || data.length <= 0) {
                var sql = 'select `server` from perf.`perf-general` group by `server`;';
                var data = new Array();
                query(sql, null, function (err, d) {
                    for (var i in d) {
                        data.push(d[i].server)
                    }
                    client.sadd('carBiz_server', data, print);
                    cb(data);
                });
            }
            else {
                cb(data);
            }
        }
    )
}
exports.servers = function (req, res) {
    getServers(function (data) {
        res.send(200, {servers: data});
    })
}
exports.carBizRT = function (req, res) {
    getServers(function (data) {
        if (data != null && data.length > 0) {
            var server = data[0];
            var servers = data;
            var key = 'GeneralRT' + server;
            client.zrevrangebyscore([key, 99999, 0, 'LIMIT', 0, 99999],
                function (err, data) {
                    async.map(data, function (t, cb) {
                        client.hgetall('GeneralRT' + server + t, function (err, d) {
                            cb(err, d);
                        });
                    }, function (err, results) {
                        res.render('carBiz', {  d: data, l: results, server: server, servers: servers });
                    });
                }
            )
        }
        else {
            res.render('carBiz', {server: []});
        }
    })
}
exports.chartMaxData = function (req, res) {
    var keys = req.query.keys.split(",");
    var server = req.query.server;
    var sql = "select `max`,`date` from perf.`perf-general` where `key`=? and  `server`=? order by `date` desc limit 90;";

    async.map(keys, function (t, cb) {
        query(sql, [t, server], function (err, data) {
            cb(err, {k: t, d: data});
        });
    }, function (err, results) {
        var h = {};
        var d = {};
        for (var r in results) {
            var arr = new Array();
            var arr_d = new Array();
            for (var o in results[r].d) {
                arr.push(results[r].d[o].max);
                arr_d.push(comb.date.format(results[r].d[o].date, "yyyy-MM-dd H:m:s"));
            }
            h[results[r].k.replace(" ", "")] = arr.reverse();
            d[results[r].k.replace(" ", "")] = arr_d.reverse();
        }
        res.send(200, { l: h, d: d });
    });
};
exports.mainData = function (req, res) {
    var k = req.query.k;
    var s = req.query.s;
    var server = req.query.server;
    client.zrevrangebyscore([k + server, 99999, 0, 'LIMIT', 0, 99999],
        function (err, data) {
            async.map(data, function (t, cb) {
                client.hgetall(k + server + t, function (err, d) {

                    d["key"] = t;
                    cb(err, d);
                });
            }, function (err, results) {
                if (s == "max") {
                    results = comb.array.sort(results, function (a, b) {
                        return a.max - b.max;
                    })
                }
                if (s == "min") {
                    results = comb.array.sort(results, function (a, b) {
                        return a.min - b.min;
                    })
                }
                if (s == "call") {
                    results = comb.array.sort(results, function (a, b) {
                        return a.call - b.call;
                    })
                }
                if (s == "key") {
                    results = comb.array.sort(results, function (a, b) {
                        return a.key.length - b.key.length;
                    })
                }
                if (s == "avg") {
                    results = comb.array.sort(results, function (a, b) {
                        return a.avg - b.avg;
                    })
                }
                res.send(200, {  l: results.reverse() });
            });
        }
    )
}