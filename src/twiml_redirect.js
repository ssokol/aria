/**************************************************************************************

    Aria Redirect action
    
    Redirect a call to another destination.

**************************************************************************************/
twimlActions.Redirect = function(command, callback) {

  var call = command.call;
  var channel = call.channel;
  var client = call.client;
  var playback = null;
  
  console.log("Channel " + channel.id + " - Recording: " + command.value);
  
};