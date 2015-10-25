var aria = require('./aria_call.js');
var c1 = new aria.AriaCall("X", "https://whatever.com", "sometwiml");
setTimeout(function() {
	c1.hangup("foo");
}, 1000);
