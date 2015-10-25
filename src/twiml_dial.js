/**************************************************************************************

    Aria Dial action
    
    Call a phone number, WebRTC client, SIP destination, conference or queue.
    
    FOR THE MOMENT: We only support a PSTN phone number in the CDATA value of the Dial
    verb. The next step will be to add support for multiple destinations, and
    non-PSTN destinations.
    
    <Number>18168068844</Number>
		For calling phone numbers. Note that the CDATA value (raw text inside the <Dial>
		and </Dial> tags) can be used to call a single phone number.
		
    <Sip>foobar@sip.foobar.com</Sip>
    For calling raw SIP URIs. TODO.
        
    <Client @app="long-guid-string-here">ssokol@digium.com</Client>
    For calling Respoke endpoints. Add in an "app" parameter to call something other
    than the default app configured in /etc/asterisk/aria.conf.js
    
    <Conference>Emperor</Conference>
    In the real Twilio this presumably results in an outbound call to a conference
    resource where the actual conf_bridge session is run. In this case we simply
    use a local named bridge.
    
    <Queue>Sales Main</Queue>
    In the real Twilio this presumably results in an outbound call to a queue resource
    where the actual queueing system runs. In this case we simply redirect the call to
    a queue. (May actually use "ContinueInDialplan" here as creating a complete queueing
    system is out of scope for Aria.)

**************************************************************************************/
twimlActions.Dial = function(command, callback) {

  var call = command.call;
  //var channel = call.channel;
  var client = call.client;
  var playback = null;

  console.log("Channel " + call.channel.id + " - Dialing: " + command.value);

  var originate = function(channel, destination, callerId) {
    var dialed = client.Channel();

		// rather than registering another handler, perhaps this should hook the active
		// handler provided by the call object?
    channel.on('StasisEnd', function(event, channel) {
      hangupDialed(channel, dialed);
    });

    dialed.on('ChannelDestroyed', function(event, dialed) {
      hangupOriginal(channel, dialed);
    });

    dialed.on('StasisStart', function(event, dialed) {
      joinMixingBridge(channel, dialed);
    });

    dialed.originate({
        endpoint: destination,
        app: 'aria',
        callerId: callerId,
        appArgs: 'dialed'
      },
      function(err, dialed) {
        if (err) {
          console.log("Channel " + channel.id + " - Error originating outbound call: " + err.message);
          exit();
        }
      });
  }

	var exit = function() {
    if (call.hungup) {
      return call.terminateCall();
    } else {
      return callback();
    }
	}
	
  // handler for original channel hanging up so we can gracefully hangup the
  // other end
  var hangupDialed = function(channel, dialed) {
    console.log(
      'Channel %s - Channel has left the application. Hanging up dialed channel %s',
      channel.id, dialed.id);

    // hangup the other end
    dialed.hangup(function(err) {
      // ignore error since dialed channel could have hung up, causing the
      // original channel to exit Stasis
    });
  }

  var hangupOriginal = function(channel, dialed) {
    console.log('Channel %s - Dialed channel %s has been hung up. Terminating call.',
      channel.id, dialed.id);

    // hangup the other end
    channel.hangup(function(err) {
      // ignore error since original channel could have hung up, causing the
      // dialed channel to exit Stasis
    });
  }

  // handler for dialed channel entering Stasis
  var joinMixingBridge = function(channel, dialed) {
    var bridge = client.Bridge();

    dialed.on('StasisEnd', function(event, dialed) {
      dialedExit(dialed, bridge);
    });

    dialed.answer(function(err) {
      if (err) {
        throw err;
      }
    });

    bridge.create({
      type: 'mixing'
    }, function(err, bridge) {
      if (err) {
        throw err;
      }

      console.log('Channel %s - Created bridge %s', channel.id, bridge.id);

      addChannelsToBridge(channel, dialed, bridge);
    });
  }

  // handler for the dialed channel leaving Stasis
  var dialedExit = function(dialed, bridge) {
    console.log(
      'Channel %s - Dialed channel %s has left our application, destroying bridge %s',
      call.channel.id, dialed.name, bridge.id);

    bridge.destroy(function(err) {
      if (err) {
        throw err;
      }
    });
  }

  // handler for new mixing bridge ready for channels to be added to it
  var addChannelsToBridge = function(channel, dialed, bridge) {
    console.log('Channel %s - Adding channel %s and dialed channel %s to bridge %s',
      channel.id, channel.id, dialed.id, bridge.id);

    bridge.addChannel({
      channel: [channel.id, dialed.id]
    }, function(err) {
      if (err) {
        throw err;
      }
    });
  }

  var dest = "PJSIP/" + command.value + "@twilio1";
  var cid = command.parameters.callerId || "";
  originate(call.channel, dest, cid);

  /*	
  	setTimeout(function() {
      if (call.hungup) {
        return call.terminateCall();
      } else {
        return callback();
      }
  	}, 100);    
  */
};