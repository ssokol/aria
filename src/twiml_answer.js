/**************************************************************************************

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

};