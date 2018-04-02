let config = require('../config/config');
let User = require('../models/User');
let mongoose = require('mongoose');
let CronJob = require('cron').CronJob;

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
    console.log('connection error:', err.message);
});
db.on('connected', function callback () {
    console.log("Connected to DB!");
    
    job.start();
});
db.on('disconnected', function callback () {
    console.log("disconnected to DB!");
});

let job = new CronJob({
    cronTime: '1 * * * * *',
    onTick: function() {
    
        console.log("onTick");
        
        start();
    },
    start: false,
    timeZone: 'America/Los_Angeles'
});

function start() {
    
    if (db == null) {
        console.log("Error. Db null");
        return;
    }
    
    let userRank = 1;
    
    User.find().lean().sort({"balance": -1}).exec(function (err, users) {
        
        users.forEach(function (item) {
            console.log("userRank = " + userRank);
            
            item.ranking = userRank;
            
            db.collection('users').update({_id:item._id}, {$set: { ranking: userRank }});
            
            userRank++;
        });
    }); 
}