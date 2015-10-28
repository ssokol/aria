/**************************************************************************************

    Aria Gather action
    
    Collect digits, optionally playing prompts to the caller. On completion,
    submit the digits (along with standard call data) to the provided 'action'
    URL.
    
    Parameters
    
    Nested Elements
    
**************************************************************************************/
twimlActions.Gather = function(command, callback) {

  var call = command.call;
  var channel = call.channel;
  var client = call.client;

  console.log("Channel " + channel.id + " - Gathering: " + command.value);

  var timeout = command.parameters.timeout || 5;
  var timer = null;

  // clear the digit buffer?
  if (command.parameters.clear !== "false") {
    call.digits = "";
  }

  // set the max digits and terminator values
  call.maxDigits = parseInt(command.parameters.numDigits, 10) || 0;
  call.termDigit = command.parameters.finishOnKey || "#";

  var collectDigits = function() {
    // if the buffer already has enough we can move on...
    if ((call.maxDigits > 0) && (call.digits.length >= call.maxDigits)) {
      return doneCollecting();
    }

    // otherwise set a callback for digit events
    call.digitCallback = function(digit, digits) {
      if (digit === call.termDigit) {
        // done - received term digit;
        doneCollecting();
      } else
      if ((call.maxDigits > 0) && (digits.length >= call.maxDigits)) {
        // done - hit max length
        doneCollecting();
      }
    };

    call.hangupCallback = function() {
      doneCollecting();
    };

    // and set the timer for our timeout
    timer = setTimeout(doneCollecting, timeout * 1000);
  };

  var doneCollecting = function(digits) {

    call.digitCallback = null;
    call.hangupCallback = null;

		// snapshot as the buffer could change
    var returnDigits = call.digits;
    call.digits = "";
    
    console.log("Channel " + channel.id + " - Done gathering. Collected: " + returnDigits);
    
    // clear the timer
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    // bail if the call has been hung up
    if (call.hungup) {
      return call.terminateCall();
    }

    // If the user entered any digits, use the action / method parameters
    // to send the value to the user's server
    if (returnDigits.length > 0) {
      // send digits to the server, get next XML block
      var method = command.parameters.method || "POST";
      var url = command.parameters.action || call.baseUrl;
      var form = new formdata();
      setCallData(call, form);
      form.append("Digits", returnDigits);
      return fetchTwiml(method, url, call, form);
    } else {
      // fail - continue on to the next action
      return callback();
    }
  };

  // THIS IS THE NESTED COMMAND HANDLER - CAN THIS BE MADE GENERIC????
  // var nccb = function() {
  //     next child logic here
  // }
  // runNestedCommands(command, nccb, function() {
  //     // do the next thing (collect, record, etc.)
  // });    
  // if there are embedded play or say commands, execute them
  
  var child = command.children;

  // run the nested child action if it is valid
  var runChild = function() {
    // bail if the call has been hung up
    if (call.hungup) {
      return call.terminateCall();
    }

    // move past any verbs other than Play or Say
    while ((child) && ((child.name !== "Play") && (child.name !== "Say"))) {
      console.log("Channel " + channel.id + " - Invalid nested verb: " + child.name + ". Skipped");
      child = child.next;
    }
    if (child) {
      var action = twimlActions[child.name];
      child.parameters.termDigits = "1234567890*#"; // any key will terminate input
      child.parameters.clear = false; // do not allow the Play or Say command to clear the buffer
      action(child, nextChild);
    } else {
      collectDigits();
    }
  };

  // move the pointer to the next child and play it, otherwise start gathering
  var nextChild = function() {
    if ((child.next) && (call.digits.length === 0)) {
      child = child.next;
      runChild();
    } else {
      collectDigits();
    }
  };

  // if the gather verb has nested children, execute them. otherwise collect digits
  if (child) {
    runChild();
  } else {
    collectDigits();
  }
};


