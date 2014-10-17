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

mongoose.connect(config.db, function(err) {
    if (err) {
        console.log("CANT CONNECT TO MONGODB");
        console.log(err);
    } else {
        console.log('Connected to Mongodb.');
    }
});

var yelp = require("yelp").createClient({
    consumer_key: "D9GtTmwjt7_L4Myia4bEIA",
    consumer_secret: "jqRSMEiGuvdIkz0mW0nG8PxViNA",
    token: "1xx06KPuB4tQaRAaLOnmRX1ToX6B0eEK",
    token_secret: "NWDk2VQWPZfppXI50TQRG6kQVFk"
});

var jsDom = require("jsdom");


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
    if (req.query.message.trim().length === 0) {
        res.end(req.query.message);
        return;
    }
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
        if (e.trim().length === 0) {
            return;
        }
        MessageLink.findOne({
            key: e
        }, function(err, data) {
            if (data == null) {
                var msg = new MessageLink({
                    key: e,
                    familyStrings: [message]
                });
                msg.save(function(err) {
                    console.log(err);
                    return;
                });
            } else {
                if (data.familyStrings
                    .map(function(e) {
                        return e.toLowerCase()
                    })
                    .indexOf(message.toLowerCase()) < 0) {
                    data.familyStrings.push(message);
                    data.save(function(err) {
                        console.log(err)
                        return;
                    });
                }

            }
        })
    });
    if (cb) {
        cb();
    }

}

function insertIntoMessageFix(oldMessage, fix, cb) {
    if (oldMessage.trim().length === 0 || fix.trim().length === 0) {
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
            positiveMessage.save(function() {
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

function trainDataSet(dataset, cb) {
    console.log(dataset);
    var oldMsg = dataset[0][0];
    var newMsg = dataset[0][1];
    var sentimentResult = sentiment(oldMsg);
    insertIntoMessageFix(oldMsg, newMsg, function() {
        insertIntoMessageLink(sentimentResult, oldMsg, function() {
            if (dataset.length > 1) {
                trainDataSet(dataset.slice(1), cb);
            } else {
                cb();
            }
        });
    });
}

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
            positiveMessage.save(function() {
                insertIntoMessageLink(sentiment(req.body.oldMessage), req.body.oldMessage, function() {
                    res.end();
                })
            });

        } else {
            res.end();
        }
    });
});

app.get("/restaurants", function(req, res) {
    res.json([
  "http://s3-media4.fl.yelpcdn.com/bphoto/V8bAehLMUIyTQAEs226Pzw/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/wuDRZfJv87PoI0VTdkdqzQ/l.jpg",
  "http://s3-media4.fl.yelpcdn.com/bphoto/BEONMgxJoBhQSTYItzIaYA/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/Ogob_hryUeNrTTeH7EZ2XQ/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/hjr7yqFY-H4PoScRiSjd1w/l.jpg",
  "http://s3-media4.fl.yelpcdn.com/bphoto/z-UYn53YE8WjfYo_XwGp3w/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/7xUBXd5xucMrRm-2FXpRFw/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/8waXKtLBnXM7XlgTDmIvLw/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/x5D986qRVJOn13DD_AmZbQ/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/Qo0VgQ7LRvJpZhj0q3BloA/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/oPkjiSRRYdQQWYTupb5_-g/l.jpg",
  "http://s3-media4.fl.yelpcdn.com/bphoto/stYr59na0kFW_gpVQX-RkA/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/u-HoS0gI0Js8OhRwcHt-ZQ/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/GQe3cd6qsmyi3yKpm-lQLg/l.jpg",
  "http://s3-media4.fl.yelpcdn.com/bphoto/ARkoOqGD4GPpjGy54eK71Q/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/5AO--GbQtri2emM5ra5JiQ/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/lZ38Mrj7doTdPxH8BPBpOg/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/3zYwbcvdUy1ss3_wAzTxhQ/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/ziZ6e9DR5i5VY9ejVcVADw/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/t2plCGCf0etbgM80XOz6aA/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/ivTYCeGusXZ1PDnCnfLfhA/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/IYKeYqS306hax8j9JAXcOQ/l.jpg",
  "http://s3-media4.fl.yelpcdn.com/bphoto/PBGvAwzbZvQ_7WZ8CVhFrw/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/e-1T8o-pXBVA_3G9ourmPw/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/0rObglJbInIgVPo30q1KrA/l.jpg",
  "http://s3-media4.fl.yelpcdn.com/bphoto/7fZ8LE8TCG5kKVyarPJIRw/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/UNsK96PZNbgUDE61KALDNQ/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/KVeEUimXeF_7HJsJUVGLvg/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/QkOLuOTKrgUdrGF0vjY-Eg/l.jpg",
  "http://s3-media4.fl.yelpcdn.com/bphoto/eJwzedW6X5v5diCRBwbfSg/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/-GIVnk6aNUqaVO4oQ-zpSQ/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/9rxEmUjBXgE9Ehgvwv_i3w/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/Jt-BJgzXowhGSwPp5w5drw/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/Wj_zDNwcIdC-hqZD4JHApQ/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/sFJ3niADMenZ-kOyz94SvQ/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/ZG_BWednd-2_shqgXby52Q/l.jpg",
  "http://s3-media4.fl.yelpcdn.com/bphoto/U9MkRYzeT2NAjKMw9QXcAw/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/wq_Twp10CYCk_kfewrJtSA/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/I4kDj3mlhOWvzM2sYw0aHw/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/IoAWJ0hoT1S1OfCWJu3SDw/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/GAmfg_cmgBTtDYYwbaswUQ/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/zk_Dr9Q3TtW_JkeOxZ919g/l.jpg",
  "http://s3-media4.fl.yelpcdn.com/bphoto/EQG2M5gR_QMw029UZMvWFg/l.jpg",
  "http://s3-media4.fl.yelpcdn.com/bphoto/WqR2AeS4-YnnIw5rFHGaVQ/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/ZSsf6znVIpMsY4oV0EcAuA/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/HwlsG7cFqtywtINkv5jLRA/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/5hN3QPVH05I5iUCDsQoyPw/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/L-vkWT9S6JxXgD7kXntc5Q/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/dKm9SfQd9H2WfHBSj5iAwQ/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/o87yP4mgnnxQDvCd0oa-KA/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/c_wC8WHHeGUCbTajq4jskw/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/DDNxLnVfyo9chKxOOKaTNA/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/NP8iBjFk_BGC9MDWjOiCnQ/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/w3OmflI10WOvaOTqPlO97g/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/kYG-hugEXkqY7DQFoicEYg/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/MKZQSg2bcxAb9-c35MiDyw/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/_hDDn_XEVAJONf_6KQtbyw/l.jpg",
  "http://s3-media4.fl.yelpcdn.com/bphoto/G_hc4X83ZB5F4Aqo-O-fmw/l.jpg",
  "http://s3-media4.fl.yelpcdn.com/bphoto/9wJy_lGSrqGi9RutFg7I2A/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/WVy_yB82T97bTUz8Hih_vQ/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/OtCcjpETO4RRGZ-6LwqS7A/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/XiOZ17fMd352gOlzUkouDw/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/1311iIWyWj6XpbzFWc4SGw/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/Z8WmKZuwMRhUX53pAUmuXA/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/o2qaTjcSFOjABWfAj-kEfQ/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/KUq423oCyGQJ2Bd6CWzoOQ/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/EE50qccXflvQSB8lYmd99Q/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/lW-znIvoYQ4280rMhLUk2w/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/TWWS1fff-luGA-GUz-UvHw/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/WmxFX80C20uIsuM0yyK7tg/l.jpg",
  "http://s3-media4.fl.yelpcdn.com/bphoto/b346A4zy5s7QPZy9b6AdBA/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/gd2S0xYJx4IjtQTMbtQRxw/l.jpg",
  "http://s3-media4.fl.yelpcdn.com/bphoto/XjeKUprZoai-1jEMzAiSSg/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/WlircJBAvF0xOScAnpYstg/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/ZQOcXbFOoVjvMPG5fDCSnA/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/fAM6Mh9-PT16JfoZjB9xAQ/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/QLdGUoQEico-vNp3odiiwQ/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/HbizjE3XLnmudo5tZ-mDeQ/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/yI0BSWOGntR5Wigc6Q-djA/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/5cWABt5iYJWaFQCyUclXrQ/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/v8riBQyjvL3pyq5IvdyPFA/l.jpg",
  "http://s3-media4.fl.yelpcdn.com/bphoto/Hn_UinshO2KjsUCvTQ6FDw/l.jpg",
  "http://s3-media4.fl.yelpcdn.com/bphoto/6pVs-8e9KkThJc84LF-Pdg/l.jpg",
  "http://s3-media4.fl.yelpcdn.com/bphoto/wnGKL_0nLkN9vh6RCfp25w/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/0JnStJU0uErU15HUrGcP4g/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/RKHwWn7aUAhAjoJoji4SUg/l.jpg",
  "http://s3-media4.fl.yelpcdn.com/bphoto/qqo2vQ_Bcn6N6LV3DYF8Rg/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/3_ESteRkyPAgFd7URH1BAg/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/1v8xH-JzQDoJ5oZF-yBEqQ/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/5diq4_f5NyY7qzfVtyYykA/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/P5tIKnOSgLKmrYU2zaYC2A/l.jpg",
  "http://s3-media2.fl.yelpcdn.com/bphoto/Tw1qiW42m4hBfF5gx2RAmA/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/8XY6JW4XZzV8-jHcSNScnA/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/n1A4DbeA_c8pJvudV69GXg/l.jpg",
  "http://s3-media3.fl.yelpcdn.com/bphoto/EsLSPwXP1E9ST0nwZ6XpFg/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/h7r_qpfAMVicangwiqZn9A/l.jpg",
  "http://s3-media4.fl.yelpcdn.com/bphoto/BXsVJcYkBiC7tybO1YfoPA/l.jpg",
  "http://s3-media1.fl.yelpcdn.com/bphoto/pBBCc5yzyUkjVgGFBXQoRQ/l.jpg",
  "http://s3-media4.fl.yelpcdn.com/bphoto/vdOKIoQRIz_FuVHTfuHVcQ/l.jpg",
  "http://s3-media4.fl.yelpcdn.com/bphoto/xBLIDEBLJFsSvPHePc_8uA/l.jpg"
]);
    var photoURL = "http://s3-media4.fl.yelpcdn.com/bphoto/";
    var baseURL = "http://www.yelp.com/biz_photos/";
    // class = photos
    var request = require("request");
/*
    yelp.search({
        term: "food",
        location: "San Diego"
    }, function(error, data) {
        var names = data.businesses.map(function(e) {
            var business = e.name
                .replace("&", "")
                .split(" ")
                .join("-")
                .replace("\\", "")
                .replace("'", "") + "-san-diego";
            return baseURL + business;
        });
        console.log(names[]);
        jsDom.env(names[0], ["http://code.jquery.com/jquery.js"], function(errors, window) {
            console.log
            var photoURLs = [];
            window.$(".photos").children().find("img")
                .map(function(e, a) {
                    var s = window.$(a).attr("src").replace("ms.jpg", "l.jpg");
                    photoURLs.push(s);
                });
            res.json(photoURLs);
        });
    });*/



});

app.get('/about', function(req, res) {
    res.render('about');
});

app.get('/team', function(req, res) {
    res.render('team');
});