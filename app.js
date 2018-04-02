let express = require('express');
let path = require('path');
let favicon = require('serve-favicon');
let logger = require('morgan');
let cookieParser = require('cookie-parser');
let bodyParser = require('body-parser');

let config = require('./config/config');
let mongoose = require('mongoose');
let winston = require('winston');
let cors = require('cors');

let ExpressBrute = require('express-brute');
let MemcachedStore = require('express-brute-memcached');
let RedisStore = require('express-brute-redis');
let moment = require('moment');

let failCallback = function (req, res, next, nextValidRequestDate) {
    return res.json({
        status: 0,
        error: {
            code: config.codes.error.tooManyRequests,
            message: "You've made too many failed attempts in a short period of time, please try again " + moment(nextValidRequestDate).fromNow()
        }
    });
};
let handleStoreError = function (error) {
    log.error(error); // log this error so we can figure out what went wrong
    // cause node to exit, hopefully restarting the process fixes the problem
    throw {
        message: error.message,
        parent: error.parent
    };
};

let store = new ExpressBrute.MemoryStore(); // stores state locally, don't use this in production
/* let store = new MemcachedStore(['127.0.0.1:11211'], {
 prefix: 'NoConflicts'
 }); */
/* let store = new RedisStore({
 host: '127.0.0.1',
 port: 6379
 }); */
let bruteforce = new ExpressBrute(store, {
    freeRetries: 1000,
    attachResetToRequest: false,
    refreshTimeoutOnRequest: false,
    minWait: 60 * 1000, // 1 min (should never reach this wait time)
    maxWait: 15 * 60 * 1000, // 15 min (should never reach this wait time)
    lifetime: 2 * 60, // 2 min (seconds not milliseconds)
    failCallback: failCallback,
    handleStoreError: handleStoreError
});

let app = express();

app.use(cors());
app.use(bruteforce.prevent);

let log = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)()
    ]
});

mongoose.Promise = require('bluebird');
mongoose.set('debug', true);
mongoose.connect(config.database, config.databaseOptions);
mongoose.set('debug', function (coll, method, query, doc) {
    console.log("-------sql-------");
    console.log(method);
    console.log(coll);
    console.log(query);
    console.log(doc);
    console.log("--------------");
});
let db = mongoose.connection;

db.on('error', function (err) {
    log.error('connection error:', err.message);
});
db.once('open', function callback() {
    log.info("Connected to DB!");
});

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
//app.use(express.static(path.join(__dirname, 'public')));

let helmet = require('helmet');
app.use(helmet());

let verifyToken = require('./middlewares/verifyToken');
let index = require('./controllers/index');
let google = require('./controllers/google');

let profile = require('./controllers/profile');//информация о пользователе
let friends = require('./controllers/friends');//друзья пользователя - их можно взламывать

let users = require('./controllers/users');//список случайных пользователей - их можно взламывать
let user = require('./controllers/user');//список случайных пользователей - их можно взламывать
let rating = require('./controllers/rating');//список пользователей с высоким рейтингом - их нельзя взламывать
let history = require('./controllers/history');//история действий пользователя - отражает действия которые произошли с аккаунтом пользователя
let access = require('./controllers/access');
let tip = require('./controllers/tip');
let bonus = require('./controllers/bonus');
let purchase = require('./controllers/purchase');

app.use('/', index);
app.use('/api/google', google);

app.use('/api/profile', verifyToken, profile);
app.use('/api/friends', verifyToken, friends);

app.use('/api/users', verifyToken, users);
app.use('/api/user', verifyToken, user);
app.use('/api/rating', verifyToken, rating);
app.use('/api/history', verifyToken, history);
app.use('/api/access', verifyToken, access);
app.use('/api/tip', verifyToken, tip);
app.use('/api/bonus', verifyToken, bonus);
app.use('/api/purchase', verifyToken, purchase);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    let err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    let status = err.status || 500;

    // render the error page
    res.status(status);
    res.send({'error': "Error=" + status});
});

module.exports = app;
