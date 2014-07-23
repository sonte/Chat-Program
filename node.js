var mongo = require('mongodb').MongoClient, client = require('socket.io').listen(8080).sockets;

mongo.connect('mongodb://127.0.0.1/chat', function (err, db) {
    if (err)
        throw err;
    var collection = db.collection('userlist');
    collection.remove(function (err, result) {
    });

    client.on('connection', function (socket) {
        //console.log(socket.id);
        var ip = socket.handshake.address.address;
        var id = socket.id;
        var collection = db.collection('userlist');
        collection.count({ip: ip}, function (e, count) {
            if (count > 5) {
                //console.log('more than 5');
            } else {
                //console.log('less than 5');
            }
            var insertion = {ip: ip, socket: id};
            collection.insert(insertion, {w: 0});
        });
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
        socket.on('room', function (data) {
            var collection = db.collection('userlist');
            var socketid = {socket: socket.id};
            var info = {name: data.name, room: data.room};
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
                        socket.emit('new-user', results[x].name);
                    }
                    x = x + 1;
                }

            });
            client.in(data.room).emit('add-user', data.name);
            //socket.emit('new-user',data.name);
        });
        sentStatus = function (s) {
            socket.emit('status', s);
        };

        /*col.find().limit(100).sort({_id: 1}).toArray(function(err,res){
         if(err) throw err;
         socket.emit('output', res);
         });*/

        socket.on('input', function (data) {
            var name = data.name, message = data.message, chatroom = data.chatroom, whitespacePattern = /^\s*$/;
            console.log(data);
            if (whitespacePattern.test(name) || whitespacePattern.test(message)) {
                sentStatus('Name and message is required.');
            } else {
                //console.log(chatroom);

                client.in(chatroom).emit('output', [data]);

                sentStatus({
                    message: "Message sent",
                    clear: true
                });

            }

        });
    });
});
