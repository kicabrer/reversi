/* Set up the static file server */

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




/* Set up the web socket server */


/* A registry of socket_ids and player information */

var players = [];

var io = require('socket.io').listen(app);

io.sockets.on('connection', function(socket){

	log('Client connection by '+socket.id);

	function log(){
		var array = ['*** Server Log Message: '];
		for(var i=0; i < arguments.length; i++){
			array.push(arguments[i]);
			console.log(arguments[i]);
		}
		socket.emit('log',array);
		socket.broadcast.emit('log',array);
	}


	/* join_room command */

	socket.on('join_room', function(payload){
		log('\'join_room\' command'+JSON.stringify(payload));


		/* Check that client sent a payload */

		if(('undefined' === typeof payload) || !payload){
			var error_message = 'join_room had no payload, command aborted';
			log(error_message);
			socket.emit('join_room_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}


		/* Check that payload has room to join */

		var room = payload.room;
		if(('undefined' === typeof room) || !room){
			var error_message = 'join_room didn\'t specify a room, command aborted';
			log(error_message);
			socket.emit('join_room_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}


		/* Check that a username has been provided */

		var username = payload.username;
		if(('undefined' === typeof username) || !username){
			var error_message = 'join_room didn\'t specify a username, command aborted';
			log(error_message);
			socket.emit('join_room_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}


		/* Store information about new player */

		players[socket.id] = {};
		players[socket.id].username = username;
		players[socket.id].room = room;


		/* Have user join the room */

		socket.join(room);


		/* Get room object */

		var roomObject = io.sockets.adapter.rooms[room];


		/* Tell everyone in room that new user joined */

		var numClients = roomObject.length;
		var success_data = {
							result: 'success',
							room: room,
							username: username,
							socket_id: socket.id,
							membership: numClients
							};

		io.in(room).emit('join_room_response',success_data);

		for(var socket_in_room in roomObject.sockets){
			var success_data = {
							result: 'success',
							room: room,
							username: players[socket_in_room].username,
							socket_id: socket_in_room,
							membership: numClients
							};
			socket.emit('join_room_response',success_data);
		}

		log('join_room success');
	});



	socket.on('disconnect', function(){
		log('Client disconnected '+JSON.stringify(players[socket.id]));

		if('undefined' !== typeof players[socket.id] && players[socket.id]){
			var username = players[socket.id].username;
			var room = players[socket.id].room;
			var payload = {
							username: username,
							socket_id: socket.id
						};
			delete players[socket.id];
			io.in(room).emit('player_disconnected',payload);
		}
	});


	/* send_message command */

	socket.on('send_message', function(payload){
		log('server received a command','send_message',payload);
		if(('undefined' === typeof payload) || !payload){
			var error_message = 'send_message had no payload, command aborted';
			log(error_message);
			socket.emit('send_message_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}

		var room = payload.room;
		if(('undefined' === typeof room) || !room){
			var error_message = 'send_message didn\'t specify a room, command aborted';
			log(error_message);
			socket.emit('send_message_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}

		var username = players[socket.id].username;
		if(('undefined' === typeof username) || !username){
			var error_message = 'send_message didn\'t specify a username, command aborted';
			log(error_message);
			socket.emit('send_message_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}

		var message = payload.message;
		if(('undefined' === typeof message) || !message){
			var error_message = 'send_message didn\'t specify a message, command aborted';
			log(error_message);
			socket.emit('send_message_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}

		var success_data = {
							result: 'success',
							room: room,
							username: username,
							message: message
							};

		io.in(room).emit('send_message_response',success_data);
		log('Message sent to room '+room+' by '+username);
	});


	/* invite command */

	socket.on('invite', function(payload){
		log('invite '+JSON.stringify(payload));


		/* Make sure payload was sent */

		if(('undefined' === typeof payload) || !payload){
			var error_message = 'invite had no payload, command aborted';
			log(error_message);
			socket.emit('invite_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}


		/* Check that message can be traced to username */

		var username = players[socket.id].username;
		if(('undefined' === typeof username) || !username){
			var error_message = 'invite can\'t identify who sent message';
			log(error_message);
			socket.emit('invite_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}

		var requested_user = payload.requested_user;
		if(('undefined' === typeof requested_user) || !requested_user){
			var error_message = 'invite didn\'t specify a requested_user, command aborted';
			log(error_message);
			socket.emit('invite_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}

		var room = players[socket.id].room;
		var roomObject = io.sockets.adapter.rooms[room];

		/* Make sure user invited is in the room */

		if(!roomObject.sockets.hasOwnProperty(requested_user)){
			var error_message = 'invite requested user who is not in the room, command aborted';
			log(error_message);
			socket.emit('invite_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}


		/* If everything works, respond to inviter that invite is successful */

		var success_data = {
							result: 'success',
							socket_id: requested_user
							};
		socket.emit('invite_response',success_data);


		/* Tell invitee that they have been invited */

		var success_data = {
							result: 'success',
							socket_id: socket.id
							};
		socket.to(requested_user).emit('invited',success_data);
		log ('invite successful');
	});


	/* uninvite command */

	socket.on('uninvite', function(payload){
		log('uninvite '+JSON.stringify(payload));


		/* Make sure payload was sent */

		if(('undefined' === typeof payload) || !payload){
			var error_message = 'uninvite had no payload, command aborted';
			log(error_message);
			socket.emit('uninvite_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}


		/* Check that message can be traced to username */

		var username = players[socket.id].username;
		if(('undefined' === typeof username) || !username){
			var error_message = 'uninvite can\'t identify who sent message';
			log(error_message);
			socket.emit('uninvite_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}

		var requested_user = payload.requested_user;
		if(('undefined' === typeof requested_user) || !requested_user){
			var error_message = 'uninvite didn\'t specify a requested_user, command aborted';
			log(error_message);
			socket.emit('uninvite_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}

		var room = players[socket.id].room;
		var roomObject = io.sockets.adapter.rooms[room];

		/* Make sure requested user is in the room */

		if(!roomObject.sockets.hasOwnProperty(requested_user)){
			var error_message = 'uninvite requested user who is not in the room, command aborted';
			log(error_message);
			socket.emit('uninvite_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}


		/* If everything works, respond to requester that uninvite is successful */

		var success_data = {
							result: 'success',
							socket_id: requested_user
							};
		socket.emit('uninvite_response',success_data);


		/* Tell requested user that they have been uninvited */

		var success_data = {
							result: 'success',
							socket_id: socket.id
							};
		socket.to(requested_user).emit('uninvited',success_data);
		log ('uninvite successful');
	});



	/* game_start command */

	socket.on('game_start', function(payload){
		log('game_start '+JSON.stringify(payload));


		/* Make sure payload was sent */

		if(('undefined' === typeof payload) || !payload){
			var error_message = 'game_start had no payload, command aborted';
			log(error_message);
			socket.emit('game_start_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}


		/* Check that message can be traced to username */

		var username = players[socket.id].username;
		if(('undefined' === typeof username) || !username){
			var error_message = 'game_start can\'t identify who sent message';
			log(error_message);
			socket.emit('game_start_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}

		var requested_user = payload.requested_user;
		if(('undefined' === typeof requested_user) || !requested_user){
			var error_message = 'game_start didn\'t specify a requested_user, command aborted';
			log(error_message);
			socket.emit('game_start_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}

		var room = players[socket.id].room;
		var roomObject = io.sockets.adapter.rooms[room];

		/* Make sure requested user is in the room */

		if(!roomObject.sockets.hasOwnProperty(requested_user)){
			var error_message = 'game_start requested user who is not in the room, command aborted';
			log(error_message);
			socket.emit('game_start_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}


		/* If everything works, respond to requester that game_start is successful */

		var game_id = Math.floor((1 + Math.random()) *0x10000).toString(16).substring(1);
		var success_data = {
							result: 'success',
							socket_id: requested_user,
							game_id: game_id
							};
		socket.emit('game_start_response',success_data);


		/* Tell requested user to play */

		var success_data = {
							result: 'success',
							socket_id: socket.id,
							game_id: game_id
							};
		socket.to(requested_user).emit('game_start_response',success_data);
		log ('game_start successful');
	});
});