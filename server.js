/*********************************/
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


/********************************/
/* Set up the web socket server */

/* Registry of socket_ids and player information */
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


	/*********************/
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

		if(room !== 'lobby'){
			send_game_update(socket,room,'initial update');
		}
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


	/************************/
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


	/******************/
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


	/********************/
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


	/**********************/
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


	/**********************/
	/* play_token command */

	socket.on('play_token', function(payload){
		log('play_token '+JSON.stringify(payload));

		/* Make sure payload was sent */
		if(('undefined' === typeof payload) || !payload){
			var error_message = 'play_token had no payload, command aborted';
			log(error_message);
			socket.emit('play_token_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}

		/* Check that player has previously registered */
		var player = players[socket.id];
		if(('undefined' === typeof player) || !player){
			var error_message = 'Server doesn\'t recognize you. Try going back to lobby.';
			log(error_message);
			socket.emit('play_token_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}

		/* Check that message can be traced to username */
		var username = players[socket.id].username;
		if(('undefined' === typeof username) || !username){
			var error_message = 'play_token can\'t identify who sent message';
			log(error_message);
			socket.emit('play_token_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}

		/* Check game_id */
		var game_id = players[socket.id].room;
		if(('undefined' === typeof game_id) || !game_id){
			var error_message = 'play_token can\'t find your game board';
			log(error_message);
			socket.emit('play_token_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}

		/* Check row */
		var row = payload.row;
		if(('undefined' === typeof row) || row < 0 || row > 7){
			var error_message = 'play_token didn\'t specify a valid row, command aborted';
			log(error_message);
			socket.emit('play_token_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}

		/* Check column */
		var column = payload.column;
		if(('undefined' === typeof column) || column < 0 || column > 7){
			var error_message = 'play_token didn\'t specify a valid column, command aborted';
			log(error_message);
			socket.emit('play_token_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}

		/* Check color */
		var color = payload.color;
		if(('undefined' === typeof color) || !color || (color!='ruby' && color!='denim')){
			var error_message = 'play_token didn\'t specify a valid color, command aborted';
			log(error_message);
			socket.emit('play_token_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}

		/* Check color */
		var game = games[game_id];
		if(('undefined' === typeof game) || !game){
			var error_message = 'play_token couldn\'t find your game board';
			log(error_message);
			socket.emit('play_token_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}

		/* Out of turn error */
		if(color !== game.whose_turn){
			var error_message = 'play_token message played out of turn';
			log(error_message);
			socket.emit('play_token_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}

		/* Wrong socket is playing the color */
		if(
			((game.whose_turn === 'ruby') && (game.player_ruby.socket != socket.id)) || 
			((game.whose_turn === 'denim') && (game.player_denim.socket != socket.id))
			){
			var error_message = 'play_token turn played by wrong player';
			log(error_message);
			socket.emit('play_token_response', {
												result: 'fail',
												message: error_message
											});
			return;
		}

		/* Send response */
		var success_data = {
							result: 'success',
							};
		socket.emit('play_token_response',success_data);

		/* Execute the move */
		if(color == 'ruby'){
			game.board[row][column] = 'r';
			flip_board('r',row,column,game.board);
			game.whose_turn = 'denim';
			game.legal_moves = calculate_valid_moves('d',game.board);
		}
		else if(color == 'denim'){
			game.board[row][column] = 'd';
			flip_board('d',row,column,game.board);
			game.whose_turn = 'ruby';
			game.legal_moves = calculate_valid_moves('r',game.board);
		}

		var d = new Date();
		game.last_move_time = d.getTime();

		send_game_update(socket,game_id,'played a token');
	});
});


/**************/
/* Game state */

var games = [];

function create_new_game(){
	var new_game = {};
	new_game.player_ruby = {};
	new_game.player_denim = {};
	new_game.player_ruby.socket = '';
	new_game.player_ruby.username = '';
	new_game.player_denim.socket = '';
	new_game.player_denim.username = '';

	var d = new Date();
	new_game.last_move_time = d.getTime();

	new_game.whose_turn = 'denim';

	new_game.board = [
						[' ',' ',' ',' ',' ',' ',' ',' '],
						[' ',' ',' ',' ',' ',' ',' ',' '],
						[' ',' ',' ',' ',' ',' ',' ',' '],
						[' ',' ',' ','r','d',' ',' ',' '],
						[' ',' ',' ','d','r',' ',' ',' '],
						[' ',' ',' ',' ',' ',' ',' ',' '],
						[' ',' ',' ',' ',' ',' ',' ',' '],
						[' ',' ',' ',' ',' ',' ',' ',' ']
	];

	new_game.legal_moves = calculate_valid_moves('d',new_game.board);

	return new_game;
}

/* Check if there is a color 'who' on the line starting at (r,c) or
/* anywhere further by adding dr or dc to (r,c) */
function check_line_match(who,dr,dc,r,c,board){
	if(board[r][c] === who){
		return true;
	}
	if(board[r][c] === ' '){
		return false;
	}

	if((r+dr < 0) || (r+dr > 7)){
		return false;
	}
	if((c+dc < 0) || (c+dc > 7)){
		return false;
	}
	return check_line_match(who,dr,dc,r+dr,c+dc,board);
}

/* Check is position at r,c contains the opposite of 'who' on the board
/* and if line indicated by adding dr to r and dc to c eventually ends in'who' color */
function valid_move(who,dr,dc,r,c,board){
	var other;
	if(who === 'd'){
		other = 'r';
	}
	else if(who === 'r'){
		other = 'd';
	}
	else{
		log('Houston we have a color problem:'+who);
		return false;
	}
	if((r+dr < 0) || (r+dr > 7)){
		return false;
	}
	if((c+dc < 0) || (c+dc > 7)){
		return false;
	}
	if(board[r+dr][c+dc] != other){
		return false;
	}
	if((r+dr+dr < 0) || (r+dr+dr > 7)){
		return false;
	}
	if((c+dc+dc < 0) || (c+dc+dc > 7)){
		return false;
	}
	return check_line_match(who,dr,dc,r+dr+dr,c+dc+dc,board);
}

function calculate_valid_moves(who,board){
	var valid = [
					[' ',' ',' ',' ',' ',' ',' ',' '],
					[' ',' ',' ',' ',' ',' ',' ',' '],
					[' ',' ',' ',' ',' ',' ',' ',' '],
					[' ',' ',' ',' ',' ',' ',' ',' '],
					[' ',' ',' ',' ',' ',' ',' ',' '],
					[' ',' ',' ',' ',' ',' ',' ',' '],
					[' ',' ',' ',' ',' ',' ',' ',' '],
					[' ',' ',' ',' ',' ',' ',' ',' ']
	];

	for(row = 0; row < 8; row++){
		for(column = 0; column < 8; column++){
			if(board[row][column] === ' '){
				nw = valid_move(who,-1,-1,row,column,board);
				nn = valid_move(who,-1, 0,row,column,board);
				ne = valid_move(who,-1, 1,row,column,board);

				ww = valid_move(who, 0,-1,row,column,board);
				ee = valid_move(who, 0, 1,row,column,board);

				sw = valid_move(who, 1,-1,row,column,board);
				ss = valid_move(who, 1, 0,row,column,board);
				se = valid_move(who, 1, 1,row,column,board);

				if( nw || nn || ne || ww || ee || sw || ss || se){
					valid[row][column] = who;
				}
			}
		}
	}
	return valid;
}

function flip_line(who,dr,dc,r,c,board){
	if((r+dr < 0) || (r+dr > 7)){
		return false;
	}
	if((c+dc < 0) || (c+dc > 7)){
		return false;
	}
	if(board[r+dr][c+dc] === ' '){
		return false;
	}
	if(board[r+dr][c+dc] === who){
		return true;
	}
	else{
		if(flip_line(who,dr,dc,r+dr,c+dc,board)){
			board[r+dr][c+dc] = who;
			return true;
		}
		else{
			return false;
		}
	}
}

function flip_board(who,row,column,board){
	flip_line(who,-1,-1,row,column,board);
	flip_line(who,-1, 0,row,column,board);
	flip_line(who,-1, 1,row,column,board);

	flip_line(who, 0,-1,row,column,board);
	flip_line(who, 0, 1,row,column,board);

	flip_line(who, 1,-1,row,column,board);
	flip_line(who, 1, 0,row,column,board);
	flip_line(who, 1, 1,row,column,board);
}

function send_game_update(socket, game_id, message){

	/* Check if game_id already exists */
	if(('undefined' === typeof games[game_id]) || !games[game_id]){

		/* No game exists. Create game */
		console.log('No game exists. Creating '+game_id+'for '+socket.id);
		games[game_id] = create_new_game();
	}

	/* Only 2 people in the room */
	var roomObject;
	var numClients;
	do{
		roomObject = io.sockets.adapter.rooms[game_id];
		numClients = roomObject.length;
		if(numClients > 2){
			console.log('Too many clients in room: '+game_id+'. #: '+numClients);
			if(games[game_id].player_ruby.socket == roomObject.sockets[0]){
				games[game_id].player_ruby.socket = '';
				games[game_id].player_ruby.username = '';
			}
			if(games[game_id].player_denim.socket == roomObject.sockets[0]){
				games[game_id].player_denim.socket = '';
				games[game_id].player_denim.username = '';
			}
			/* Kick one player out */
			var sacrifice = Object.keys(roomObject.sockets)[0];
			io.of('/').connected[sacrifice].leave(game_id);
		}

	}
	while((numClients-1) > 2);

	/* Assign socket a color */
	/* If current player is not assigned a color */
	if((games[game_id].player_ruby.socket != socket.id) && (games[game_id].player_denim.socket != socket.id)){
		console.log('Player isn\'t assigned a color: '+socket.id);

		/* No color to give user, reset game */
		if((games[game_id].player_ruby.socket != '') && (games[game_id].player_denim.socket != '')){
			games[game_id].player_ruby.socket = '';
			games[game_id].player_ruby.username = '';
			games[game_id].player_denim.socket = '';
			games[game_id].player_denim.username = '';
		}
	}

	/* Assign colors to players if not already done */
	if(games[game_id].player_ruby.socket == ''){
		if(games[game_id].player_denim.socket != socket.id){
			games[game_id].player_ruby.socket = socket.id;
			games[game_id].player_ruby.username = players[socket.id].username;
		}
	}
	if(games[game_id].player_denim.socket == ''){
		if(games[game_id].player_ruby.socket != socket.id){
			games[game_id].player_denim.socket = socket.id;
			games[game_id].player_denim.username = players[socket.id].username;
		}
	}

	/* Send game update */
	var success_data = {
						result: 'success',
						game: games[game_id],
						message: message,
						game_id: game_id,
					};
	io.in(game_id).emit('game_update',success_data);

	/* Check if game is over */
	var row,column;
	var count = 0;
	var denim = 0;
	var ruby = 0;
	for(row = 0; row < 8; row++){
		for(column = 0; column < 8; column++){
			if(games[game_id].legal_moves[row][column] != ' '){
				count++;
			}
			if(games[game_id].board[row][column] === 'd'){
				denim++;
			}
			if(games[game_id].board[row][column] === 'r'){
				ruby++;
			}
		}
	}

	if(count == 0){
		/* Send game over message */
		var winner = 'tie game';
		if(denim > ruby){
			winner = 'denim';
		}
		if(ruby > denim){
			winner = 'ruby';
		}
		var success_data = {
							result: 'success',
							game: games[game_id],
							who_won: winner,
							game_id: game_id
						};
		io.in(game_id).emit('game_over', success_data);

		/* Delete old games after 1 hour */
		setTimeout(function(id){
			return function(){
				delete games[id];
			};
		}
		(game_id),60*60*1000
		);
	}
}


