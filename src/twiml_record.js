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
  
  // set the maximum length the recording can last - default one hour
  var maxTime = command.parameters.maxLength  ? parseInt(command.parameters.maxLength, 10) : 3600; 
  
  // do we play a beep?
  var playBeep = (command.parameters.playBeep === "false") ? false : true;  
  
  // terminate recording on which tones?
  var finishOnKey = command.parameters.finishOnKey || "any";
  
  call.hangupCallback = function() {
    console.log("Call hung up!");
  }
  
  var fname = uuid.v4();
  
  // log the start
  console.log("Channel " + channel.id + " - Recording: " + fname + ".wav");
  
  // create parameters for the recording
  var params = {
    beep: playBeep,
    channelId: channel.id,
    format: "wav",
    ifExists: "overwrite",
    maxDurationSeconds: maxTime,
    maxSilenceSeconds: 60,
    name: fname,
    terminateOn: "#"
  };
  
  // start the recording process
  channel.record(params, function(err, recording) {
    if (err) {
      console.log("Error starting recording: " + err.message);
      return call.termiateCall();
    }
  
    recording.on("RecordingStarted", function(event, rec) {
      console.log("Started recording");
    });
  
    recording.on("RecordingFailed", function(event, rec) {
      console.log("Recording Failed");
    });
  
    recording.on("RecordingFinished", function(event, rec) {
      console.log("Finished recording");
      if (call.hungup) {
        return call.terminateCall();
      } else {
        return callback();
      }
    });
  });
  
};

