/* Include static file webserver library */
var static = require('node-static');

/* Include http server library */
var http = require('http');

/* Assume run on Heroku */
var port =  process.env.PORT;
var directory = __dirname + '/public';

/* If not on Heroku */
if(typeof port == 'undefined' || !port) {
	directory = './public';
	port = 8080;
}

/* Set up static webserver */
var file = new static.Server(directory);

/* Construct http server */
var app = http.createServer(
	function(request,response) {
		request.addListener('end',
			function() {
				file.serve(request,response);
			}
			)
		.resume();
	}
	)
.listen(port);

console.log('The server is running.');