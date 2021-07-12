if (process.env.NODE_EV !== 'production') {
    require('dotenv').config();
}

const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

const mongoose = require('mongoose');
const ejsMate = require('ejs-mate');
const session = require('express-session');
const flash = require('connect-flash');
const Joi = require('joi'); // for server side validations
const MongoStore = require('connect-mongo');

const User = require('./models/user');
const Chats = require('./models/Chats');

const catchAsync = require("./utils/CatchAsync");
const ExpressError = require("./utils/ExpressError");
const methodOverride = require('method-override');

const passport = require('passport');
const LocalStrategy = require('passport-local');

const dbUrl =  process.env.DB_URL || 'mongodb://localhost:27017/firstTeamAppD';
// const dbUrl =  'mongodb://localhost:27017/firstTeamAppD';
mongoose.connect(dbUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true
})
.then(() => {
    console.log("MONGO CONNECTION OPEN!!!")
})
.catch(err => {
    console.log("MONGO CONNECTION ERROR!!!!")
    console.log(err)
})

app.engine('ejs', ejsMate)
app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static('public'));

const { v4: uuidv4 } = require('uuid');
const { ExpressPeerServer } = require('peer');
const peerServer = ExpressPeerServer(server, {
    debug: true
});

app.use('/peerjs', peerServer);

const secret = process.env.SECRET || 'secretsecret';
const store = new MongoStore({
    mongoUrl: dbUrl,
    touchAfter: 24 * 60 * 60,
    crypto: {
        secret
    }
});
store.on("error", function(e){
    console.log("SESSION ERROR", e );
})
const sessionOptions = {
    store,
    name: 'session',
    secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 2 * 24 * 60 * 60 * 1000, // 2 Days
        maxAge: 2 * 24 * 60 * 60 * 1000
    }
};
app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//Middleware
app.use(async(req, res, next) => {
    if (req.isAuthenticated()) {
        res.locals.me =  await User.findOne({ _id: req.user._id }).populate('myMeets',[ 'meetId', 'meetName', 'lastMessage','usersAllowed.username']).exec();
    }
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success')
    res.locals.error = req.flash('error')
    next();
})

const isLoggedIn = (req, res, next) => {
    if (req.originalUrl && req.originalUrl !== "/favicon.ico") {
        req.session.returnTo = req.originalUrl;
    }
    if (!req.isAuthenticated()) {
        req.flash('error', 'You must be signed in!!');
        res.redirect('/login');
    } else
        next();
};
const notAuth = (req, res, next) => {
    if (req.isAuthenticated()) {
        req.flash('error', 'You are already signed in!');
        res.redirect('/');
    } else
        next();
};

const validUser = (req, res, next) => {
    const { firstname, secondname, emailid, username, password } = req.body;
    const userSchema = Joi.object({
        firstname: Joi.string().min(3).required(),
        secondname: Joi.string().min(3).required(),
        emailid: Joi.string().email().required(),
        username: Joi.string().min(3).required(),
        password: Joi.string().min(3).required()
    })
    const x = userSchema.validate({ firstname, secondname, emailid, username, password })
    const error = x.error;
    if (error) {
        const msg = error.details[0].message
        throw new ExpressError(msg, 400)
    } else {
        next();
    }
}
// Returns unique values of an array
function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

                                                // ******* Home Page *********
app.get('/',async(req, res) => {
    res.render('./home');
})


                                                // ******* Authentiaction *****
// ***** Log Out ***** 
app.get('/logout', (req, res) => {
    req.logout();
    req.flash('success', "Successfully Logged Out!")
    res.redirect('/');
})
var ROOM_ID;

//***** Register *****
app.get('/register',notAuth, (req, res) => {
    res.render('users/register');
})
app.post('/register', validUser, catchAsync(async (req, res, next) => {
    
    try {
        const { firstname, secondname, emailid, username, password } = req.body;
        const user = new User({firstname, secondname, emailid, username});
        const registeredUser = await User.register(user, password);
        req.login(registeredUser, err => {
            if (err) return next(err);
            uname = req.user.firstname;
            req.flash('success', 'Successfully registered!');
            return res.redirect('/');
        })
    } catch (e) {
        req.flash('error', e.message);
        res.redirect('/register');
    }
}))

// ****** Log In ******
app.get('/login',notAuth, (req, res) => {
        res.render('users/login');
})
app.post('/login', passport.authenticate('local', { failureFlash: true, failureRedirect: '/login' }), catchAsync(async (req, res) => {
    uname = req.user.firstname;
    const redirectUrl = req.session.returnTo || '/';
    req.flash('success', 'Succesfully logged in');
    res.redirect(redirectUrl);
}))

                                                // ********* New Meeting **********
app.get('/new', isLoggedIn, (req, res) => {
    res.render('new');
})
app.post('/new',isLoggedIn, async(req, res) => {
    var { meetId, meetName, allowedUsers } = req.body;
    if (!meetId) {  // if user hasn`t provided the Id
        meetId = uuidv4();
    }
    var allowedU = allowedUsers.split(" ");
    allowedU.push(req.user.emailid); // meeting creater is always allowed in the meeting
    const newMeet = new Chats({meetName, meetId, meetVisibility: false});
    for (const i of allowedU) {
        // push meetings into users` meeting list
        const emailOne = await User.findOneAndUpdate({ "emailid": i }, { $push: { "myMeets": newMeet } });
        
        // push users into meeting`s participant list
        if(emailOne)
            newMeet.usersAllowed.push(emailOne);
    }
    await newMeet.save();
    if (meetId) {
        res.redirect(`${meetId}/chat`);
    }
    else
        res.redirect(`${uuidv4()}/chat`);
})

                                                        // ****** Add Participants ******
app.post('/add', isLoggedIn, async (req, res) => {
    const { meetId, allowedUsers } = req.body;
    var allowedU = allowedUsers.split(" ");
    const thisMeet = await Chats.findOne({ "meetId": meetId });
    for (const i of allowedU) {
        const emailOne = await User.findOneAndUpdate({ "emailid": i }, { $push: { "myMeets": thisMeet } });
        if (emailOne)
            await Chats.findOneAndUpdate({ "meetId": meetId }, { $push: { "usersAllowed": emailOne } });
    }
    res.redirect(`/${meetId}/chat`);
})

                                                        // ****** Join a Meeting *******
app.get('/join',isLoggedIn, (req, res) => {
    res.render('join');
})
app.post('/join',isLoggedIn, async (req, res) => {
    const { meetId } = req.body;
    res.redirect(`/${meetId}/chat`)
    
});

                                                        // ******* Meeting Room *******
app.get('/:room', isLoggedIn, async(req, res) => {
    if(req.params.room!=='favicon.ico')
        ROOM_ID = req.params.room;
    var meetF = await Chats.findOne({ meetId: ROOM_ID }).exec();
    if (meetF) {
        var isAllowedToJoin = false;
        const usersMeets = req.user.myMeets;
        for (let i = 0; i < usersMeets.length; i++){
            // check if meeting is in user's meeting list
            if (usersMeets[i] + ' ' == meetF._id + ' '){
                isAllowedToJoin = true;
                break;
            }
        }
        if (isAllowedToJoin) {
            var msgHistory = await Chats.findOne({ meetId: ROOM_ID }).populate('usersAllowed').exec();
            msgHistory.usersAllowed = msgHistory.usersAllowed.filter(onlyUnique);
            res.render('room', { roomId: req.params.room, uname: req.user.firstname, msgHistory: msgHistory });
        }
        else {
            req.flash('error', "You are not allowed to join this Meeting")
            res.redirect('/join');
        }
    } else {
        req.flash('error', 'Not Found. Please check the code!!');
        res.redirect('/join');
    }
})
                                                        // ****** Chat Room ******
app.get('/:room/chat',isLoggedIn, async(req, res) => {
    if(req.params.room!=='favicon.ico')
        ROOM_ID = req.params.room;
    var meetF = await Chats.findOne({ meetId: ROOM_ID }).exec();
    if (meetF) {
        var isAllowedToJoin = false;
        const usersMeets = req.user.myMeets;
        for (let i = 0; i < usersMeets.length; i++){
            if (usersMeets[i] + ' ' == meetF._id + ' '){
                isAllowedToJoin = true;
                break;
            }     
        }
        for (let i = 0; i < usersMeets.length; i++){
            if (usersMeets[i] + ' ' == meetF._id + ' '){
                isAllowedToJoin = true;
                break;
            }
        }
        if (isAllowedToJoin) {
            var msgHistory = await Chats.findOne({ meetId: ROOM_ID }).populate('usersAllowed').exec();
            msgHistory.usersAllowed = msgHistory.usersAllowed.filter(onlyUnique);
            res.render('chat', { roomId: req.params.room, uname: req.user.firstname, msgHistory: msgHistory });
        }
        else {
            req.flash('error', "You are not allowed to join this Meeting")
            res.redirect('/join');
        }
    } else {
        req.flash('error', 'Not Found. Please check the code!!');
        res.redirect('/join');
    }
})

// Error Handling
app.all('*', (req, res, next) => {
    next(new ExpressError("Page Not Found", 404))
} )

app.use((err, req, res, next) => {
    const { statusCode = 500, message = "Something went wrong"} = err;
    res.status(statusCode).render('errors', { statusCode, message, stack: err.stack});
})

// Connections
io.on('connection', socket => {
    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', userId);
        socket.on('message', async(message) => {
            var newMsg = message
            newMsg.sentAt = Date.now();
            var x = newMsg.sentAt + ' ';
            await Chats.findOneAndUpdate({ "meetId": roomId }, { $push: { "messages": newMsg } });
            await Chats.findOneAndUpdate({ "meetId": roomId }, { "lastMessage": newMsg } );
            io.to(roomId).emit('createMessage', message)
        });
        socket.on('disconnect', () => {
            socket.to(roomId).emit('user-disconnected', userId)
        });
    })
})
const port1 = process.env.PORT || 3030;
server.listen(port1);