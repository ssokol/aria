# Aria
## A Twiml interpreter built on Asterisk's ARI

Aria is a node.js application that allows applications built using Twilio's Twiml
markup language to be run on an Asterisk server.

## Requirements

* Node.js
* Asterisk 13
* Redis
* Grunt
* Flite Text-To-Speech Engine


## Installation

### Asterisk

Aria is installed on your Asterisk 13 server. So the first thing you will need is an
Asterisk 13 server. A default build will work as long as you have everything required
for ARI.

You will need to enable ARI and add an ARI user. Information about enabling ARI can
be found here: https://wiki.asterisk.org/wiki/display/AST/Getting+Started+with+ARI

**Aria Configuration File**

Once you have ARI enabled and a user added, you will need to put the host, username
and password into the Aira configuration file: /etc/asterisk/aria.conf.js

    exports.username = "demo";
    exports.password = "asterisk123";
    exports.asterisk = "http://localhost:8088";
    exports.trunk = {technology: "PJSIP", id: "twilio1"};
    exports.audioPath = "/var/lib/asterisk/sounds/";
    exports.recordingPath = "/var/spool/asterisk/recording/";
    exports.recordingPort = 8888;
    exports.serverBaseUrl = "http://ast13demo.local:8888/"
    
Replace the "demo" value with your ARI username, and "asterisk123" with your ARI user's
password. If you're running ARI on a server other than your Asterisk you will need to 
edit the "asterisk" value appropriately. (Note that if you do, you will also have to 
handle several other challenges related to audio file location.)

### Aria

Clone the repo into some directory on your Asterisk server:

    cd /opt
    git clone https://github.com/ssokol/aria/aria.git

Once you have cloned the repository you will need to install all of the required 
node modules using npm:

    cd aria
    npm install --dev
    
This will install all of the necessary node modules plus some development tools. Next
you will need to run some grunt tasks to get the aria application assembled and ready
to run:

    grunt
    
That should concatenate together all of the parts of the application and start it 
running.

To run the app without grunt, simply type:

    node index.js
    
### Redis

Ultimately I hope to add a small Express application to provide a simple web API and
UI for adding numbers to Aria. For now, you can do it manually from the CLI:

    redis-cli
    hset /numbers/+18005551212 method GET
    hset /numbers/+18005551212 url "http://www.server.com/twiml/start.xml"
    
You will need to configure your SIP trunks or PSTN lines to send calls into Aria. Once
in Aria the dialed number will be looked up and the system will fetch and execute the
instructions in the Twiml returned.

## Status

At this point Aria is still very early. The following Twiml actions work (for some
value of 'work'):

* Play
* Say
* Record
* Gather
* Dial
* Hangup
* Redirect
* Pause
* Answer - non-standard
* Hold - non-standard
* Bridge - non-standard

The following actions are not implemented (though there are placeholder files for
all of them in the src directory):

* SMS
* Message - non-standard
* Leave
* Enqueue

Most of these verbs are missing some of the functionality that Twilio provides. For
example, the terminal verbs (gather, dial) do not yet post a full call summary back
when the call terminates. The Dial verb is currently limited to calling e.164 phone
numbers. Support for calling conferences, clients, queues, and SIP endpoints has yet
to be incorporated.

## Non-Standard Stuff

I've attempted to implement the majority of the actual Twilio standard, but it strikes me 
as a bit limite when you compare it with the full feature set of ARI. I've taken the libert
of adding in a few things that "real" Twiml can't do.

1. You can originate a call using Dial that does not automatically bridge to the incoming call. (You can do similar things with the Twilio REST API but they don't let you do it from raw Twiml, as far as I can tell.) This allows you do things like call screening: the incoming call can be held (see below) while the newly created outbound call follows its own path. If at some point you want to reconnect those calls you can use the new **Bridge** action.

1. You can place a call on hold. For the moment, this is the state in which the call remains until it either hangs up or is bridged. I'll add an unhold function shortly (there's already a placeholder function built). At the moment this uses the default holding bridge, but I suspect we can probably come up with a way to specify a preferred bridge. 

1. You can (and should) explicitly **Answer** the call with my version. This allows you to do various things prior to answering. Twilio answers any call in any case where the first verb is NOT "Reject". I find that a bit limiting. Your code should have an opportunity to do things prior to answering.

1. The **Record** verb returns two values: the canonical "RecordingURL" (which assumes you have your server running some place reachable - for whatever value of "reachable" is useful to your overall application) and the relative "RecordingURI" which is the local URI for playback via ARI. The "Play" verb is able to discriminate between these types of values and can skip the download process for local URIs - something that may or may not make a difference depending on how your system is configured. At the very least it avoids duplicating the recording.
 
1. There is now a web server built into Aria that makes everything in the recordings directory available over HTTP. At some point this probably should get some security added. Not sure if this is a good idea for really busy Aria systems - it might be better to spawn a separate process to handle serving up static files. Note that you'll need to set some values in /etc/asterisk/aria.conf.js for the port and recording source folder. (See above.)
