/**************************************************************************************

    Aria Redirect action
    
    Instruct Aria to fetch new instructions from a server and continue processing
    with the result.

**************************************************************************************/
twimlActions.Redirect = function(command, callback) {

  var call = command.call;
  var channel = call.channel;
  var client = call.client;
  var playback = null;

  console.log("Channel " + channel.id + " - Redirect: " + command.value);
  
  // TODO: implement SMS message send
  
  // go on to the next action
  setTimeout(function() {
    try {
      var method = command.parameters.method || "POST";
      var redirectURL = null;
      if (command.value) {
        var parts = url.parse(command.value);
        if (parts.protocol) {
          redirectURL = command.value;
        } else {
          redirectURL = url.resolve(call.baseUrl, command.value);
        }
      } else {
        redirectURL = call.baseUrl;
      }
      var form = new formdata();
      setCallData(call, form);
      return fetchTwiml(method, redirectURL, call, form);
    } catch (e) {
      return callback();
    }
  }, 0);

};

