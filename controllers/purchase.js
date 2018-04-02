let express = require('express');
let router = express.Router();
let User = require('../models/User');
let History = require('../models/History');
let Purchase = require('../models/Purchase');
let accounting = require('accounting');
let config = require('../config/config');
let dateFormat = require('dateformat');
let validator = require('validator');
let request = require('request');

let google = require('googleapis');
let key = require('../config/GooglePlay.json');

/**
 * Покупки пользователя
 */
router.post('/', function (req, res) {

    let ownUserId = req.userId || false;//from middleware
    let productId = req.body.productId || false;
    let purchaseToken = req.body.purchaseToken || false;

    if (!ownUserId || !productId || !purchaseToken) {
        return res.json({
            status: 0,
            error: {
                code: config.codes.error.emptyFields,
                message: 'Empty userId'
            }
        });
    }

    if (productId != config.purchase.SKU_HALF_MLN &&
        productId != config.purchase.SKU_THREE_MLN &&
        productId != config.purchase.SKU_TEN_MLN &&
        productId != config.purchase.SKU_FIFTY_MLN &&
        productId != config.purchase.SKU_HUNDRED_FIFTY_MLN &&
        productId != config.purchase.SKU_THREE_HUNDRED_FIFTY_MLN &&
        productId != config.purchase.SKU_BILLION) {
        return res.json({
            status: 0,
            error: {
                code: config.codes.error.purchaseNotValidFields,
                message: 'Error productId'
            }
        });
    }

    try {
        ownUserId = validator.escape(ownUserId);
        productId = validator.escape(productId);
        purchaseToken = validator.escape(purchaseToken);
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

    let authClient = new google.auth.JWT(
        key.client_email,
        null,
        key.private_key,
        // Scopes can be specified either as an array or as a single, space-delimited string
        ['https://www.googleapis.com/auth/androidpublisher'],
        // User to impersonate (leave empty if no impersonation needed)
        null
    );

    authClient.authorize(function (err, token) {
        if (err) {
            console.log(err);
            return res.json({
                status: 0,
                error: {
                    code: config.codes.error.purchaseAccessCode,
                    message: 'Purchase error'
                }
            });
        }

        if (token.access_token == null) {
            return res.json({
                status: 0,
                error: {
                    code: config.codes.error.purchaseAccessCode,
                    message: 'Purchase error'
                }
            });
        }

        //console.log("token");
        //console.log(token);
        //console.log(token.access_token);

        let url = 'https://www.googleapis.com/androidpublisher/v1.1/applications/' + config.packageName + '/inapp/' + productId + '/purchases/' + purchaseToken + '?access_token=' + token.access_token;

        let options = {
            url: url,
            method: 'GET',
            headers: {
                //Authorization: 'Bearer ' + token.access_token
            }
        };

        request(options, function (error, response, body) {
            if (error) {
                console.log(error);

                return res.json({
                    status: 0,
                    error: {
                        code: config.codes.error.purchaseNotFound,
                        message: 'Purchase not found'
                    }
                });
            } else {
                let jsonObject = JSON.parse(body);
                console.log(jsonObject);

                if (!jsonObject.error && response.statusCode == 200) {

                    //0 Purchased, 1 - Cancelled
                    if (jsonObject.purchaseState == 0) {
                        //check if user already funds balance
                        let data = {
                            userId: ownUserId,
                            token: purchaseToken,
                            productId: productId,
                            status: 1,
                        };

                        Purchase.findOne(data).exec(function (err, model) {
                            if (err) {
                                return res.json({
                                    status: 0,
                                    error: {
                                        code: config.codes.error.errorDB,
                                        message: 'DB'
                                    }
                                });
                            }

                            if (model) {
                                return res.json({
                                    status: 0,
                                    error: {
                                        code: config.codes.error.purchaseAlreadyUsed,
                                        message: 'The purchase has already been made previously'
                                    }
                                });
                            }

                            let ownData = {
                                _id: ownUserId
                            };

                            User.findOne(ownData).exec(function (err, user) {
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

                                let amount = 0;

                                if (productId == config.purchase.SKU_HALF_MLN) {
                                    amount = config.purchase.SKU_HALF_MLN_VALUE;

                                } else if (productId == config.purchase.SKU_THREE_MLN) {
                                    amount = config.purchase.SKU_THREE_MLN_VALUE;

                                } else if (productId == config.purchase.SKU_TEN_MLN) {
                                    amount = config.purchase.SKU_TEN_MLN_VALUE;

                                } else if (productId == config.purchase.SKU_FIFTY_MLN) {
                                    amount = config.purchase.SKU_FIFTY_MLN_VALUE;

                                } else if (productId == config.purchase.SKU_HUNDRED_FIFTY_MLN) {
                                    amount = config.purchase.SKU_HUNDRED_FIFTY_MLN_VALUE;

                                } else if (productId == config.purchase.SKU_THREE_HUNDRED_FIFTY_MLN) {
                                    amount = config.purchase.SKU_THREE_HUNDRED_FIFTY_MLN_VALUE;

                                } else if (productId == config.purchase.SKU_BILLION) {
                                    amount = config.purchase.SKU_BILLION_VALUE;

                                }

                                let oldBalance = user.balance;
                                let newBalance = user.balance + amount;

                                user.balance = newBalance;
                                user.adDisabled = 1;

                                user.save(function (err, userModel) {
                                    if (err) {
                                        return res.json({
                                            status: 0,
                                            error: {
                                                code: config.codes.error.errorDB,
                                                message: 'DB'
                                            }
                                        });
                                    }

                                    //add in Purchase history
                                    let purchaseModel = new Purchase({
                                        userId: ownUserId,
                                        token: purchaseToken,
                                        productId: productId,
                                        oldBalance: oldBalance,
                                        newBalance: newBalance,
                                        status: 1,
                                    });

                                    let promise = purchaseModel.save();

                                    promise
                                        .then(function () {
                                            let historyModel = new History({
                                                fromUserId: "System",
                                                toUserId: userModel._id,
                                                amount: amount,
                                                hackedUserId: "",
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

                                            let adValue = userModel.adDisabled || 0;
                                            let plainAd = md5(config.secretCodePre + accessToken + md5(adValue.toString()));
                                            let encryptAd = cryptLib.encrypt(plainAd);

                                            return res.json({
                                                status: 1,
                                                data: {
                                                    user: {
                                                        userId: userModel._id,
                                                        name: userModel.name,
                                                        email: userModel.email,
                                                        balance: userModel.balance || 0,
                                                        code: finalCode,
                                                        strength: userModel.strength || 0,
                                                        hacked: userModel.hacked || 0,
                                                        adDisabled: encryptAd,
                                                        status: userModel.status || 0,
                                                        lastBonus: dateFormat(userModel.lastBonus || "", "yyyy-m-d H:MM:ss"),
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
                                });
                            });
                        });
                    } else {//Cancelled
                        console.log("purchase cancelled");

                        return res.json({
                            status: 0,
                            error: {
                                code: config.codes.error.purchaseCancelled,
                                message: 'Purchase cancelled'
                            }
                        });
                    }

                } else {
                    console.log("purchase error");

                    return res.json({
                        status: 0,
                        error: {
                            code: config.codes.error.purchaseNotFound,
                            message: 'Purchase not found'
                        }
                    });
                }
            }
        });
    });
});

module.exports = router;
