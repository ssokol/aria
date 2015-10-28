/**************************************************************************************

    Aria Bridge action
    
    Bridge two legs together in a call. Assumes that there are valid values for
    call.originatingChannel and call.dialedChannel.

**************************************************************************************/
twimlActions.Bridge = function(command, callback) {

  var call = command.call;
  var client = call.client;
  
  console.log("Channel " + call.originatingChannel.id + " - Bridge");

  // handler for original channel hanging. gracefully hangup the dialed channel
  var hangupDialed = function(channel, dialed) {
    console.log(
      "Channel %s - Channel has left the application. Hanging up dialed channel %s",
      channel.id, dialed.id);

    // hangup the other end
    dialed.hangup(function(err) {
      // ignore error since dialed channel could have hung up, causing the
      // original channel to exit Stasis
    });
  };

  // handler for dialed channel hanging up.
  var hangupOriginal = function(channel, dialed) {
    console.log(
      "Channel %s - Dialed channel %s has been hung up.",
      channel.id, dialed.id);

    // hangup the original channel
    channel.hangup(function(err) {
      // ignore error since original channel could have hung up, causing the
      // dialed channel to exit Stasis
    });
  };

  // handler for dialed channel entering Stasis
  var joinMixingBridge = function(channel, dialed) {
    var bridge = client.Bridge();

    dialed.on("StasisEnd", function(event, dialed) {
      dialedExit(dialed, bridge);
    });

    dialed.answer(function(err) {
      if (err) {
        throw err; // TODO: trap and handle this.
      }
      console.log(
        "Channel %s - Dialed channel %s has been answered.",
        channel.id, dialed.id);
    });

    bridge.create({
      type: "mixing"
    }, function(err, bridge) {
      if (err) {
        throw err; // TODO: trap and handle this.
      }

      console.log("Channel %s - Created bridge %s", channel.id, bridge.id);

      addChannelsToBridge(channel, dialed, bridge);
    });
  };

  // handler for the dialed channel leaving Stasis
  var dialedExit = function(dialed, bridge) {
    console.log(
      "Channel %s - Dialed channel %s has left our application, destroying bridge %s",
      call.channel.id, dialed.name, bridge.id);

    bridge.destroy(function(err) {
      if (err) {
        throw err;
      }
    });
  };

  // handler for new mixing bridge ready for channels to be added to it
  var addChannelsToBridge = function(channel, dialed, bridge) {
    console.log("Channel %s - Adding channel %s and dialed channel %s to bridge %s",
      channel.id, channel.id, dialed.id, bridge.id);

    bridge.addChannel({
      channel: [channel.id, dialed.id]
    }, function(err) {
      if (err) {
        throw err;
      }
    });
  };


  // rather than registering another handler, perhaps this should hook the active
  // handler provided by the call object?
  call.originatingChannel.on("StasisEnd", function(event, channel) {
    hangupDialed(channel, call.dialedChannel);
  });

  call.dialedChannel.on("ChannelDestroyed", function(event, dialed) {
    hangupOriginal(call.originatingChannel, dialed);
  });

  joinMixingBridge(call.originatingChannel, call.dialedChannel);

};


