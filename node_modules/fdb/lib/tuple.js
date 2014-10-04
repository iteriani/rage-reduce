/*
 * FoundationDB Node.js API
 * Copyright (c) 2012 FoundationDB, LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

"use strict";

var assert = require('assert');
var buffer = require('./bufferConversion');
var fdbUtil = require('./fdbUtil');

var sizeLimits = new Array(8);

function setupSizeLimits() {
	sizeLimits[0] = 1;
	for(var i = 1; i < sizeLimits.length; i++) {
		sizeLimits[i] = sizeLimits[i-1] * 256;
		sizeLimits[i-1] -= 1;
	}
	sizeLimits[7] -= 1;
}

setupSizeLimits();

var maxInt = Math.pow(2, 53) - 1;
var minInt = -Math.pow(2, 53);

var nullByte = new Buffer('00', 'hex');
var nullByteReplacement = new Buffer('00ff', 'hex');

function compareRegion(buf, offset, compareBuf) {
	for(var i = 0; i < compareBuf.length; i++)
		if(buf[i+offset] !== compareBuf[i])
			return false;
	
	return true;
}

function split(buf, delimiter) {
	var arr = [];
	var start = 0;

	for(var i = 0; i < buf.length - delimiter.length + 1; i++) {
		if(compareRegion(buf, i, delimiter)) {
			arr.push(buf.slice(start, i));
			i += delimiter.length - 1;
			start = i + 1;
		}
	}

	arr.push(buf.slice(start));
	return arr;
}

function join(arr, joinBuf, arrayElementTotalLength) {
	var joinArr = [];
	for(var i = 0; i < arr.length; ++i) {
		joinArr.push(arr[i]);
		joinArr.push(joinBuf);
	}

	return Buffer.concat(joinArr.slice(0, -1), arrayElementTotalLength + joinBuf.length * (arr.length - 1));
}

function replace(buf, searchBuf, replaceBuf) {
	var arr = split(buf, searchBuf);
	return join(arr, replaceBuf, buf.length - searchBuf.length * (arr.length-1));
}

function getNumParts(num) {
	return { high: Math.floor(num / 4 / (1 << 30)), low: (num & 0xffffffff) >>> 0 };
}

function encode(item) {
	var encodedString;
	if(typeof item === 'undefined')
		throw new TypeError('Packed element cannot be undefined');

	else if(item === null)
		return nullByte;

	//byte string
	else if(Buffer.isBuffer(item) || item instanceof ArrayBuffer || item instanceof Uint8Array) {
		item = buffer(item);
		encodedString = replace(item, nullByte, nullByteReplacement);
		return Buffer.concat([new Buffer('01', 'hex'), encodedString, nullByte], 2+encodedString.length);
	}

	//unicode string
	else if(typeof item === 'string') {
		encodedString = replace(new Buffer(item, 'utf8'), nullByte, nullByteReplacement);
		return Buffer.concat([new Buffer('02', 'hex'), encodedString, nullByte], 2+encodedString.length);
	}

	//64-bit integer
	else if(item % 1 === 0) {
		var negative = item < 0;
		var posItem = Math.abs(item);

		var length = 0;
		for(var i = 0; i < sizeLimits.length; ++i) {
			length = i;
			if(posItem <= sizeLimits[i])
				break;
		}
		
		if(item > maxInt || item < minInt)
			throw new RangeError('Cannot pack signed integer larger than 54 bits');

		var buf;
		if(length <= 4) {
			buf = new Buffer(5);
			if(negative)
				posItem = (~posItem) >>> 0;

			buf.writeUInt32BE(posItem, 1);
			buf = buf.slice(4 - length);
		}
		else if(length <= 8) {
			buf = new Buffer(9);

			var parts = getNumParts(posItem);
			if(negative) {
				parts.high = (~parts.high) >>> 0;
				parts.low = (~parts.low) >>> 0;
			}

			buf.writeUInt32BE(parts.high, 1);
			buf.writeUInt32BE(parts.low, 5);
			buf = buf.slice(8 - length);
		}

		var prefix = negative ? 20 - length : 20 + length;
		buf.writeInt8(prefix, 0);
	
		return buf;
	}

	else
		throw new TypeError('Packed element must either be a string, a buffer, an integer, or null');
}

function pack(arr) {
	if(!(arr instanceof Array))
		throw new TypeError('fdb.tuple.pack must be called with a single array argument');

	var totalLength = 0;

	var outArr = [];
	for(var i = 0; i < arr.length; ++i) {
		outArr.push(encode(arr[i]));
		totalLength += outArr[i].length;
	}

	return Buffer.concat(outArr, totalLength);
}

function findTerminator(buf, pos) {
	var found;
	for(pos; pos < buf.length; ++pos) {
		if(found && buf[pos] !== 255)
			return pos - 1;

		found = false;
		if(buf[pos] === 0)
			found = true;
	}

	if(found)
		return buf.length - 1;

	return buf.length;
}

function decodeNumber(buf, bytes) {
	var negative = bytes < 0;
	bytes = Math.abs(bytes);

	var padded = new Buffer(4);
	padded.fill(0);

	//Decode last 4 bytes
	buf.copy(padded, Math.max(4 - bytes, 0), Math.max(bytes - 4, 0));
	var num = padded.readUInt32BE(0);
	var odd;
	if(negative)
		num = -((~num & (0xffffffff >>> (Math.max(4 - bytes, 0) * 8))) >>> 0);
	if(bytes > 4) {
		//Decode remaining bytes
		padded.fill(0);
		buf.copy(padded, 8 - bytes, 0, bytes - 4);
		var high = padded.readUInt32BE(0);
		if(negative) {
			high = -((~high & (0xffffffff >>> ((8 - bytes) * 8))) >>> 0);
			odd = num & 0x00000001;
		}
		
		num += high * 0x100000000;
	}

	if(num > maxInt || num < minInt || (num === minInt && odd))
		throw new RangeError('Cannot unpack signed integers larger than 54 bits');

	return num;
}

function decode(buf, pos) {
	var code = buf[pos];
	var value;

	if(code === 0) {
		value = null;
		pos++;
	}
	else if(code === 1 || code === 2) {
		var end = findTerminator(buf, pos+1);
		value = replace(buf.slice(pos+1, end), nullByteReplacement, nullByte);

		if(code === 2)
			value = value.toString();

		pos = end + 1;
	}
	else if(Math.abs(code-20) <= 7) {
		if(code === 20)
			value = 0;
		else
			value = decodeNumber(buf.slice(pos+1), code-20);

		pos += Math.abs(20-code) + 1;
	}
	else if(Math.abs(code-20) <= 8)
		throw new RangeError('Cannot unpack signed integers larger than 54 bits');
	else
		throw new TypeError('Unknown data type in DB: ' + buf + ' at ' + pos);

	return { pos: pos, value: value };
}

function unpack(key) {
	var res = { pos: 0 };
	var arr = [];

	key = fdbUtil.keyToBuffer(key);

	while(res.pos < key.length) {
		res = decode(key, res.pos);
		arr.push(res.value);
	}

	return arr;
}

function range(arr) {
	var packed = pack(arr);
	return { begin: Buffer.concat([packed, nullByte]), end: Buffer.concat([packed, new Buffer('ff', 'hex')]) };
}

module.exports = {pack: pack, unpack: unpack, range: range};
