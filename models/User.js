let mongoose = require('mongoose');
let Schema = mongoose.Schema;

let model = new Schema({
    name: String,
    email: String,
    password: String,
    code: String,
    strength: Number,
    balance: Number,
    ranking: Number,
    forgotCode: String,
    locale: String,
    picture: String,
    userid: String,
    birthday: String,
    gender: String,
    bot: Number,
    hacked: Number,
    adDisabled: Number,
    status: Number,
    lastBonus: {
        type: Date,
        default: Date.now
    }
}, {timestamps: true});

module.exports = mongoose.model('User', model, 'users');