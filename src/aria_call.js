/**************************************************************************************

    Aria Call Object
    
    Contains the constructor for Aria call objects. Also includes a set of top-level
    convenience functions for fetching Twiml and generating a linked list of
    actions to process. 

    TODO: In reality Aria could handle any number of other script formats. Twiml is
    convenient because there are already libraries out there that generate it. At
    some point in the future it would be fun to wrap up the twiml-specific bits in
    a node module and make the interpreter generic, such that you could use other
    inputs - perhaps a JSON-based script - to drive the Aria engine.
    
**************************************************************************************/

var makeAction = function(xml, parent) {

  var action = {};

  action.name = xml.name;
  action.value = xml.val.trim();
  action.parameters = xml.attr;
  action.call = parent;
  action.next = null;
  action.children = null;

  var lastChild = null;
  if (xml.children && xml.children.length > 0) {
    for (var i = 0; i < xml.children.length; i = i + 1) {
      var x = xml.children[i];
      var a = makeAction(x, parent);
      if (!action.children) {
        action.children = a;
        lastChild = a;
      } else {
        lastChild.next = a;
        lastChild = a;
      }
    }
    lastChild.next = null;
  }

  return action;
};

// make subsequent requests, optionally passing back data
var fetchTwiml = function(method, url, call, data) {
  var options = {
    method: method || "POST",
    body: data || null
  };

  fetch(url, options)
    .then(function(res) {
      return res.text();
    }).then(function(twiml) {
      // create the linked list of actions to execute
      var first = null;
      var last = null;

      // wipe out the old stack
      call.stack = null;

      // parse the xml and create a new stack
      var xml = new parser.XmlDocument(twiml);
      xml.eachChild(function(command, index, array) {

        var action = makeAction(command, call);
        if (!call.stack) {
          call.stack = action;
          last = action;
        } else {
          last.next = action;
          last = action;
        }
        if (index === (array.length - 1)) {
          last.next = null;
          call.processCall();
        }
      });
    });
};

function AriaCall(client, channel, url, twiml, done) {

  var that = this;

  this.client = client; // a reference to the ARI client
  this.channel = channel; // the ARI channel object for the call
  this.baseUrl = url; // the base URL from whence the Twiml was fetched
  this.stack = null; // the call stack 

  this.playback = null; // the placeholder for an active playback object
  this.stopOnTone = false; // should the playback be stopped when a tone is received?

  this.digits = "";
  this.digitTimer = null; // timer used to wait for digits;
  this.maxDigits = 0; // maximum number of digits to collect
  this.termDigit = "#"; // digit used to signal end of collection
  this.digitCallback = null; // callback on digit collection

  this.hungup = false; // hangup flag
  this.hangupCallback = null; // callback on hangup

  this.createTime = new Date().getTime();

  // advance to the next action in the list
  this.advancePointer = function() {
    if (that.stack.next) {
      that.stack = that.stack.next;
      that.processCall();
    } else {
      that.terminateCall();
    }
  };

  channel.on("ChannelDtmfReceived", function(evt, channel) {
    console.log("Channel " + channel.id + " - Digit: " + evt.digit);
    that.digits += evt.digit;
    if (that.digitCallback) {
      that.digitCallback(evt.digit, that.digits);
    }
  });

  channel.on("ChannelHangupRequest", function(evt, channel) {
    console.log("Channel " + channel.id + " - Hangup Request");
    that.hungup = true;
    if (that.hangupCallback) {
      that.hangupCallback();
    }
  });

  // fetch the Twiml for this call
  fetchTwiml("GET", url, that, null);

}


AriaCall.prototype.processCall = function() {
  var command = this.stack;
  var action = twimlActions[command.name];
  if (!action) console.log(command.name);
  action(command, command.call.advancePointer);
};

AriaCall.prototype.terminateCall = function() {
  // post the call record to the account's call history URI if set;
  // do other post-call stuff here
  var milliseconds = new Date().getTime();
  console.log("Channel " + this.channel.id + " - Call duration: " + (milliseconds - this.createTime) + "ms");
  if (!this.hungup) {
    try {
      this.channel.hangup();
    } catch (e) {
      // must have already hung up
    }
  }
};


