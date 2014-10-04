'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;


/**
 * User Schema
 */
var MessageFixSchema = new Schema({
	message : String,
	messageFix : String
});

module.exports = mongoose.model('MessageFix', MessageFixSchema);

