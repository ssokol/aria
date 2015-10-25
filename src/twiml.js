var fs = require('fs');
var parser = require('xmldoc'); 
var _play = require('./twiml_play.js');
var _say = require('./twiml_say.js');
var _gather = require('./twiml_gather.js');
var _record = require('./twiml_record.js');
var _dial = require('./twiml_dial.js');
var _sms = require('./twiml_sms.js');
var _enqueue = require('./twiml_enqueue.js');
var _leave = require('./twiml_leave.js');
var _redirect = require('./twiml_redirect.js');
var _reject = require('./twiml_reject.js');
var _pause = require('./twiml_pause.js');
var _hangup = require('./twiml_hangup.js');
var _answer = require('./twiml_answer.js');
var _message  = require('./twiml_message.js');

var options = {
    object: true,
    reversible: false,
    coerce: false,
    sanitize: true,
    trim: true,
    arrayNotation: true
};

var actionHandler = {
    // TODO: simply invoke the verb functions directly
	"Play":      _play.Play,
	"Say":       _say.Say,
	"Gather":    _gather.Gather,
	"Record":    _record.Record,
	"Dial":      _dial.Dial,
	"Sms":       _sms.Sms,
	"Enqueue":   _enqueue.Enqueue,
	"Leave":     _leave.Leave,
	"Redirect":  _redirect.Redirect,
	"Reject":    _reject.Reject,
	"Pause":     _pause.Pause,
	"Hangup":    _hangup.Hangup,
	"Answer":    _answer.Answer,
	"Message":   _message.Message
}

var processCall = function(client, channel, command) {
	var action = command.handler[command.name];
	action(client, channel, command);
	if (command.next) {
		processCall(client, channel, command.next);
	} else {
		// call is complete
		console.log("Call complete");
	}
}

/*
    From a conceptual standpoint it is probably worthwhile to understand that
    all of the processing of a given call is handled within the context of this
    function.
*/
var processTwiml = function(client, channel, url, data) {
	var twiml = null;
	try {
    	twiml = new parser.XmlDocument(data);
    }
    catch (e) {
    	console.log("Error parsing Twiml");
    	console.dir(e);
    	return null;
    }
    
    var first = null;
    var last = null;
    
    twiml.eachChild(function(command, index, array) {
    	command.baseUrl = url;
    	command.handler = actionHandler;
    	
    	if (command.children) {
    	    for (var i = 0; i < command.children.length; i++) {
    	        var child = command.children[i];
    	        child.baseUrl = url;
    	        child.handler = actionHandler;
    	    }
    	}
    	
        if (!first) {
        	first = command;
        	last = command;
        } else {
        	last.next = command;
        	last = command
        }
        if (index === (array.length - 1)) {
        	last.next = null;
        	processCall(client, channel, first);
        }
    });
}

exports.processTwiml = processTwiml;

fs.readFile(__dirname + '/test.xml', function(err, data) {
	processTwiml(null, null, "https://test.com", data);
});
