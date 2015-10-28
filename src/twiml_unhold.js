/**************************************************************************************

    Aria Unhold action
    
    Unhold a held call leg.

**************************************************************************************/
twimlActions.Unhold = function(command, callback) {

  var call = command.call;
  var channel = call.channel;
  var client = call.client;
  var playback = null;

  console.log("Channel " + channel.id + " - Hold");

  // continue the call on the next tick
  setTimeout(function() {
    return callback();
  }, 0);

};


