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
  var recordStartTime = new Date().getTime();
  
  channel.record(params, function(err, recording) {
    if (err) {
      console.log("Error starting recording: " + err.message);
      return call.termiateCall();
    }
  
    recording.on("RecordingStarted", function(event, rec) {
      console.log("Channel " + channel.id + " - Started recording");
    });
  
    recording.on("RecordingFailed", function(event, rec) {
      console.log("Channel " + channel.id + " - Recording Failed");
      console.dir(event);
      return callback();
    });
  
    recording.on("RecordingFinished", function(event, rec) {
      var recordEndTime = new Date().getTime();
      console.log("Channel " + channel.id + " - Finished recording");

      // send digits to the server, get next XML block
      var method = command.parameters.method || "POST";
      var url = command.parameters.action || call.baseUrl;
      var form = new formdata();
      setCallData(call, form);
      // TODO: assemble the same basic data that Twilio provides
      
      // Now create the URL for this file so it can be played
      var local_uri = "recording:" + fname;
      form.append("RecordingUri", local_uri);
      form.append("RecordingURL", ariaConfig.serverBaseUrl + fname +".wav");
      form.append("RecordingDuration", (recordEndTime - recordStartTime));
      form.append("Digits", call.digits);
      return fetchTwiml(method, url, call, form);
    });
  });
  
};



