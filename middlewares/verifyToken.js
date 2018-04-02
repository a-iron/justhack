let AccessToken = require('../models/AccessToken');
let config = require('../config/config');
let validator = require('validator');

module.exports = function (req, res, next) {
    let tokenValue = req.body.token || false;// || req.query.token || req.headers['x-access-token'];

    if (!tokenValue) {
        console.log("Empty token");

        // forbidden without token
        return res.json({
            status: 0,
            error: {
                code: config.codes.error.invalidToken,
                message: 'Invalid token'
            }
        });
    }

    try {
        tokenValue = validator.escape(tokenValue);
    } catch (e) {
        console.log("exception");
        console.log(e);

        return res.json({
            status: 0,
            error: {
                code: config.codes.error.invalidParams,
                message: 'Invalid params'
            }
        });
    }

    // verifies secret and checks exp
    AccessToken.findOne({token: tokenValue}).exec(function (err, token) {
        if (err) {
            console.log(err);

            return res.json({
                status: 0,
                error: {
                    code: config.codes.error.errorDB,
                    message: 'DB'
                }
            });
        }

        if (!token) {
            console.log("Invalid token1");

            return res.json({
                status: 0,
                error: {
                    code: config.codes.error.invalidToken,
                    message: 'Invalid token'
                }
            });
        }

        if (Math.round((Date.now() - token.expires) / 1000) > config.tokenExpireTime) {
            console.log("Token expired2");

            return res.json({
                status: 0,
                error: {
                    code: config.codes.error.tokenExpired,
                    message: 'Token expired'
                }
            });
        }

        req.userId = token.userId;
        req.accessToken = token.token;

        next(); //no error, proceed
    });
};