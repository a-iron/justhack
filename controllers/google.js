let express = require('express');
let router = express.Router();
let User = require('../models/User');
let Friend = require('../models/Friend');
let UserInfo = require('../models/UserInfo');
let dateFormat = require('dateformat');
let config = require('../config/config');
let Promise = require('bluebird');
let validator = require('validator');
let GoogleAuth = require('google-auth-library');
let key = require('../config/GooglePlay.json');
let request = require('request');
let AccessToken = require('../models/AccessToken');
let crypto = require('crypto');
let md5 = require('md5');
let cryptLib = require('../utils/cryptlib');
let xssFilters = require('xss-filters');
let filterXSS = require('xss');

/**
 * Возвращает список пользователей в порядке убывания по балансу
 */
router.post('/signin', function (req, res) {
    let email = req.body.user_email || 0;
    let name = req.body.user_name || 0;
    let token = req.body.user_token || 0;
    let userInfo = req.body.user_info || 0;

    if (!email || !name || !token) {
        return res.json({
            status: 0,
            error: {
                code: config.codes.error.emptyFields,
                message: 'Empty values'
            }
        });
    }

    try {
        if (!validator.isEmail(email)) {
            return res.json({
                status: 0,
                error: {
                    code: config.codes.error.invalidEmail,
                    message: 'Error email'
                }
            });
        }

        email = validator.escape(email);
        name = validator.escape(name);
        userInfo = filterXSS(userInfo);
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

    let url = "https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=" + token;

    let options = {
        url: url,
        method: 'GET',
        headers: {}
    };

    request(options, function (error, response, body) {
        if (error) {
            console.log(error);

            return res.json({
                status: 0,
                error: {
                    code: config.codes.error.loginFailed,
                    message: 'Login Failed. Try Again'
                }
            });
        } else {
            let jsonObject = JSON.parse(body);
            console.log(jsonObject);

            if (response.statusCode == 200 && jsonObject.email) {
                let userName = jsonObject.name || "";
                let userPicture = jsonObject.picture || "";
                let userLocale = jsonObject.locale || "";
                let userid = jsonObject.sub || "";
                let gender = jsonObject.gender || "";
                let birthday = jsonObject.birthday || "";

                let data = {
                    email: jsonObject.email,
                };

                console.log(data);

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

                    if (!user) {//sign up
                        console.log("User sign up");

                        let forgotCodeValue = crypto.randomBytes(32).toString('hex');

                        try {
                            email = validator.trim(email);
                            userName = validator.trim(userName);
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

                        let userModel = new User({
                            name: userName,
                            email: email,
                            password: null,
                            code: null,
                            strength: 30,
                            balance: 1000,
                            forgotCode: forgotCodeValue,
                            locale: userLocale,
                            picture: userPicture,
                            userid: userid,
                            birthday: birthday,
                            gender: gender,
                            hacked: 0,
                            adDisabled: 0,
                            bot: 0,
                            status: config.codes.user.notConfirmCode //not setup code
                        });

                        userModel.save(function (err, newUser) {
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
                            
                            let userInfoModel = new UserInfo({
                                userId: newUser._id,
                                data: userInfo,
                            });

                            userInfoModel.save();

                            let tokenValue = crypto.randomBytes(32).toString('hex');

                            AccessToken.findOne({userId: newUser._id}).exec(function (err, token) {
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

                                console.log(tokenValue);
                                
                                let userCode = newUser.code || "";
                                let finalCode = null;
                                let accessToken = tokenValue;

                                if (userCode.length >= 3) {
                                    //encrypt user code - for protection
                                    let cryptCodePost = md5(config.secretCodePre + accessToken + accessToken + config.secretCodePost);

                                    let cryptCode = md5(config.secretCodePre + userCode + config.secretCodePost + accessToken);

                                    let plainText = cryptCode + cryptCodePost;

                                    let cypherText = cryptLib.encrypt(plainText);
                                    //let originalText = cryptLib.decrypt(cypherText);

                                    finalCode = cypherText;
                                }
                                
                                let adValue = newUser.adDisabled || 0;
                                let plainAd = md5(config.secretCodePre + accessToken + md5(adValue.toString()));
                                let encryptAd = cryptLib.encrypt(plainAd);

                                if (token) {

                                    token.token = tokenValue;

                                    token.save(function (err) {
                                        if (err) {
                                            return res.json({
                                                status: 0,
                                                error: {
                                                    code: config.codes.error.errorDB,
                                                    message: 'DB'
                                                }
                                            });
                                        }

                                        let currentDate = new Date();
                                        let expires = new Date(currentDate.getTime() + config.tokenExpireTime);//+ 1 month

                                        res.json({
                                            status: 1,
                                            data: {
                                                token: {
                                                    userId: newUser._id,
                                                    token: tokenValue,
                                                    expires: dateFormat(expires, "yyyy-m-d H:MM:ss"),
                                                },
                                                user: {
                                                    userId: newUser._id,
                                                    name: newUser.name,
                                                    email: newUser.email,
                                                    balance: newUser.balance || 0,
                                                    code: finalCode,
                                                    strength: newUser.strength || 0,
                                                    hacked: newUser.hacked || 0,
                                                    adDisabled: encryptAd,
                                                    status: newUser.status || 0,
                                                    lastBonus: dateFormat(newUser.lastBonus || "", "yyyy-m-d H:MM:ss"),
                                                }
                                            }
                                        });
                                    });
                                } else {

                                    let tokenModel = new AccessToken({
                                        userId: newUser._id,
                                        token: tokenValue
                                    });

                                    tokenModel.save(function (err) {
                                        if (err) {
                                            return res.json({
                                                status: 0,
                                                error: {
                                                    code: config.codes.error.errorDB,
                                                    message: 'DB'
                                                }
                                            });
                                        }

                                        let currentDate = new Date();
                                        let expires = new Date(currentDate.getTime() + config.tokenExpireTime);//+ 1 month

                                        res.json({
                                            status: 1,
                                            data: {
                                                token: {
                                                    userId: newUser._id,
                                                    token: tokenValue,
                                                    expires: dateFormat(expires, "yyyy-m-d H:MM:ss"),
                                                },
                                                user: {
                                                    userId: newUser._id,
                                                    name: newUser.name,
                                                    email: newUser.email,
                                                    balance: newUser.balance || 0,
                                                    code: finalCode,
                                                    strength: newUser.strength || 0,
                                                    hacked: newUser.hacked || 0,
                                                    adDisabled: encryptAd,
                                                    status: newUser.status || 0,
                                                    lastBonus: dateFormat(newUser.lastBonus || "", "yyyy-m-d H:MM:ss"),
                                                }
                                            }
                                        });
                                    });
                                }
                            });
                        });
                    } else {//login
                        let tokenValue = crypto.randomBytes(32).toString('hex');
                        
                        let userInfoModel = new UserInfo({
                            userId: user._id,
                            data: userInfo,
                        });

                        userInfoModel.save();

                        AccessToken.findOne({userId: user._id}).exec(function (err, token) {
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

                            console.log("tokenValue");
                            console.log(tokenValue);
                            
                            let userCode = user.code || "";
                            let finalCode = null;
                            let accessToken = tokenValue;

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

                            if (token) {

                                console.log("AccessToken update");

                                token.token = tokenValue;
                                token.expires = new Date();//update expires time

                                token.save(function (err) {
                                    if (err) {
                                        return res.json({
                                            status: 0,
                                            error: {
                                                code: config.codes.error.errorDB,
                                                message: 'DB'
                                            }
                                        });
                                    }

                                    let currentDate = new Date();
                                    let expires = new Date(currentDate.getTime() + config.tokenExpireTime);//+ 1 month

                                    let tokenResponse = {
                                        userId: user._id,
                                        token: tokenValue,
                                        expires: dateFormat(expires, "yyyy-m-d H:MM:ss"),
                                    };

                                    let userResponse = {
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
                                    };


                                    console.log("tokenResponse");
                                    console.log(tokenResponse);

                                    console.log("userResponse");
                                    console.log(userResponse);

                                    res.json({
                                        status: 1,
                                        data: {
                                            token: tokenResponse,
                                            user: userResponse
                                        }
                                    });
                                });
                            } else {

                                console.log("AccessToken insert");

                                let tokenModel = new AccessToken({
                                    userId: user._id,
                                    token: tokenValue
                                });

                                console.log(tokenModel);

                                tokenModel.save(function (err) {
                                    if (err) {
                                        return res.json({
                                            status: 0,
                                            error: {
                                                code: config.codes.error.errorDB,
                                                message: 'DB'
                                            }
                                        });
                                    }

                                    let currentDate = new Date();
                                    let expires = new Date(currentDate.getTime() + config.tokenExpireTime);//+ 1 month

                                    let tokenResponse = {
                                        userId: user._id,
                                        token: tokenValue,
                                        expires: dateFormat(expires, "yyyy-m-d H:MM:ss"),
                                    };

                                    let userResponse = {
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
                                    };


                                    console.log("tokenResponse");
                                    console.log(tokenResponse);

                                    console.log("userResponse");
                                    console.log(userResponse);

                                    res.json({
                                        status: 1,
                                        data: {
                                            token: tokenResponse,
                                            user: userResponse
                                        }
                                    });
                                });
                            }
                        });
                    }
                });

            } else {//Error
                console.log("login error");

                return res.json({
                    status: 0,
                    error: {
                        code: config.codes.error.loginFailed,
                        message: 'Login Failed. Try Again'
                    }
                });
            }
        }
    });
});

module.exports = router;
