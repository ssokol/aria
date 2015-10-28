/**************************************************************************************

    Aria Say action
    
    Play back synthesized speech using the Flite TTS engine.
    
    This is a bit of a hack in that ARI currently has no support for TTS. It works
    by using the free Flite TTS engine to render audio files which are then cached
    and re-used. This leads to a slight but noticeable delay when using "Say" for 
    the first time for a given word or phrase.
    
    Parameters
    
    voice: The actual Twilio engine allows you to set "man", "woman" or "alice" which
    seems to invoke a more capable TTS engine with support for multiple languages.
    
    loop: the number of times to play the audio file. Default is 1. If the value is
    set to 0, the file will be played indefinitely until the call is hung up.
    
    language: 
    
    termDigits: a string containing a list of DTMF digits that will result in the
    playback being cancelled. NOTE: not a part of the Twilio Twiml spec.
    
    Nested Verbs
    
    Verbs may not be nested within the Say command. The Say command, however, may be
    nested in the Gather verb.

**************************************************************************************/
twimlActions.Say = function(command, callback) {

  var call = command.call;
  var channel = call.channel;
  var client = call.client;
  var playback = null;

  console.log("Channel " + channel.id + " - Say: " + command.value);

  // attach a handler function for digits
  call.digitCallback = function(digit, digits) {
    if (playback) {
      if (command.parameters.termDigits &&
        (command.parameters.termDigits.indexOf(digit) > -1)) {
        playback.stop();
      }
    }
  };

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

  function synth() {
    //  kal awb_time kal16 awb rms slt
    var options = {
      voice: "slt"
    };
    flite(options, function(err, speech) {
      if (err) {
        exit();
      } else {
        speech.say(command.value, fileName + ".wav16", function(err) {
          if (err) {
            exit();
          } else {
            play(fileName, exit);
          }
        });
      }
    });
  }

  function exit() {
    if (call.hungup) {
      return call.terminateCall();
    } else {
      return callback();
    }
  }

  if (!command.value) {
    console.log("Channel " + channel.id + " - ERROR: No text value provided in 'Say' request.");
    exit();
    return;
  }

  var hashName = md5(command.value);
  var fileName = path.join(ariaConfig.audioPath, hashName);

  fs.exists(fileName, function(exists) {
    if (exists) {
      play(hashName, exit);
    } else {
      synth();
    }
  });
};


