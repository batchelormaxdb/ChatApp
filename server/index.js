import express from 'express'
import { Server } from "socket.io"
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)

const __dirname = path.dirname(__filename)


const PORT = process.env.PORT || 3500

const ADMIN = "Admin"

const app = express()

app.use(express.static(path.join(__dirname, 'public')))

const expressServer = app.listen(PORT, () => {
    console.log(`Listening on port: ${PORT}`)
})

const userState = {
    users: [],
    setUsers: function (newUsersArray) {
        this.users = newUsersArray
    }
}
const io = new Server(expressServer, {
    cors: {
        origin: process.env.NODE_ENV === "production" ?  false : ["http://localhost:5500", "http://127.0.0.1:5500",],
        methods: ["GET", "POST"],
        credentials: true
    }
})

io.on('connection', socket => {
    console.log(`User ${socket.id} connected.`)

    //Upon connection send message to only user
    socket.emit('message', buildMsg(ADMIN, "Welcome to the Chat!"));

    socket.on('enterRoom', ({name, room}) =>{
        //leave previous room
        const prevRoom = getUser(socket.id)?.room

        if(prevRoom)
        {
            socket.leave(prevRoom)
            io.to(prevRoom).emit('message', buildMsg(ADMIN, ` ${name} has left.`))
        }

        const user = activateUser(socket.id, name, room)

        if(prevRoom) {
            io.to(prevRoom).emit('userList', {
                users: getUsersInRoom(prevRoom)
            })
        }
        socket.join(user.room)

        socket.emit('message', buildMsg(ADMIN, `You have joined the ${user.room} room.`))

        socket.broadcast.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} has joined.`))

        //Update the user list
        io.to(user.room).emit('userList', {
            users: getUsersInRoom(user.room)
        })
        io.emit('roomList', {
            rooms: getAllActiveRooms()
        })
    })
    
    //Upon disconnection
    socket.on('disconnect', () => {
        const user = getUser(socket.id)
        userLeave(socket.id)
        
        if(user) {
            io.to(user.to).emit('message', buildMsg(ADMIN, `${user.name} has left.`))
            
            io.to(user.room).emit('userList', {
                users: getUsersInRoom(user.room)
            })
            
            io.emit('roomList', {
                rooms: getAllActiveRooms()
            })
        }
    })

    //Listening for a message event
    socket.on('message', ({ name, text }) => {
        const room = getUser(socket.id)?.room
        if(room) {
            io.to(room).emit('message', buildMsg(name, text))
        }
    })



    //Listening for activity
    socket.on('activity', (name) => {
        const room = getUser(socket.id)?.room
        if(room){
            socket.broadcast.to(room).emit('activity', name)
        }
    })

})

function buildMsg(name, text) {
    return {
        name,
        text,
        time: new Intl.DateTimeFormat('default', {
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric'
        }).format(new Date())
    }
}

//User Functions

function activateUser(id, name, room) {
    const user = { id, name, room }
    userState.setUsers([
        ...userState.users.filter(user => user.id !== id),
        user
    ])
    return user;
}

function userLeave(id) {
    userState.setUsers(
        userState.users.filter(user => user.id !== id)
    )
}

function getUser(id) {
    return userState.users.find(user => user.id === id)
}

function getUsersInRoom(room) {
    return userState.users.filter(user => user.room === room)
}

function getAllActiveRooms() {
    return Array.from(new Set(userState.users.map(user => user.room)))
}
