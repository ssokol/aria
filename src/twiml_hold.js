/**************************************************************************************

    Aria Hold action
    
    Hold the active call leg.

**************************************************************************************/
twimlActions.Hold = function(command, callback) {

  var call = command.call;
  var channel = call.channel;
  var client = call.client;
  var playback = null;
  var bridge = null;
  
  console.log("Channel " + channel.id + " - Hold");

  // find or create a holding bridge
  
  client.bridges.list(function(err, bridges) {
    if (err) {
      throw err;
    }

    bridge = bridges.filter(function(candidate) {
      return candidate.bridge_type === 'holding';
    })[0];

    if (bridge) {
      console.log(util.format('Using bridge %s', bridge.id));
      start();
    } else {
      client.bridges.create({type: 'holding'}, function(err, newBridge) {
        if (err) {
          throw err;
        }
        bridge = newBridge;
        console.log(util.format('Created bridge %s', bridge.id));
        start();
      });
    }
  });

  // continue the call on the next tick
  var start = function() {
    setTimeout(function() {
      bridge.addChannel({channel: channel.id}, function(err) {
        if (err) {
          throw err;
        }

        bridge.startMoh(function(err) {
          if (err) {
            throw err;
          }
          return callback();
        });
      });
    }, 0);
  }
};


