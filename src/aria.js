/**************************************************************************************

	Aria Call Processor - Main Module

	This section of the overall Aria application creates a connection to the Asterisk
	server and serves as the entry point for incoming call requests signaled by the
	ARI "StasisStart" event.
	
	Configuration
	
	You will need to have Asterisk 13, Redis, and Node.js installed to run Aria.
	
	Configuration data is pulled from the 'aria.conf.js' file in the Asterisk directory 
	(/etc/asterisk). This file needs to export the values for the host, username and
	password as follows:
	
	exports.asterisk = [ip or host name / port]
	exports.username = [ARI user name from ari.conf]
	exports.password = [ARI password from ari.conf]
	
	The application starts, connects with Asterisk and registers an ARI application 
	called "aria". Your diplan needs to route calls to the aria application.
	
	    [aria-app]
	    exten => _X.,1,NoOp(Sending call into 'aria' application)
	         same => n,Stasis(aria)
	         same => n,Hangup     
	
	When a call arrives, Aria looks up the dialed number (${EXTEN}) in Redis. It expects
	a hash structure stored using a key that looks like:
	
	    /numbers/[number]
	
	This should return a hash structure with an "method" key and a "url" key. The
	"method" key should contain a string with either "GET" or "POST" in it. The 
	"url" key should include a fully qualified URL pointing to the application or raw
	Twiml script to execute.
	
**************************************************************************************/
(function() {

  var rc = null;

  // source the configuration
  var config = require('/etc/asterisk/aria.conf.js');

  function clientLoaded(err, client) {
    if (err) {
      throw err;
    }

    // handler for StasisStart event
    function stasisStart(event, channel) {

			if (event.args[0] === 'dialed') {
				console.log("Ignoring dialed call leg.");
				return;
			}
			
      console.log(util.format('Channel %s - Entered the application', channel.id));

      // figure out what technology is in use so we know what to use for routing
      var ctype = event.channel.name.split("/")[0];

      // SIP Client Call
      if ((ctype === "SIP") || (ctype === "PJSIP")) {

        // Route the call based on dialed Number
        var number = channel.dialplan.exten;

        // Replace the number with the value of arg[0] if present - FOR TESTING
        if (event.args[0]) {
          number = event.args[0];
        }

        // Query redis for the assigned url
        var lookup = "/numbers/" + number;
        var app = rc.hgetall(lookup, function(err, value) {
          if (err || !value) {
            // log the error to the appropriate facility

            // respond with a tri-tone error on the line
          } else {
            // fetch the Twiml from the provided url
            var call = new AriaCall(client, channel, value.url);
          }
        });

      } else

      // Respoke Client Call
      if (ctype === "RESPOKE") {
        // TODO - Handle Respoke Calls
      }

    }

    // handler for StasisEnd event
    function stasisEnd(event, channel) {
      console.log(util.format('Channel %s - Left the application', channel.id));
    }

    // create a redis client
    rc = redis.createClient();

    client.on('StasisStart', stasisStart);
    client.on('StasisEnd', stasisEnd);
    client.start('aria');
  }

  console.log("Initializing Aria Twiml actions.");
  Object.keys(twimlActions).forEach(function(key) {
    console.log(" - " + key);
  });
  // connect to the local Asterisk server
  // TODO: validate config values
  ari.connect(config.asterisk, config.username, config.password, clientLoaded);
}());