/**************************************************************************************

    Aria Leave action
    
    Take a call out of a queue.
    
    NOT YET IMPLEMENTED

**************************************************************************************/
twimlActions.Leave = function(command, callback) {

  var call = command.call;
  var channel = call.channel;
  var client = call.client;
  var playback = null;

  console.log("Channel " + channel.id + " - Leave: NOT YET IMPLEMENTED");

  // terminate the call on the next tick
  setTimeout(function() {
    return callback();
  }, 0);

};

