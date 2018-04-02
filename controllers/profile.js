let express = require('express');
let router = express.Router();
let User = require('../models/User');
let accounting = require('accounting');
let config = require('../config/config');
let dateFormat = require('dateformat');
let validator = require('validator');
let md5 = require('md5');
let cryptLib = require('../utils/cryptlib');

/**
 * Возвращает информацию о текущем пользователе (баланс, код блокировки)
 */
router.post('/', function (req, res) {

    let ownUserId = req.userId || false;//from middleware
    let accessToken = req.accessToken || false;//from middleware

    if (!ownUserId) {
        return res.json({
            status: 0,
            error: {
                code: config.codes.error.emptyFields,
                message: 'Empty userId'
            }
        });
    }

    try {
        ownUserId = validator.escape(ownUserId);
        accessToken = validator.escape(accessToken);
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

    let data = {
        _id: ownUserId
    };

    User.findOne(data).lean().exec(function (err, user) {
        if (err) {
            return res.json({
                status: 0,
                error: {
                    code: config.codes.error.errorDB,
                    message: 'DB'
                }
            });
        }

        if (!user) {
            return res.json({
                status: 0,
                error: {
                    code: config.codes.error.userNotFound,
                    message: 'User not found!'
                }
            });
        }

        let timeInMs = Date.now();

        let userCode = user.code || "";
        let finalCode = null;

        if (userCode.length >= 3) {
            //encrypt user code - for protection
            let cryptCodePost = md5(config.secretCodePre + accessToken + accessToken + config.secretCodePost);

            let cryptCode = md5(config.secretCodePre + userCode + config.secretCodePost + accessToken);

            let plainText = cryptCode + cryptCodePost;

            let cypherText = cryptLib.encrypt(plainText);
            //let originalText = cryptLib.decrypt(cypherText);

            finalCode = cypherText;
        }

        let adValue = user.adDisabled || 0;
        let plainAd = md5(config.secretCodePre + accessToken + md5(adValue.toString()));
        let encryptAd = cryptLib.encrypt(plainAd);

        res.json({
            status: 1,
            data: {
                user: {
                    userId: user._id,
                    name: user.name,
                    email: user.email,
                    //balance: accounting.formatNumber(user.balance || 0, 2, ","),
                    balance: user.balance || 0,
                    code: finalCode,
                    strength: user.strength || 0,
                    hacked: user.hacked || 0,
                    adDisabled: encryptAd,
                    status: user.status || 0,
                    lastBonus: dateFormat(user.lastBonus || "", "yyyy-m-d H:MM:ss"),
                }
            }
        });
    });
});

/**
 * Обновляет профиль пользователя
 * Возвращает информацию о текущем пользователе (баланс, код блокировки)
 */
router.post('/set', function (req, res) {

    let ownUserId = req.userId || false;//from middleware
    let accessToken = req.accessToken || false;//from middleware
    let userId = req.body.user_id || false;
    let name = req.body.user_name || false;
    let code = req.body.user_code || false;

    if (!userId || !code || !name) {
        return res.json({
            status: 0,
            error: {
                code: config.codes.error.emptyFields,
                message: 'Empty userId or code or name'
            }
        });
    }

    if (!ownUserId) {
        return res.json({
            status: 0,
            error: {
                code: config.codes.error.emptyFields,
                message: 'Empty userId'
            }
        });
    }

    try {
        ownUserId = validator.escape(ownUserId);
        accessToken = validator.escape(accessToken);
        userId = validator.escape(userId);
        name = validator.escape(name);
        name = validator.trim(name);
        code = validator.escape(code);
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
    
    if (name.length < 2) {
        return res.json({
            status: 0,
            error: {
                code: config.codes.error.nameTooShort,
                message: 'Name too short'
            }
        });
    }

    let data = {
        _id: ownUserId
    };

    User.findOne(data).exec(function (err, user) {
        if (err) {
            return res.json({
                status: 0,
                error: {
                    code: config.codes.error.errorDB,
                    message: 'DB'
                }
            });
        }

        if (!user) {
            return res.json({
                status: 0,
                error: {
                    code: config.codes.error.userNotFound,
                    message: 'User not found!'
                }
            });
        }

        //check length code
        let length = 3;

        if (user.balance && user.balance > 0) {
            let balance = user.balance;

            if (balance < 1000) {
                length = 3;
            } else if (balance >= 1000 && balance < 5000) {
                length = 3;
            } else if (balance >= 5000 && balance < 10000) {
                length = 4;
            } else if (balance >= 10000 && balance < 50000) {
                length = 5;
            } else if (balance >= 50000 && balance < 100000) {
                length = 6;
            } else if (balance >= 100000 && balance < 500000) {
                length = 7;
            } else if (balance >= 500000 && balance < 1000000) {
                length = 8;
            } else if (balance >= 1000000 && balance < 5000000) {
                length = 9;
            } else if (balance >= 5000000 && balance < 10000000) {
                length = 9;
            } else if (balance >= 10000000 && balance < 50000000) {
                length = 9;
            } else if (balance >= 50000000 && balance < 100000000) {
                length = 9;
            } else if (balance >= 100000000 && balance < 500000000) {
                length = 9;
            } else if (balance >= 500000000 && balance < 1000000000) {
                length = 9;
            } else if (balance >= 1000000000) {
                length = 9;
            }
        }

        //error length code
        if (code.length < 3 && code.length > length) {
            return res.json({
                status: 0,
                error: {
                    code: config.codes.error.errorLengthCode,
                    message: 'Error length code!'
                }
            });
        }

        user.name = name;
        user.code = code;
        user.strength = code.length * 10;
        user.hacked = 0;
        user.status = config.codes.user.active;

        user.save(function (err, user) {
            if (err) {
                return res.json({
                    status: 0,
                    error: {
                        code: config.codes.error.errorDB,
                        message: 'DB'
                    }
                });
            }

            let userCode = user.code || "";
            let finalCode = null;

            if (userCode.length >= 3) {
                //encrypt user code - for protection
                let cryptCodePost = md5(config.secretCodePre + accessToken + accessToken + config.secretCodePost);

                let cryptCode = md5(config.secretCodePre + userCode + config.secretCodePost + accessToken);//для запутывания взлома

                let plainText = cryptCode + cryptCodePost;

                let cypherText = cryptLib.encrypt(plainText);
                //let originalText = cryptLib.decrypt(cypherText);

                finalCode = cypherText;
            }

            let adValue = user.adDisabled || 0;
            let plainAd = md5(config.secretCodePre + accessToken + md5(adValue.toString()));
            let encryptAd = cryptLib.encrypt(plainAd);

            res.json({
                status: 1,
                data: {
                    user: {
                        userId: user._id,
                        name: user.name,
                        email: user.email,
                        balance: user.balance || 0,
                        code: finalCode,
                        strength: user.strength || 0,
                        hacked: user.hacked || 0,
                        adDisabled: encryptAd,
                        status: user.status || 0,
                        lastBonus: dateFormat(user.lastBonus || "", "yyyy-m-d H:MM:ss"),
                    }
                }
            });
        });
    });
});

module.exports = router;
