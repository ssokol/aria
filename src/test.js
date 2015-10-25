/*
	<dial action="http://whatever.com/something.xml" method="GET" timeout="30" 
	  hangupOnStar="false" timeLimit="14400" callerId="+18168068844" 
	  record="record-from-answer" trim="trim-silence">
	  <number>+12564286101</number>
	</dial>
	<say>Thanks</say>
*/

{ Response:
	{ 
   		Dial: { callerId: '+12564286060', '$t': '415-123-4567' },
		Say: 'Goodbye' 
	} 
}