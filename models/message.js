'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;


/**
 * User Schema
 */
var MessageSchema = new Schema({
	message : String,
	score : Number,
	tokens : [String]
});

module.exports = mongoose.model('Message', MessageSchema);

