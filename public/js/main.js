/* Functions for general use */

/* This function returns the value associated with whichParam on the URL */

function getURLParameters(whichParam)
{
	var pageURL = window.location.search.substring(1);
	var pageURLVariables = pageURL.split('&');
	for(var i=0; i<pageURLVariables.length; i++)
	{
		var parameterName = pageURLVariables[i].split('=');
		if(parameterName[0] == whichParam)
		{
			return parameterName[1];
		}
	}
}

var username = getURLParameters('username');
if('undefined' == typeof username || !username)
{
	username = 'Anon_'+Math.random();
}

var chat_room = getURLParameters('game_id');
if('undefined' == typeof chat_room || !chat_room)
{
	chat_room = 'lobby';
}


/* Connect to the socket server */

var socket = io.connect();


/* What to do when the server sends me a log message */

socket.on('log',function(array){
	console.log.apply(console,array);
});


/* What to do when the server says someone joined room */

socket.on('join_room_response', function(payload){
	if(payload.result == 'fail'){
		alert(payload.message);
		return;
	}


	/* If we join room, ignore notification */

	if(payload.socket_id == socket.id){
		return;
	}


	/* If someone joins room, add new row to lobby table */

	var dom_elements = $('.socket_'+payload.socket_id);


	/* If no previous entry for this username */

	if(dom_elements.length == 0){
		var nodeA = $('<div></div>');
		nodeA.addClass('socket_'+payload.socket_id);

		var nodeB = $('<div></div>');
		nodeB.addClass('socket_'+payload.socket_id);

		var nodeC = $('<div></div>');
		nodeC.addClass('socket_'+payload.socket_id);

		nodeA.addClass('w-100');

		nodeB.addClass('col-9 text-right');
		nodeB.append('<h3>'+payload.username+'</h3>');

		nodeC.addClass('col-3 text-left');
		var buttonC = makeInviteButton(payload.socket_id);
		nodeC.append(buttonC);

		nodeA.hide();
		nodeB.hide();
		nodeC.hide();
		$('#players').append(nodeA,nodeB,nodeC);
		nodeA.slideDown(1000);
		nodeB.slideDown(1000);
		nodeC.slideDown(1000);
	}
	else{
		uninvite(payload.socket_id);
		var buttonC = makeInviteButton(payload.socket_id);
		$('.socket_'+payload.socket_id+' button').replaceWith(buttonC);
		dom_elements.slideDown(1000);
	}


	/* If someone joins room, manage message that new player has joined */

	var newHTML = '<p>'+payload.username+' joined the room.</p>';
	var newNode = $(newHTML);
	newNode.hide();
	$('#messages').append(newNode);
	newNode.slideDown(1000);
});


/* What to do when the server says someone left room */

socket.on('player_disconnected', function(payload){
	if(payload.result == 'fail'){
		alert(payload.message);
		return;
	}


	/* If we leave room, ignore notification */

	if(payload.socket_id == socket.id){
		return;
	}


	/* If someone leaves room, animate out their content */

	var dom_elements = $('.socket_'+payload.socket_id);


	/* If entry exists */

	if(dom_elements.length != 0){
		dom_elements.slideUp(1000);
	}


	/* If someone leaves room, manage message that player has left */

	var newHTML = '<p>'+payload.username+' left the room.</p>';
	var newNode = $(newHTML);
	newNode.hide();
	$('#messages').append(newNode);
	newNode.slideDown(1000);
});


/* Send invite message to the server */

function invite(who){
	var payload = {};
	payload.requested_user = who;

	console.log('*** Client Log Message: \'invite\' payload'+JSON.stringify(payload));
	socket.emit('invite',payload);
}


/* Handle response after sending invite message to server */

socket.on('invite_response', function(payload){
	if(payload.result == 'fail'){
		alert(payload.message);
		return;
	}
	var newNode = makeInvitedButton(payload.socket_id);
	$('.socket_'+payload.socket_id+' button').replaceWith(newNode);
});


/* Handle notification that we have been invited */

socket.on('invited', function(payload){
	if(payload.result == 'fail'){
		alert(payload.message);
		return;
	}
	var newNode = makePlayButton(payload.socket_id);
	$('.socket_'+payload.socket_id+' button').replaceWith(newNode);
});



/* Send uninvite message to the server */

function uninvite(who){
	var payload = {};
	payload.requested_user = who;

	console.log('*** Client Log Message: \'uninvite\' payload'+JSON.stringify(payload));
	socket.emit('uninvite',payload);
}


/* Handle response after sending uninvite message to server */

socket.on('uninvite_response', function(payload){
	if(payload.result == 'fail'){
		alert(payload.message);
		return;
	}
	var newNode = makeInviteButton(payload.socket_id);
	$('.socket_'+payload.socket_id+' button').replaceWith(newNode);
});


/* Handle notification that we have been uninvited */

socket.on('uninvited', function(payload){
	if(payload.result == 'fail'){
		alert(payload.message);
		return;
	}
	var newNode = makeInviteButton(payload.socket_id);
	$('.socket_'+payload.socket_id+' button').replaceWith(newNode);
});



/* Send game_start message to the server */

function game_start(who){
	var payload = {};
	payload.requested_user = who;

	console.log('*** Client Log Message: \'game_start\' payload'+JSON.stringify(payload));
	socket.emit('game_start',payload);
}


/* Handle notification that we have been engaged to play */

socket.on('game_start_response', function(payload){
	if(payload.result == 'fail'){
		alert(payload.message);
		return;
	}
	var newNode = makeEngagedButton(payload.socket_id);
	$('.socket_'+payload.socket_id+' button').replaceWith(newNode);


	/* Jump to a new page */
	window.location.href = 'game.html?username='+username+'&game_id='+payload.game_id;
});



function send_message(){
	var payload = {};
	payload.room = chat_room;
	payload.message = $('#send_message_holder').val();
	console.log('*** Client Log Message: \'send_message\' payload: '+JSON.stringify(payload));
	socket.emit('send_message',payload);
}

socket.on('send_message_response', function(payload){
	if(payload.result == 'fail'){
		alert(payload.message);
		return;
	}
	var newHTML = '<p><b>'+ payload.username +' says:</b> '+ payload.message +'</p>';
	var newNode = $(newHTML);
	newNode.hide();
	$('#messages').append(newNode);
	newNode.slideDown(1000);
});



function makeInviteButton(socket_id){
	var newHTML = '<button type=\'button\' class=\'btn btn-light\'>Invite</button>';
	var newNode = $(newHTML);
	newNode.click(function(){
		invite(socket_id);
	});
	return(newNode);
}

function makeInvitedButton(socket_id){
	var newHTML = '<button type=\'button\' class=\'btn btn-outline-dark\'>Invited</button>';
	var newNode = $(newHTML);
	newNode.click(function(){
		uninvite(socket_id);
	});
	return(newNode);
}

function makePlayButton(socket_id){
	var newHTML = '<button type=\'button\' class=\'btn btn-dark\'>Play</button>';
	var newNode = $(newHTML);
	newNode.click(function(){
		game_start(socket_id);
	});
	return(newNode);
}

function makeEngagedButton(){
	var newHTML = '<button type=\'button\' class=\'btn btn-outline-dark\'>Loading</button>';
	var newNode = $(newHTML);
	return(newNode);
}



$(function(){
	var payload = {};
	payload.room = chat_room;
	payload.username = username;

	console.log('*** Client Log Message: \'join_room\' payload: '+JSON.stringify(payload));
	socket.emit('join_room',payload);
});