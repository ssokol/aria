/**************************************************************************************

    Aria Sms action
    
    Send an SMS message to a mobile phone.
    
    Note: At this point Asterisk does not have native support for SMS. The best way
    to send SMS messages is probably to subscribe to a service from either a SIP
    provider who offers SMS-enabled DIDs, or to use an existing API like Twilio,
    Tropo, or Nexmo.

**************************************************************************************/
twimlActions.Message = function(command, callback) {

  var call = command.call;
  var channel = call.channel;
  var client = call.client;
  var playback = null;

  console.log("Channel " + channel.id + " - SMS: " + command.value);
  
  // TODO: implement SMS message send
  
  // go on to the next action
  setTimeout(function() {
    return callback();
  }, 0);

};

