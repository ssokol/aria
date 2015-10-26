/**************************************************************************************

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

