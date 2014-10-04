'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;


/**
 * User Schema
 */
var MessageLinkSchema = new Schema({
	key : String,
	familyStrings : [String]
});

module.exports = mongoose.model('MessageLink', MessageLinkSchema);

