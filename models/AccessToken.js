let mongoose = require('mongoose');
let Schema = mongoose.Schema;

let model = new Schema({
    userId: {
        type: String,
        required: true
    },
    token: {
        type: String,
        unique: true,
        required: true
    },
    expires: {
        type: Date,
        default: Date.now
    }
}, {timestamps: true});

module.exports = mongoose.model('AccessToken', model, 'accesstokens');