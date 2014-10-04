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

mongoose.connect(config.dbdev, function(err){
    if(err){
      console.log(err);
    }else{
      console.log('Connected to Mongodb.');
    }
  });
var sentiment = require("sentiment");
var url = "",
Message = require("./models/message.js"),
MessageLink = require("./models/messageLink.js");


var app = express();



// development only
if ('development' == app.get('env')) {
	url = config.dbdev;
  app.use(express.errorHandler());
}else{
	url = config.db;
}

mongoose.connect(url, function(err){
    if(err){
    	console.log("CANT CONNECT TO MONGODB");
      console.log(err);
    }else{
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

var fb = new Firebase('https://flickering-fire-2908.firebaseio.com/') ;

if(fb) {
	console.log('firebase connection established');
}

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get("/", function(req,res){
	res.render("index");
});

var server = http.createServer(app);
server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

app.get("/suggestMessage", function(req,res){
	var sentiment = require('sentiment');
	var message = req.query.message, 
		sentimentResult = sentiment(message),
		scoreBody = new Message({message : message, score : sentimentResult.score, tokens : sentimentResult.tokens});

	var sentiment = {
		word: 'fuck'
	};

	//fb.push(sentiment, function() {
	//});
	scoreBody.save(function(err,res){
	})

	sentimentResult.negative.forEach(function(e){
		MessageLink.findOne({key : e}, function(err, data){
			console.log(err, data);
			if(data == null){
				var msg = new MessageLink({	key : e,
								familyStrings : [message]});
				msg.save(function(err){console.log(err)});
			}else{
				if(data.familyStrings
					.map(function(e){return e.toLowerCase()})
					.indexOf(message.toLowerCase()) < 0){
						data.familyStrings.push(message);
						data.save(function(err){console.log(err)});			
				}

			}
		})
	});

	res.end(req.query.message);
});

app.get("/messages", function(req,res){
	Message.find({}, function(err,data){
		res.json(data);
	});
});

