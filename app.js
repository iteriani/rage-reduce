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
var mongoose = require("mongoose")
var db = mongoose.connect(config.db);
var fs = require("fs");
var classes = []; 					// temporary
var schedules = null;
var A = true;



// Example route
// var user = require('./routes/user');

var app = express();

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

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get("/", function(req,res){
	res.render("index");
})

var server = http.createServer(app);
server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

app.get('/', function(req, res) {
	res.render('index');
});
app.get("/suggestMessage", function(req,res){
	console.log(req.query.message);
	res.end(req.query.message);
});

