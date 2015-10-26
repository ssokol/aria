#!/usr/bin/node

/****************************************************************************************

	Aria entry point
	
	This includes the list of Node modules to include. It also creates a few top-level
	variables used throughout the application. This must be concatenated first when
	generating the application. (The grunt configuration currently does this.)
	
****************************************************************************************/
"use strict";
var fs = require("fs");
var url = require("url");
var md5 = require("md5");
var path = require("path");
var util = require("util");
var redis = require("redis");
var flite = require("flite");
var parser = require("xmldoc");
var ari = require("ari-client");
var fetch = require("node-fetch");
fetch.Promise = require("bluebird");
var download = require("download");
var formdata = require("form-data");

var twimlActions = {};
var audioPath = "/var/lib/asterisk/sounds/";
var rc = redis.createClient();
;/**************************************************************************************

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


;/**************************************************************************************

    Aria Answer action
    
    Explicitly move the call to an offhook state.
    
    Note: This is not a part of the Twilio Twiml spec. It is my own addition to allow
    for somewhat finer-grained control over the call.

**************************************************************************************/
twimlActions.Answer = function(command, callback) {

  var call = command.call;
  var channel = call.channel;
  var client = call.client;
  var playback = null;

  console.log("Channel " + channel.id + " - Dialing: " + command.value);

  setTimeout(function() {
    if (call.hungup) {
      return call.terminateCall();
    } else {
      channel.answer();
      return callback();
    }
  }, 0);

};;/**************************************************************************************

    Aria Say action
    
    Play back synthesized speech using the Flite TTS engine.
    
    This is a bit of a hack in that ARI currently has no support for TTS. It works
    by using the free Flite TTS engine to render audio files which are then cached
    and re-used. This leads to a slight but noticeable delay when using "Say" for 
    the first time for a given word or phrase.
    
    Parameters
    
    voice: The actual Twilio engine allows you to set "man", "woman" or "alice" which
    seems to invoke a more capable TTS engine with support for multiple languages.
    
    loop: the number of times to play the audio file. Default is 1. If the value is
    set to 0, the file will be played indefinitely until the call is hung up.
    
    language: 
    
    termDigits: a string containing a list of DTMF digits that will result in the
    playback being cancelled. NOTE: not a part of the Twilio Twiml spec.
    
    Nested Verbs
    
    Verbs may not be nested within the Say command. The Say command, however, may be
    nested in the Gather verb.

**************************************************************************************/
twimlActions.Say = function(command, callback) {

  var call = command.call;
  var channel = call.channel;
  var client = call.client;
  var playback = null;

  console.log("Channel " + channel.id + " - Say: " + command.value);

  // attach a handler function for digits
  call.digitCallback = function(digit, digits) {
    if (playback) {
      if (command.parameters.termDigits &&
        (command.parameters.termDigits.indexOf(digit) > -1)) {
        playback.stop();
      }
    }
  };

  var play = function(sound, done) {
    playback = client.Playback();
    playback.on("PlaybackFinished", function(event, cp) {
      playback = null;
      if (done) {
        done();
      }
    });
    channel.play({
      media: "sound:" + sound
    }, playback);
  };

  function synth() {
    //  kal awb_time kal16 awb rms slt
    var options = {
      voice: "slt"
    };
    flite(options, function(err, speech) {
      if (err) {
        exit();
      } else {
        speech.say(command.value, fileName + ".wav16", function(err) {
          if (err) {
            exit();
          } else {
            play(fileName, exit);
          }
        });
      }
    });
  }

  function exit() {
    if (call.hungup) {
      return call.terminateCall();
    } else {
      return callback();
    }
  }

  if (!command.value) {
    console.log("Channel " + channel.id + " - ERROR: No text value provided in 'Say' request.");
    exit();
    return;
  }

  var hashName = md5(command.value);
  var fileName = path.join(audioPath, hashName);

  fs.exists(fileName, function(exists) {
    if (exists) {
      play(hashName, exit);
    } else {
      synth();
    }
  });
};

;/**************************************************************************************

    Aria 'Play' action
    
    Play back recorded audio from a provided URL.
    
    Value (CDATA): 
    
    The URL for the audio file to play. Must be in a file format and include an
    extension that Asterisk recognizes. (.slin, .wav, .WAV, .wav16, .gsm).
    
    The URL may be either a fully qualified URI (i.e. includes the protocol and full
    path) or a relative value. If the URL does not start with a protocol (i.e. 'http'
    or 'https') then it is treated as relative and resolved using the base URL for
    the Twiml block.
    
    Parameters
    
    loop: the number of times to play the audio file. Default is 1. If the value is
    set to 0, the file will be played indefinitely until the call is hung up.
    
    digits: a string of digits (DTMF tones) to play. If the digits parameter is set,
    the CDATA value is optional. Acceptable values are 0 - 9, * and #.
    
    termDigits: a string containing a list of DTMF digits that will result in the
    playback being cancelled. NOTE: not a part of the Twilio Twiml spec.
    
    Notes
    
    At this point the file is fetched every time. This needs to change. In a proper
    solution the file will be cached and an eTag header will be retained (probably in
    Redis) that can be sent along with the download request.

**************************************************************************************/
twimlActions.Play = function(command, callback) {

  var call = command.call;
  var channel = call.channel;
  var client = call.client;
  var playback = null;

  console.log("Channel " + channel.id + " - Playing: " + command.value);

  // attach a handler function for digits
  call.digitCallback = function(digit, digits) {
    if (playback) {
      if (command.parameters.termDigits &&
        (command.parameters.termDigits.indexOf(digit) > -1)) {
        playback.stop();
      }
    }
  };

  // play back the sound file
  var play = function(sound, done) {
    playback = client.Playback();
    playback.on("PlaybackFinished", function(event, cp) {
      playback = null;
      if (done) {
        done();
      }
    });
    channel.play({
      media: "sound:" + sound
    }, playback);
  };

  // exit, calling the provided callback
  var exit = function() {
    if (call.hungup) {
      return call.terminateCall();
    } else {
      return callback();
    }
  };

  // get the file URL
  var fileURL = url.parse(command.value);
  var fileHash = null;

  // if it does not have a protocol it must be relative - resolve it
  if (!fileURL.protocol) {
    var resolved = url.resolve(call.baseUrl, command.value);
    fileURL = url.parse(resolved);
  }

  // generate a hash which we will use as the filename
  var hashName = md5(fileURL.href);
  var fileName = hashName + path.extname(fileURL.href);

  // create a downloader object and fetch the file
  var dl = new download({
    mode: "755"
  });
  dl.get(fileURL.href)
    .dest(audioPath)
    .rename(fileName)
    .run(function(err, files) {
      if (err) {
        console.log("Channel " + channel.id + " - ERROR: Unable to download requested file.");
        console.error(err);
        exit();
      } else {
        play(hashName, exit);
      }
    });
};

;/**************************************************************************************

    Aria Gather action
    
    Collect digits, optionally playing prompts to the caller. On completion,
    submit the digits (along with standard call data) to the provided 'action'
    URL.
    
    Parameters
    
    Nested Elements
    
**************************************************************************************/
twimlActions.Gather = function(command, callback) {

  var call = command.call;
  var channel = call.channel;
  var client = call.client;

  console.log("Channel " + channel.id + " - Gathering: " + command.value);

  var timeout = command.parameters.timeout || 5;
  var timer = null;

  // clear the digit buffer?
  if (command.parameters.clear === "true") {
    call.digits = "";
  }

  // set the max digits and terminator values
  call.maxDigits = parseInt(command.parameters.numDigits, 10) || 0;
  call.termDigit = command.parameters.finishOnKey || "#";

  var collectDigits = function() {
    // if the buffer already has enough we can move on...
    if ((call.maxDigits > 0) && (call.digits.length >= call.maxDigits)) {
      return doneCollecting();
    }

    // otherwise set a callback for digit events
    call.digitCallback = function(digit, digits) {
      if (digit === call.termDigit) {
        // done - received term digit;
        doneCollecting();
      } else
      if ((call.maxDigits > 0) && (digits.length >= call.maxDigits)) {
        // done - hit max length
        doneCollecting();
      }
    };

    call.hangupCallback = function() {
      doneCollecting();
    };

    // and set the timer for our timeout
    timer = setTimeout(doneCollecting, timeout * 1000);
  };

  var doneCollecting = function(digits) {

    call.digitCallback = null;
    call.hangupCallback = null;

		// snapshot as the buffer could change
    var returnDigits = call.digits;
    call.digits = "";
    
    console.log("Channel " + channel.id + " - Done gathering. Collected: " + returnDigits);
    
    // clear the timer
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    // bail if the call has been hung up
    if (call.hungup) {
      return call.terminateCall();
    }

    // If the user entered any digits, use the action / method parameters
    // to send the value to the user's server
    if (returnDigits.length > 0) {
      // send digits to the server, get next XML block
      var method = command.parameters.method || "POST";
      var url = command.parameters.action || call.baseUrl;
      var form = new formdata();
      // TODO: assemble the same basic data that Twilio provides
      form.append("Digits", returnDigits);
      return fetchTwiml(method, url, call, form);
    } else {
      // fail - continue on to the next action
      return callback();
    }
  };

  // THIS IS THE NESTED COMMAND HANDLER - CAN THIS BE MADE GENERIC????
  // var nccb = function() {
  //     next child logic here
  // }
  // runNestedCommands(command, nccb, function() {
  //     // do the next thing (collect, record, etc.)
  // });    
  // if there are embedded play or say commands, execute them
  
  var child = command.children;

  // run the nested child action if it is valid
  var runChild = function() {
    // bail if the call has been hung up
    if (call.hungup) {
      return call.terminateCall();
    }

    // move past any verbs other than Play or Say
    while ((child) && ((child.name !== "Play") && (child.name !== "Say"))) {
      console.log("Channel " + channel.id + " - Invalid nested verb: " + child.name + ". Skipped");
      child = child.next;
    }
    if (child) {
      var action = twimlActions[child.name];
      child.parameters.termDigits = "1234567890*#"; // any key will terminate input
      child.parameters.clear = false; // do not allow the Play or Say command to clear the buffer
      action(child, nextChild);
    } else {
      collectDigits();
    }
  };

  // move the pointer to the next child and play it, otherwise start gathering
  var nextChild = function() {
    if ((child.next) && (call.digits.length === 0)) {
      child = child.next;
      runChild();
    } else {
      collectDigits();
    }
  };

  // if the gather verb has nested children, execute them. otherwise collect digits
  if (child) {
    runChild();
  } else {
    collectDigits();
  }
};

;/**************************************************************************************

    Aria Pause action
    
    Wait for a number of seconds

**************************************************************************************/
twimlActions.Pause = function(command, callback) {

  var call = command.call;
  var channel = call.channel;
  var client = call.client;
  var playback = null;
  
  console.log("Channel " + channel.id + " - Pausing: " + command.parameters.length);
  
  var timer = null;
  var value = parseInt(command.parameters.length, 10);
  
  call.hangupCallback = function() {
    if (timer) {
      clearTimeout(timer);
      call.hangupCallback = null;
    }
  };
  
  // set a timer and wait
  timer = setTimeout(function() {
    console.log("Channel " + channel.id + " - Pause complete");
    if (call.hungup) {
      return call.terminateCall();
    } else {
      return callback();
    }
  }, value * 1000);
};

;/**************************************************************************************

    Aria Dial action
    
    Call a phone number, WebRTC client, SIP destination, conference or queue.
    
    FOR THE MOMENT: We only support a PSTN phone number in the CDATA value of the Dial
    verb. The next step will be to add support for multiple destinations, and
    non-PSTN destinations.
    
    <Number>18168068844</Number>
		For calling phone numbers. Note that the CDATA value (raw text inside the <Dial>
		and </Dial> tags) can be used to call a single phone number.
		
    <Sip>foobar@sip.foobar.com</Sip>
    For calling raw SIP URIs. TODO.
        
    <Client @app="long-guid-string-here">ssokol@digium.com</Client>
    For calling Respoke endpoints. Add in an "app" parameter to call something other
    than the default app configured in /etc/asterisk/aria.conf.js
    
    <Conference>Emperor</Conference>
    In the real Twilio this presumably results in an outbound call to a conference
    resource where the actual conf_bridge session is run. In this case we simply
    use a local named bridge.
    
    <Queue>Sales Main</Queue>
    In the real Twilio this presumably results in an outbound call to a queue resource
    where the actual queueing system runs. In this case we simply redirect the call to
    a queue. (May actually use "ContinueInDialplan" here as creating a complete queueing
    system is out of scope for Aria.)

**************************************************************************************/
twimlActions.Dial = function(command, callback) {

  var call = command.call;
  //var channel = call.channel;
  var client = call.client;
  var playback = null;

  console.log("Channel " + call.channel.id + " - Dialing: " + command.value);

  var originate = function(channel, destination, callerId) {
    var dialed = client.Channel();

    // rather than registering another handler, perhaps this should hook the active
    // handler provided by the call object?
    channel.on("StasisEnd", function(event, channel) {
      hangupDialed(channel, dialed);
    });

    dialed.on("ChannelDestroyed", function(event, dialed) {
      hangupOriginal(channel, dialed);
    });

    dialed.on("StasisStart", function(event, dialed) {
      joinMixingBridge(channel, dialed);
    });

    dialed.originate({
        endpoint: destination,
        app: "aria",
        callerId: callerId,
        appArgs: "dialed"
      },
      function(err, dialed) {
        if (err) {
          console.log("Channel " + channel.id + " - Error originating outbound call: " + err.message);
          exit();
        }
      });
  };

  var exit = function() {
    if (call.hungup) {
      return call.terminateCall();
    } else {
      return callback();
    }
  };

  // handler for original channel hanging up so we can gracefully hangup the
  // other end
  var hangupDialed = function(channel, dialed) {
    console.log(
      "Channel %s - Channel has left the application. Hanging up dialed channel %s",
      channel.id, dialed.id);

    // hangup the other end
    dialed.hangup(function(err) {
      // ignore error since dialed channel could have hung up, causing the
      // original channel to exit Stasis
    });
  };

  var hangupOriginal = function(channel, dialed) {
    console.log("Channel %s - Dialed channel %s has been hung up. Terminating call.",
      channel.id, dialed.id);

    // hangup the other end
    channel.hangup(function(err) {
      // ignore error since original channel could have hung up, causing the
      // dialed channel to exit Stasis
    });
  };

  // handler for dialed channel entering Stasis
  var joinMixingBridge = function(channel, dialed) {
    var bridge = client.Bridge();

    dialed.on("StasisEnd", function(event, dialed) {
      dialedExit(dialed, bridge);
    });

    dialed.answer(function(err) {
      if (err) {
        throw err;
      }
    });

    bridge.create({
      type: "mixing"
    }, function(err, bridge) {
      if (err) {
        throw err;
      }

      console.log("Channel %s - Created bridge %s", channel.id, bridge.id);

      addChannelsToBridge(channel, dialed, bridge);
    });
  };

  // handler for the dialed channel leaving Stasis
  var dialedExit = function(dialed, bridge) {
    console.log(
      "Channel %s - Dialed channel %s has left our application, destroying bridge %s",
      call.channel.id, dialed.name, bridge.id);

    bridge.destroy(function(err) {
      if (err) {
        throw err;
      }
    });
  };

  // handler for new mixing bridge ready for channels to be added to it
  var addChannelsToBridge = function(channel, dialed, bridge) {
    console.log("Channel %s - Adding channel %s and dialed channel %s to bridge %s",
      channel.id, channel.id, dialed.id, bridge.id);

    bridge.addChannel({
      channel: [channel.id, dialed.id]
    }, function(err) {
      if (err) {
        throw err;
      }
    });
  };

  var dest = "PJSIP/" + command.value + "@twilio1";
  var cid = command.parameters.callerId || "";
  originate(call.channel, dest, cid);

};;/**************************************************************************************

    Aria Reject action
    
    Reject a call.

**************************************************************************************/
twimlActions.Reject = function(command, callback) {

  var call = command.call;
  var channel = call.channel;
  var client = call.client;
  var playback = null;
  
  console.log("Channel " + channel.id + " - Reject");
  
  // terminate the call on the next tick
  setTimeout(function() {
    return call.terminateCall();
  }, 0);
  
};;/**************************************************************************************

    Aria Hangup action
    
    End a call.

**************************************************************************************/
twimlActions.Hangup = function(command, callback) {

  var call = command.call;
  var channel = call.channel;
  var client = call.client;
  var playback = null;

  console.log("Channel " + channel.id + " - Hangup");

  // terminate the call on the next tick
  setTimeout(function() {
    call.hungup = true;
    channel.hangup();
    return call.terminateCall();
  }, 0);

};;/**************************************************************************************

	Aria Call Processor - Main Module

	This section of the overall Aria application creates a connection to the Asterisk
	server and serves as the entry point for incoming call requests signaled by the
	ARI "StasisStart" event.
	
	Configuration
	
	You will need to have Asterisk 13, Redis, and Node.js installed to run Aria.
	
	Configuration data is pulled from the 'aria.conf.js' file in the Asterisk directory 
	(/etc/asterisk). This file needs to export the values for the host, username and
	password as follows:
	
	exports.asterisk = [ip or host name / port]
	exports.username = [ARI user name from ari.conf]
	exports.password = [ARI password from ari.conf]
	
	The application starts, connects with Asterisk and registers an ARI application 
	called "aria". Your diplan needs to route calls to the aria application.
	
	    [aria-app]
	    exten => _X.,1,NoOp(Sending call into 'aria' application)
	         same => n,Stasis(aria)
	         same => n,Hangup     
	
	When a call arrives, Aria looks up the dialed number (${EXTEN}) in Redis. It expects
	a hash structure stored using a key that looks like:
	
	    /numbers/[number]
	
	This should return a hash structure with an "method" key and a "url" key. The
	"method" key should contain a string with either "GET" or "POST" in it. The 
	"url" key should include a fully qualified URL pointing to the application or raw
	Twiml script to execute.
	
	See the README.md file or the wiki for more information on configuring Aria.
	
**************************************************************************************/
(function() {

  var rc = null;   

  // source the configuration
  var config = require("/etc/asterisk/aria.conf.js");

  function clientLoaded(err, client) {
    if (err) {
      throw err;
    }

    // handler for StasisStart event
    function stasisStart(event, channel) {

			if (event.args[0] === "dialed") {
				console.log("Ignoring dialed call leg.");
				return;
			}
			
      console.log(util.format("Channel %s - Entered the application", channel.id));

      // figure out what technology is in use so we know what to use for routing
      var ctype = event.channel.name.split("/")[0];

      // SIP Client Call
      if ((ctype === "SIP") || (ctype === "PJSIP")) {

        // Route the call based on dialed Number
        var number = channel.dialplan.exten;

        // Replace the number with the value of arg[0] if present - FOR TESTING
        if (event.args[0]) {
          number = event.args[0];
        }

        // Query redis for the assigned url
        var lookup = "/numbers/" + number;
        var app = rc.hgetall(lookup, function(err, value) {
          if (err || !value) {
            // log the error to the appropriate facility

            // respond with a tri-tone error on the line
          } else {
            // fetch the Twiml from the provided url
            var call = new AriaCall(client, channel, value.url);
          }
        });

      } else

      // Respoke Client Call
      if (ctype === "RESPOKE") {
        // TODO - Handle Respoke Calls
      }

    }

    // handler for StasisEnd event
    function stasisEnd(event, channel) {
      console.log(util.format("Channel %s - Left the application", channel.id));
    }

    // create a redis client
    rc = redis.createClient();

    client.on("StasisStart", stasisStart);
    client.on("StasisEnd", stasisEnd);
    client.start("aria");
  }

  console.log("Initializing Aria Twiml actions.");
  Object.keys(twimlActions).forEach(function(key) {
    console.log(" - " + key);
  });
  // connect to the local Asterisk server
  // TODO: validate config values
  ari.connect(config.asterisk, config.username, config.password, clientLoaded);
}());