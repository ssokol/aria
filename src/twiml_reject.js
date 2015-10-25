/**************************************************************************************

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
  
};