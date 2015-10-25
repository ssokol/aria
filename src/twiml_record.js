/**************************************************************************************

    Aria Record action
    
    Record audio from the caller. Store it and post the URL to the server. Expect
    additional instructions.

**************************************************************************************/
twimlActions.Record = function(command, callback) {

  var call = command.call;
  var channel = call.channel;
  var client = call.client;
  var playback = null;
  
  console.log("Channel " + channel.id + " - Recording: " + command.value);
  
};

