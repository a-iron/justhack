let express = require('express');
let router = express.Router();
let User = require('../models/User');
let History = require('../models/History');
let Friend = require('../models/Friend');
let config = require('../config/config');
let validator = require('validator');
let md5 = require('md5');
let cryptLib = require('../utils/cryptlib');

/**
 * Возвращает информацию о пользователе которого хотят взломать
 */
router.post('/', function (req, res) {
    console.log("User");

    let ownUserId = req.userId || false;//from middleware
    let accessToken = req.accessToken || false;//from middleware
    let userId = req.body.user_id || false;

    if (!userId) {
        console.log("Empty userId");

        return res.json({
            status: 0,
            error: {
                code: config.codes.error.emptyFields,
                message: 'Empty userId'
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

    if (ownUserId == userId) {
        return res.json({
            status: 0,
            error: {
                code: config.codes.error.userId,
                message: 'Error userId'
            }
        });
    }

    let data = {
        _id: userId,
        status: config.codes.user.active,
    };

    User.findOne(data).lean().exec(function (err, userModel) {
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

        if (!userModel) {
            console.log("User not found");

            return res.json({
                status: 0,
                error: {
                    code: config.codes.error.userNotFound,
                    message: 'User not found!'
                }
            });
        }

        let ownData = {
            _id: ownUserId
        };

        let commission = 100;

        if (userModel.balance && userModel.balance > 0) {
            if (userModel.balance < 1000) {
                commission = 100;
            } else if (userModel.balance >= 1000 && userModel.balance < 5000) {
                commission = 100;
            } else if (userModel.balance >= 5000 && userModel.balance < 10000) {
                commission = 500;
            } else if (userModel.balance >= 10000 && userModel.balance < 50000) {
                commission = 1000;
            } else if (userModel.balance >= 50000 && userModel.balance < 100000) {
                commission = 5000;
            } else if (userModel.balance >= 100000 && userModel.balance < 500000) {
                commission = 10000;
            } else if (userModel.balance >= 500000 && userModel.balance < 1000000) {
                commission = 50000;
            } else if (userModel.balance >= 1000000 && userModel.balance < 5000000) {
                commission = 100000;
            } else if (userModel.balance >= 5000000 && userModel.balance < 10000000) {
                commission = 500000;
            } else if (userModel.balance >= 10000000 && userModel.balance < 50000000) {
                commission = 1000000;
            } else if (userModel.balance >= 50000000 && userModel.balance < 100000000) {
                commission = 5000000;
            } else if (userModel.balance >= 100000000 && userModel.balance < 500000000) {
                commission = 10000000;
            } else if (userModel.balance >= 500000000 && userModel.balance < 1000000000) {
                commission = 50000000;
            } else if (userModel.balance >= 1000000000) {
                commission = 100000000;
            }
        } else {
            commission = 100;
        }

        //списываем деньги со счета хакера, за попытку взломать другого пользователя
        User.findOne(ownData).exec(function (err, currentUser) {
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

            if (!currentUser) {
                return res.json({
                    status: 0,
                    error: {
                        code: config.codes.error.userNotFound,
                        message: 'User not found!'
                    }
                });
            }

            if (currentUser.balance >= commission) {
                let currentUserBalance = currentUser.balance - commission;

                currentUser.balance = currentUserBalance;

                let promise = currentUser.save();

                promise
                    .then(function () {
                        let historyModel = new History({
                            fromUserId: currentUser._id,
                            toUserId: "System",
                            amount: commission,
                            hackedUserId: userModel._id,
                            status: 1
                        });

                        return historyModel.save();
                    })
                    .then(function () {

                        let userCode = userModel.code || "";
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

                        return res.json({
                            status: 1,
                            data: {
                                user: {
                                    userId: userModel._id,
                                    name: userModel.name,
                                    //email: userModel.email,
                                    email: null,
                                    balance: userModel.balance || 0,
                                    code: finalCode,
                                    strength: userModel.strength || 0,
                                    status: userModel.status || 0,
                                }
                            }
                        });
                    })
                    .catch(function (err) {
                        // just need one of these
                        console.log('error:', err);

                        return res.json({
                            status: 0,
                            error: {
                                code: config.codes.error.exception,
                                message: 'Exception'
                            }
                        });
                    });

            } else {
                return res.json({
                    status: 0,
                    error: {
                        code: config.codes.error.personalBalanceSmall,
                        message: 'Your balance is small'
                    }
                });
            }
        });
    });
});

module.exports = router;
