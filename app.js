//testing commit 2

/**
 * Module dependencies.
 */

var express = require('express');
var http = require('http');
var path = require('path');
var handlebars = require('express3-handlebars')
var passport = require("passport")
var config = require("./config/config.js")		
var fs = require("fs");
var mongoose = require('mongoose');
var sentiment = require("sentiment");
var url = "",
Message = require("./models/message.js");


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

app.get("/", function(req,res){
	res.render("index");
})

var server = http.createServer(app);
server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

app.get("/suggestMessage", function(req,res){
	var message = req.query.message, 
		sentimentResult = sentiment(message),
		scoreBody = new Message({message : message, score : sentimentResult.score, tokens : sentimentResult.tokens});

	scoreBody.save(function(err,res){
		console.log(err,res);
	})
	res.end(req.query.message);
});

app.get("/messages", function(req,res){
	Message.find({}, function(err,data){
		res.json(data);
	});
});

