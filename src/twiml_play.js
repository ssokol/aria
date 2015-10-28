/**************************************************************************************

    Aria 'Play' action
    
    Play back recorded audio from a provided URL.
    
    Value (CDATA): 
    
    The URL for the audio file to play. Must be in a file format and include an
    extension that Asterisk recognizes. (.slin, .wav, .WAV, .wav16, .gsm).
    
    The URL may be either a fully qualified URI (i.e. includes the protocol and full
    path) or a relative value. If the URL does not start with a protocol (i.e. 'http'
    or 'https') then it is treated as relative and resolved using the base URL for
    the Twiml block.
    
    Parameters
    
    loop: the number of times to play the audio file. Default is 1. If the value is
    set to 0, the file will be played indefinitely until the call is hung up.
    
    digits: a string of digits (DTMF tones) to play. If the digits parameter is set,
    the CDATA value is optional. Acceptable values are 0 - 9, * and #.
    
    termDigits: a string containing a list of DTMF digits that will result in the
    playback being cancelled. NOTE: not a part of the Twilio Twiml spec.
    
    Notes
    
    At this point the file is fetched every time. This needs to change. In a proper
    solution the file will be cached and an eTag header will be retained (probably in
    Redis) that can be sent along with the download request.

**************************************************************************************/
twimlActions.Play = function(command, callback) {

  var call = command.call;
  var channel = call.channel;
  var client = call.client;
  var playback = null;

  console.log("Channel " + channel.id + " - Playing: " + command.value);

  // attach a handler function for digits
  call.digitCallback = function(digit, digits) {
    if (playback) {
      if (command.parameters.termDigits &&
        (command.parameters.termDigits.indexOf(digit) > -1)) {
        playback.stop();
      }
    }
  };

  // play back the sound file
  var play = function(sound, done) {
    playback = client.Playback();
    playback.on("PlaybackFinished", function(event, cp) {
      playback = null;
      if (done) {
        done();
      }
    });
    channel.play({
      media: "sound:" + sound
    }, playback);
  };

  // exit, calling the provided callback
  var exit = function() {
    if (call.hungup) {
      return call.terminateCall();
    } else {
      return callback();
    }
  };

  // get the file URL
  var fileURL = url.parse(command.value);
  var fileHash = null;

  // TODO: Add in support for playing back values in the standard voice
  // NONSTANDARD - ASTERISK ONLY
  if (command.parameters.type) {
    if (command.parameters.type === "number") {
      // read a number as a number (i.e. 3192 = "three thousands, one hundred and ninety-two")
    } else
    if (command.parameters.type === "digits") {
      // read a number as a string of digits (i.e. 1947 = "one", "nine", "four", "seven")
    } else
    if (command.parameter.type === "date") {
      // lots of subtype options here - perhaps this needs a default and a format map... dateFormat?
      // read a unix timestamp value (seconds) as a date
      // i.e. "1446047333" = "Wednesday, October Twenty Fifth, Two Thousand Fifteen"
    } else
    if (command.parameter.type === "time") {
      // again, all kinds of local format stuff to deal with here... timeFormat?
      // read a unix timestamp value (seconds) as a time
      // i.e. "1446047333" = "Three", "Forty", "Eight", "P", "M", "G", "M", "T"
    } else
    if (command.parameters.type === "money") {
      // need to add support for multiple currencies
      // read a number as a monetary amount. (i.e. 129.95 = "one hundred and twenty-nine dollars and ninety-five cents")
    } else
    if (command.parameters.type === "alpha") {
      // read a string as a list of characters (i.e. "Hello World" = "H", "E", "L", "L", "O", "space", "W", "O", "R", "L", "D")
    } else
    if (command.parameters.type === "phonetic") {
      // read a string using ICAO phonetics (i.e. CB239 = "Charlie", "Bravo", "Two", "Tree", "Niner")
    } else {
      // ignore - not a supported format
    }
  }

  // if it does not have a protocol it must be relative - resolve it
  if (!fileURL.protocol) {
    var resolved = url.resolve(call.baseUrl, command.value);
    fileURL = url.parse(resolved);
  }

  // generate a hash which we will use as the filename
  var hashName = md5(fileURL.href);
  var fileName = hashName + path.extname(fileURL.href);

  // create a downloader object and fetch the file
  var dl = new download({
    mode: "755"
  });
  dl.get(fileURL.href)
    .dest(ariaConfig.audioPath)
    .rename(fileName)
    .run(function(err, files) {
      if (err) {
        console.log("Channel " + channel.id + " - ERROR: Unable to download requested file.");
        console.error(err);
        exit();
      } else {
        play(hashName, exit);
      }
    });
};


