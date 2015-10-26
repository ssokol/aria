/**************************************************************************************

    Aria Message action
    
    Send a message to a Respoke endpoint.

**************************************************************************************/
twimlActions.Message = function(command, callback) {

  var call = command.call;
  var channel = call.channel;
  var client = call.client;
  var playback = null;

  console.log("Channel " + channel.id + " - Message: " + command.value);
  
  // TODO: implement Respoke message send
  
  // go on to the next action
  setTimeout(function() {
    return callback();
  }, 0);

};