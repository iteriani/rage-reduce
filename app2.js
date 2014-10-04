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
var aerospike = require("aerospike");

var sentiment = require("sentiment");
var url = "",
    Message = require("./models/message.js"),
    MessageFix = require('./models/messageFix.js');
MessageLink = require("./models/messageLink.js");

var Status = aerospike.status;



var as_config = {
    hosts: [{addr: "localhost", port: 3000}]
};


client = aerospike.client(as_config).connect(function(err, client) {
    if ( err.code !== 0 ) {
        console.error(err);
    }else{
        console.log("Connected!")
    }
});


var app = express();



// development only
if ('development' == app.get('env')) {
    url = config.dbdev;
    app.use(express.errorHandler());
} else {
    url = config.db;
}


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

    if(message.trim().length ===0){
    	res.end(message);
    }

    fb.push(fbScore, function() {});

    scoreBody.save(function(err, res) {});

    var frequency = {};

    MessageLink.find({}, function(err, data) {
        sentimentResult.tokens.forEach(function(e) {
            for (var i = 0; i < data.length; i++) {
                console.log('at' + i, data[i], e);
                if (data[i].key == e) {
                    data[i].familyStrings.forEach(function(match) {
                        if (frequency[match.toLowerCase()]) {
                            frequency[match.toLowerCase()] ++;
                        } else {
                            frequency[match.toLowerCase()] = 1;
                        }
                    });
                }
            }
        });

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
                MessageFix.findOne({message: message}, function(err, fix){
                        if(fix == null){
                            console.log('step 2'); 
                            res.end(req.query.message);
                            return;
                        }else{
                            console.log('step 3'); 
                            res.end(fix.messageFix);
                            return;
                        }
                }); 
            }
        }
 //   });
});

app.get("/aerospiketest", function(req,res){
    var message = req.query.message;
    var sentimentResult = sentiment(message);
    insertIntoMessageLink(sentimentResult, message, function(){

    });
});

function insertIntoMessageLink(sentimentResult, message, cb) {
    sentimentResult.tokens.forEach(function(e) {
    	if(e.trim().length === 0){
    		cb();
    	}

        var key = aerospike.key("test","messageLink",e);

        client.get(key, function(err, record /** meta, key **/) {

            switch ( err.code ) {
                case Status.AEROSPIKE_OK:

                    if (record.familyStrings
                        .map(function(e) {
                            return e.toLowerCase()
                        })
                        .indexOf(message.toLowerCase()) < 0) {
                        
                        record.familyStrings.push(message);

                        client.put(key, data, function(err) {
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

                    break;
            }
        });
    });
}

function insertIntoMessageFix(oldMessage, fix, cb){
	if(oldMessage.trim().length === 0 || fix.trim().length === 0){
		cb();
	}
	    MessageFix.find({
        message: oldMessage
    }, function(err, data) {
        if (data.length === 0) {
            var positiveMessage = new MessageFix({
                message: oldMessage,
                messageFix: fix
            });
            positiveMessage.save(function(){
               cb();         	
            });

        } else {
        	cb();
        }
    });
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
function trainDataSet(dataset, cb){
	console.log(dataset);
	var oldMsg = dataset[0][0];
	var newMsg = dataset[0][1];
	var sentimentResult = sentiment(oldMsg);
	insertIntoMessageFix(oldMsg, newMsg, function(){
		insertIntoMessageLink(sentimentResult, oldMsg, function(){
			if(dataset.length > 1){
			trainDataSet(dataset.slice(1), cb);				
			}else{
				cb();
			}
		});
	});
}

app.post("/trainDataSet", function(req,res){
	var oldMsg = req.body.oldMsg;
	var newMsg = req.body.newMsg;
	var sentimentResult = sentiment(oldMsg);
	insertIntoMessageFix(oldMsg, newMsg, function(){
		insertIntoMessageLink(sentimentResult, oldMsg, function(){
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