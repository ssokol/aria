/****************************************************************************************

  Twiml "Play" verb - fetch audio (if not already cached) from a URL and play it
  back to the caller. Play includes a value (the URL) and optionally two parameters:

****************************************************************************************/

var twimlMessage = function(client, channel, command) {
    console.log(command.name);
}

exports.Message = twimlMessage