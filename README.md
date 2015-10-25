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

Once you have ARI enabled and a user added, you will need to put the host, username
and password into the Aira configuration file: /etc/asterisk/aria.conf.js

    exports.asterisk="http://localhost:8088";
    exports.username="demo";
    exports.password="asterisk123";
    
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
    
That should concatenate together all of the parts of the application. The current 
Gruntfile places the resulting file in the root directory of your install as
'index.js'.

To run the app, simply type:

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