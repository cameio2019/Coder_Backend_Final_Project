import express from 'express'
import passport from 'passport'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import initializePassport from './config/passport-config.js'
import upload from './services/upload.js'
import __dirname from './utils.js'
import sessionRouter from './routes/session.routes.js'
import productsRouter from './routes/products.routes.js'
import userRouter from './routes/users.routes.js'
import cartRouter from './routes/carts.routes.js'
import { Server } from 'socket.io'
import { messageService } from './services/services.js'
import { createLogger } from './logger.js'

const app = express()
const PORT = process.env.PORT||8080
const server = app.listen(PORT,()=>console.log(`Listening on ${PORT}`))

const logger = createLogger()

const io = new Server(server,{
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
})

app.use(cors({credentials: true, origin:"http://localhost:3000"}))
app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(cookieParser())
initializePassport()
app.use(passport.initialize())

app.use('/images', express.static(__dirname+'/public'))
app.use('/avatars', express.static(__dirname + '/public'))
app.use(express.static(__dirname+'/public'))

app.use('/api/session',sessionRouter)
app.use('/api/products',productsRouter)
app.use('/api/users',userRouter)
app.use('/api/cart',cartRouter)

app.use(upload.single('image'))


//-------------------- socket ----------------//
let connectedSockets = {};
io.on('connection', async socket=>{
    console.log("client connected");
    if(socket.handshake.query.name){

        if(Object.values(connectedSockets).some(user=>user.id===socket.handshake.query.id)){

            Object.keys(connectedSockets).forEach(idSocket =>{
                if(connectedSockets[idSocket].id===socket.handshake.query.id){
                    delete connectedSockets[idSocket];
                    connectedSockets[socket.id]={
                        name:socket.handshake.query.name,
                        id:socket.handshake.query.id,
                        thumbnail:socket.handshake.query.thumbnail
                    };
                }
            })
        }else{
            connectedSockets[socket.id]={
                name:socket.handshake.query.name,
                id:socket.handshake.query.id,
                thumbnail:socket.handshake.query.thumbnail
            };
        }
    }
    io.emit('users',connectedSockets)
    let logs = await messageService.getAllAndPopulate();
    io.emit('logs',logs);

    socket.on('disconnect',reason=>{
        delete connectedSockets[socket.id]
    })
    socket.on('message',async data=>{
        if(Object.keys(connectedSockets).includes(socket.id)){
            await messageService.save({
                author:connectedSockets[socket.id].id,
                content: data
            })
            let logs = await messageService.getAllAndPopulate();
            io.emit('logs',logs);
        }
    });
})
//------------------ End socket ----------------//

app.use('/*', (req,res)=> res.send({
    error:-2,
    description: `Path ${req.originalUrl} and method ${req.method} aren't implemented.`
}))
