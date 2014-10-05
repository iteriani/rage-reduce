//testing commit 2
/**
 * Module dependencies.
 */
var express = require('express');
var http = require('http');
var path = require('path');
var handlebars = require('express3-handlebars');
var passport = require("passport");
var config = require("./config/config.js");
var Firebase = require('firebase');
var fs = require("fs");
var mongoose = require('mongoose');
var aerospike = require("aerospike"),
    Status = aerospike.status;
var fdb = require('fdb').apiVersion(200);
var db = fdb.open();

var as_config = {
    hosts: [{
        addr: "localhost",
        port: 3000
    }]
};


client = aerospike.client(as_config).connect(function(err, client) {
    if (err.code !== 0) {
        console.log("CANT CONNECT TO AEROSPIKE")
        console.error(err);
    } else {
        console.log("Connected to aerospike!")
    }
});


var sentiment = require("sentiment");
var url = "",
    Message = require("./models/message.js"),
    MessageFix = require('./models/messageFix.js');
MessageLink = require("./models/messageLink.js");

var app = express();



// development only
if ('development' == app.get('env')) {
    url = config.dbdev;
    app.use(express.errorHandler());
} else {
    url = config.db;
}

mongoose.connect(url, function(err) {
    if (err) {
        console.log(err);
    } else {
        console.log('Connected to Mongodb.');
    }
});


// all environments
app.set('port', process.env.PORT || 8000);
app.set('views', path.join(__dirname, 'views'));
app.engine('handlebars', handlebars());
app.set('view engine', 'handlebars');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.bodyParser());
app.use(express.cookieParser('Intro HCI secret key'));
app.use(express.session());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

var fb = new Firebase('https://flickering-fire-2908.firebaseio.com/');

if (fb) {
    console.log('firebase connection established');
}

// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

app.get("/", function(req, res) {
    res.render("index");
});

var server = http.createServer(app);
server.listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});


app.get("/suggestMessage", function(req, res) {
    var sentiment = require('sentiment');
    var message = req.query.message,
        sentimentResult = sentiment(message),
        scoreBody = new Message({
            message: message,
            score: sentimentResult.score,
            tokens: sentimentResult.tokens
        }),
        fbScore = {
            message: message,
            score: sentimentResult.score,
            tokens: sentimentResult.tokens
        };

    if (message.trim().length === 0) {
        res.end(message);
    }

    fb.push(fbScore, function() {});

    scoreBody.save(function(err, res) {});

    var frequency = {};
    var keys = [];
    sentimentResult.tokens.forEach(function(e) {
        keys.push(aerospike.key("test", "link5", e))
    });

    client.batchGet(keys, function(err, results) {
        var i = 0;
        if (err.code == Status.AEROSPIKE_OK) {
            for (i = 0; i < results.length; i++) {
                switch (results[i].status) {
                    case Status.AEROSPIKE_OK:
                        var record = results[i].record;
                        console.log(record);
                        record.familyStrings.forEach(function(match) {
                            console.log(match, "HI");
                            if (frequency[match.toLowerCase()]) {
                                frequency[match.toLowerCase()] ++;
                            } else {
                                frequency[match.toLowerCase()] = 1;
                            }
                        });
                }
            }
        }

        var highest;
        var phrase;
        for (var key in frequency) {
            if (!highest || frequency[key] > highest) {
                highest = frequency[key];
                if (key != message) {
                    phrase = key;
                }

            } else if (frequency[key] == highest) {
                //equal
            }
        }
        if (sentimentResult.score < 0) {
            insertIntoMessageLink(sentimentResult, message);
            MessageFix.findOne({
                message: message
            }, function(err, fix) {
                if (fix == null) {
                    if (sentimentResult.tokens.length >= 4 && highest >= sentimentResult.tokens.length * (2 / 3)) {
                        MessageFix.findOne({
                            message: phrase
                        }, function(err, fix) {
                            if (fix == null) {
                                res.end('CENSORED');
                            } else {
                                var positiveMessage = new MessageFix({
                                    message: message,
                                    messageFix: fix.messageFix
                                });
                                positiveMessage.save();
                                res.end(fix.messageFix);
                            }
                        });
                    } else {
                        res.end("CENSORED");
                    }

                } else {
                    res.end(fix.messageFix);
                }
            });
        } else {
            if (sentimentResult.tokens.length >= 4 && highest >= sentimentResult.tokens.length * (2 / 3)) {
                MessageFix.findOne({
                    message: phrase
                }, function(err, fix) {
                    if (fix == null) {
                        res.end(req.query.message);
                    } else {
                        res.end(fix.messageFix);
                    }
                });
            } else {
                console.log('step 1');
                MessageFix.findOne({
                    message: message
                }, function(err, fix) {
                    if (fix == null) {
                        console.log('step 2');
                        res.end(req.query.message);
                        return;
                    } else {
                        console.log('step 3');
                        res.end(fix.messageFix);
                        return;
                    }
                });
            }
        }
    });

});

function insertIntoMessageLink(sentimentResult, message, cb) {
    sentimentResult.tokens.forEach(function(e) {
        if (e.trim().length === 0 || e == '') {
            cb();
            return;
        }

        var key = aerospike.key("test", "link5", e);
        client.get(key, function(err, record /** meta, key **/ ) {
            switch (err.code) {
                case Status.AEROSPIKE_OK:

                    if (record.familyStrings
                        .map(function(e) {
                            return e.toLowerCase()
                        })
                        .indexOf(message.toLowerCase()) < 0) {

                        record.familyStrings.push(message);

                        client.put(key, record, function(err) {
                            // handle error
                        });
                    }

                    break;

                case Status.AEROSPIKE_ERR_RECORD_NOT_FOUND:

                    var data = {
                        key: e,
                        familyStrings: [message]
                    };

                    client.put(key, data, function(err) {
                        // handle error
                    });
                    break;

                default:
                    console.log(err);
                    break;
            }
        });
    });
    if(cb){
        cb();    
    }

}

function insertIntoMessageFix(oldMessage, fix, cb) {
    try {
        if (oldMessage.trim().length === 0 || fix.trim().length === 0) {
            cb();
        }
        MessageFix.find({
            message: oldMessage
        }, function(err, data) {
            console.log("SEARCHING?", err, data);
            if (data.length === 0) {
                var positiveMessage = new MessageFix({
                    message: oldMessage,
                    messageFix: fix
                });
                positiveMessage.save(function() {
                    cb();
                });

            } else {
                cb();
            }
        });
    } catch (e) {
        console.log(e);
    }

}

app.get("/messages", function(req, res) {
    Message.find({}, function(err, data) {
        res.json(data);
    });
});

app.get('/getMessageFix', function(req, res) {
    MessageFix.find({}, function(err, data) {
        res.send(data);
    });
});

app.post("/trainDataSet", function(req, res) {
    var oldMsg = req.body.oldMsg;
    var newMsg = req.body.newMsg;
    var sentimentResult = sentiment(oldMsg);
    insertIntoMessageFix(oldMsg, newMsg, function() {
        insertIntoMessageLink(sentimentResult, oldMsg, function() {
            res.end();
        });
    });

    /*
    var data = req.body.oldMsg;
    data = data.split("\n");
    var trainingSet = [];
    data.forEach(function(e){
        var messages = e.split(":");
        var oldMsg = messages[0]; var fix = messages[1];
            trainingSet.push([oldMsg, fix]);
    });
    trainDataSet(trainingSet, function(){
        res.end();
    })*/
});

app.post('/positiveMessage', function(req, res) {
    MessageFix.find({
        message: req.body.oldMessage
    }, function(err, data) {
        if (data.length === 0) {
            var positiveMessage = new MessageFix({
                message: req.body.oldMessage,
                messageFix: req.body.message
            });
            positiveMessage.save();
            res.end();
        } else {
            res.end();
        }
    });
});