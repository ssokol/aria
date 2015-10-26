/**************************************************************************************

    Aria Enqueue action
    
    Place a call into a queue.
    
    NOT YET IMPLEMENTED

**************************************************************************************/
twimlActions.Enqueue = function(command, callback) {

  var call = command.call;
  var channel = call.channel;
  var client = call.client;
  var playback = null;

  console.log("Channel " + channel.id + " - Enqueue: NOT YET IMPLEMENTED");

  // terminate the call on the next tick
  setTimeout(function() {
    return callback();
  }, 0);

};