/*This loads the mongo library for establishing connections to that database. Then, it loads the socket.io
* library and sets the server to listen on the specified port for clients.
*/
var mongo = require('mongodb').MongoClient, client = require('socket.io').listen(8080).sockets;

/*This establishes the connection to the local mongo database and then clears out all of the entries
* in the 'userlist' collection so that there are no ghost entries leftover from the previous instance
* of the running program.  This is necessary because whenever the server is restarted/stopped/started
* it establishes a new connection with the client and assigns it a new socket id.  This will cause
* issues if users try to reconnect with the same user id to the same chat room because it will see them
* in the database under a different socket id and it will not allow it.
*/

mongo.connect('mongodb://127.0.0.1/chat', function (err, db) {
    if (err)
        throw err;
    var collection = db.collection('userlist');
    collection.remove(function (err, result) {
    });
    /*This function is not complete.  Eventually this will refuse the connection if a specified number of
    * connections are already in progress from a singular IP.  Currently this just checks the count and then
    * adds the socket id and IP address into the 'userlist' collection in the mongo database.
    */
    client.on('connection', function (socket) {

        var ip = socket.handshake.address.address;
        //var id = socket.id;
        var collection = db.collection('userlist');
        collection.count({ip: ip}, function (e, count) {
            if (count > 5) {
                //console.log('more than 5');
            } else {
                //console.log('less than 5');
            }
            var insertion = {ip: ip, socket: socket.id};
            collection.insert(insertion, {w: 0});
        });
        /*This checks to make sure that a user name does not already exist in the specified chat room.
        * If the user exists it sends back the 'bad' otherwise it sends the 'good'.
        */
        socket.on('check', function (send) {
            var collection = db.collection('userlist');
            collection.count(send, function (e, count) {
                //console.log(count);
                if (count >= 1) {
                    socket.emit('bad');
                } else {
                    socket.emit('good');
                }
            })
        });
        /*This is triggered when a user disconnects from the server.  First, it triggers the 'user-disscon'
        * which removes the username from the userlist window in all of the users chat windows only in the
        * specified chat window.  Then, it sends a message to the same chat room that the user has disconnected.
        * After that, it removes the user entry from the 'userlist' collection in the mongo database.
        */
        socket.on('disconnect', function () {
            var collection = db.collection('userlist');
            collection.find({socket: this.id}).toArray(function (e, data) {
                if (data[0].name != undefined) {
                    client.in(data[0].room).emit('user-disscon', data[0].name);
                    client.in(data[0].room).emit('output', [{name: data[0].name, message: "has disconnected"}]);
                }

            });
            collection.remove({socket: this.id}, function (err, result) {
            });
        });
        /*After it has been determined that a user is able to join a room, this is triggered.  It updates the
        * 'userlist' collection that holds the socket id and IP with the user name and chat room.  Then, it uses
        * the socket.io join function to add that user to the specified room on the socket.io side.  After that,
        * it collects all of the users currently in that room and sends all of then only to the newly joined user.
        * Finally, it sends the newly joined user to all of the other users in that chat room.
        */
        socket.on('room', function (data) {
            var collection = db.collection('userlist');
            var socketid = {socket: socket.id};
            var info = {name: data.name, room: data.room};
            //console.log(socket.id + " " + data.name);
            collection.update(socketid, { $set: info}, function (e) {
                if (e !== null) {
                    console.log(e);
                }
            });
            socket.join(data.room);
            var userlist = {};
            collection.find({room: data.room}).toArray(function (e, results) {
                var x = 0;

                while (results[x]) {
                    if (results[x].name != data.name) {
                    socket.emit('add-user', results[x].name);
                    }
                    x = x + 1;
                }

            });
            client.in(data.room).emit('add-user', data.name);
            //socket.emit('new-user',data.name);
        });

        /*This is the function that actually controls the messages from every user.  In the incoming 'data'
         * is the user name, message, and chat room.  This information is all stored in individual variables.
         * Then, it checks against the whitespace pattern for scripting hacks in the name and message, and it
         * will send back a not allowed message if anything is found. If everything checks out, it will send
         * a message sent status back to the original user and send the user name and message to all users in
         * the specified chat room.
         */
        socket.on('input', function (data) {
            var name = data.name, message = data.message, chatroom = data.chatroom, whitespacePattern = /^\s*$/;
            //console.log(data);
            if (whitespacePattern.test(name) || whitespacePattern.test(message)) {
                //sentStatus('Name and message is required.');
                socket.emit('status',{message: "Not Allowed", clear : true});
            } else {
                //console.log(socket.id);
                socket.emit('status',{
                    message: "Message sent",
                    clear: true
                });
                client.in(chatroom).emit('output', [data]);



            }

        });
    });
});
